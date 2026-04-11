import {
  setCORS, readBody, normalizeEmail, emailAllowed,
  kvConfigured, kvGet, kvSet,
  hashPassword, verifyPassword, DEFAULT_PASSWORD
} from './_lib.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!kvConfigured()) {
    return res.status(503).json({
      error: 'Vercel KV nao configurado. Para habilitar troca de senha, va em Vercel -> Storage -> Create Database -> KV e conecte ao projeto.'
    });
  }

  const body = readBody(req);
  const email = normalizeEmail(body.email);
  const currentPassword = String(body.currentPassword || '');
  const newPassword = String(body.newPassword || '');

  if (!email || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Preencha todos os campos' });
  }
  if (!emailAllowed(email)) {
    return res.status(401).json({ error: 'Usuario nao autorizado' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
  }
  if (newPassword === DEFAULT_PASSWORD) {
    return res.status(400).json({ error: 'A nova senha nao pode ser a senha padrao' });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ error: 'A nova senha deve ser diferente da atual' });
  }

  // Verifica senha atual
  let stored;
  try {
    stored = await kvGet('user:' + email + ':passwordHash');
  } catch (e) {
    return res.status(503).json({ error: 'Erro de KV: ' + e.message });
  }

  let currentOk;
  if (stored) {
    currentOk = verifyPassword(currentPassword, stored);
  } else {
    currentOk = currentPassword === DEFAULT_PASSWORD;
  }
  if (!currentOk) {
    return res.status(401).json({ error: 'Senha atual incorreta' });
  }

  // Salva nova senha
  try {
    const newHash = hashPassword(newPassword);
    await kvSet('user:' + email + ':passwordHash', newHash);
    await kvSet('user:' + email + ':passwordChanged', '1');
  } catch (e) {
    return res.status(503).json({ error: 'Erro ao salvar nova senha: ' + e.message });
  }

  return res.status(200).json({ ok: true });
}
