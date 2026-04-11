import crypto from 'node:crypto';
import {
  setCORS, readBody, normalizeEmail, emailAllowed,
  kvConfigured, kvSet
} from './_lib.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!kvConfigured()) {
    return res.status(503).json({
      error: 'Vercel KV nao configurado. Necessario para recuperacao de senha.'
    });
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({
      error: 'Servico de e-mail nao configurado. Defina RESEND_API_KEY no Vercel.'
    });
  }

  const body = readBody(req);
  const email = normalizeEmail(body.email);
  if (!email) {
    return res.status(400).json({ error: 'Informe o e-mail' });
  }

  // Se o e-mail nao for o permitido (APP_EMAIL), responde sucesso silencioso
  // para nao vazar quais e-mails existem.
  if (!emailAllowed(email)) {
    return res.status(200).json({ ok: true });
  }

  // Gera token de reset (32 bytes = 64 hex chars), TTL de 30 minutos
  const token = crypto.randomBytes(32).toString('hex');
  const TTL_SECONDS = 30 * 60;
  try {
    await kvSet('reset:' + token, email, TTL_SECONDS);
  } catch (e) {
    return res.status(503).json({ error: 'Erro ao gerar token: ' + e.message });
  }

  // Monta URL de reset usando o host da requisicao
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const resetLink = proto + '://' + host + '/?reset=' + token;

  const fromAddress = process.env.RESEND_FROM || 'onboarding@resend.dev';
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #1a2e1a;">
      <div style="text-align: center; font-size: 42px; margin-bottom: 8px;">🌿</div>
      <h2 style="color: #2E7D32; text-align: center; margin: 0 0 8px;">Familia Metzger</h2>
      <p style="color: #666; text-align: center; margin: 0 0 24px; font-size: 14px;">Gestao Financeira</p>
      <hr style="border: none; border-top: 1px solid #d0e0d0; margin: 20px 0;" />
      <p>Recebemos um pedido para redefinir a senha do seu acesso ao app.</p>
      <p>Clique no botao abaixo para definir uma nova senha (valido por 30 minutos):</p>
      <p style="margin: 28px 0; text-align: center;">
        <a href="${resetLink}" style="background: #43A047; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 10px; display: inline-block; font-weight: 600;">Redefinir minha senha</a>
      </p>
      <p style="color: #888; font-size: 12px; margin-top: 24px;">Se voce nao solicitou esta troca, ignore este e-mail.</p>
      <p style="color: #888; font-size: 11px; word-break: break-all;">Link direto: ${resetLink}</p>
    </div>
  `;

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [email],
        subject: 'Recuperacao de senha - Familia Metzger',
        html: htmlBody
      })
    });
    if (!resendRes.ok) {
      const errText = await resendRes.text().catch(() => '');
      console.error('Resend error:', resendRes.status, errText);
      return res.status(500).json({
        error: 'Falha ao enviar e-mail (' + resendRes.status + '): ' + errText
      });
    }
  } catch (e) {
    console.error('Resend fetch error:', e);
    return res.status(500).json({ error: 'Falha ao enviar e-mail: ' + e.message });
  }

  return res.status(200).json({ ok: true });
}
