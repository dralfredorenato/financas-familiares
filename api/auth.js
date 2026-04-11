import {
  setCORS, readBody, normalizeEmail, emailAllowed,
  kvConfigured, kvGet, verifyPassword, DEFAULT_PASSWORD
} from './_lib.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = readBody(req);
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Informe e-mail e senha' });
  }

  if (!emailAllowed(email)) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos' });
  }

  // 1. Tenta KV primeiro. Se o usuario tem senha personalizada salva,
  //    ela e a unica aceita (nao ha fallback para a senha padrao).
  if (kvConfigured()) {
    let stored, changed;
    try {
      stored = await kvGet('user:' + email + ':passwordHash');
      changed = await kvGet('user:' + email + ':passwordChanged');
    } catch (e) {
      console.error('KV read error:', e);
      return res.status(503).json({
        error: 'Erro ao acessar o banco de senhas: ' + e.message
      });
    }

    if (stored) {
      if (!verifyPassword(password, stored)) {
        return res.status(401).json({ error: 'E-mail ou senha incorretos' });
      }
      return res.status(200).json({
        ok: true,
        email,
        mustChangePassword: changed !== '1',
        kvConfigured: true
      });
    }
  }

  // 2. Sem KV ou sem senha salva: valida contra a senha padrao #123456.
  //    Usuario sempre recebe mustChangePassword=true, mas se KV nao estiver
  //    configurado, o cliente vai mostrar um aviso que a troca de senha
  //    precisa do KV para persistir.
  if (password === DEFAULT_PASSWORD) {
    return res.status(200).json({
      ok: true,
      email,
      mustChangePassword: true,
      usingDefault: true,
      kvConfigured: kvConfigured()
    });
  }

  return res.status(401).json({ error: 'E-mail ou senha incorretos' });
}
