import {
  setCORS, readBody,
  kvConfigured, kvGet, kvSet, kvDel,
  hashPassword, DEFAULT_PASSWORD
} from './_lib.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!kvConfigured()) {
    return res.status(503).json({ error: 'Vercel KV nao configurado' });
  }

  const body = readBody(req);
  const token = String(body.token || '');
  const newPassword = String(body.newPassword || '');

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Informe o token e a nova senha' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
  }
  if (newPassword === DEFAULT_PASSWORD) {
    return res.status(400).json({ error: 'A nova senha nao pode ser a senha padrao' });
  }

  let email;
  try {
    email = await kvGet('reset:' + token);
  } catch (e) {
    return res.status(503).json({ error: 'Erro de KV: ' + e.message });
  }
  if (!email) {
    return res.status(400).json({ error: 'Token invalido ou expirado' });
  }

  try {
    const newHash = hashPassword(newPassword);
    await kvSet('user:' + email + ':passwordHash', newHash);
    await kvSet('user:' + email + ':passwordChanged', '1');
    await kvDel('reset:' + token);
  } catch (e) {
    return res.status(503).json({ error: 'Erro ao salvar nova senha: ' + e.message });
  }

  return res.status(200).json({ ok: true, email });
}
