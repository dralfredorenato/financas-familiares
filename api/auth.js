export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const validPassword = process.env.APP_PASSWORD;
  if (!validPassword) {
    return res.status(503).json({
      error: 'APP_PASSWORD nao configurado. No Vercel: Settings -> Environment Variables -> adicione APP_PASSWORD com a senha desejada e faca redeploy.'
    });
  }

  const body = req.body || {};
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Informe e-mail e senha' });
  }

  // APP_EMAIL e opcional - se nao for definido, aceita qualquer e-mail desde
  // que a senha esteja correta. Se for definido, precisa bater.
  const validEmail = (process.env.APP_EMAIL || '').toLowerCase();
  if (validEmail && email !== validEmail) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos' });
  }

  if (password !== validPassword) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos' });
  }

  return res.status(200).json({ ok: true, email });
}
