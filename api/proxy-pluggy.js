// Proxy Vercel para a API do Pluggy (api.pluggy.ai).
// Gerencia o JWT automaticamente: recebe clientId + clientSecret,
// faz POST /auth para obter o apiKey e o cacheia ate expirar (2h).
// O frontend so precisa enviar X-Pluggy-Client-Id e X-Pluggy-Client-Secret.

const PLUGGY_BASE = 'https://api.pluggy.ai';

// Cache do JWT em memoria (por cold-start do serverless — dura ~5-15 min).
let _cachedToken = null;
let _cachedTokenExp = 0;

async function getApiKey(clientId, clientSecret) {
  const now = Date.now();
  // Retorna o token cacheado se ainda tiver pelo menos 60s de vida
  if (_cachedToken && _cachedTokenExp > now + 60000) {
    return _cachedToken;
  }
  const res = await fetch(PLUGGY_BASE + '/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret })
  });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error('Pluggy auth failed: ' + res.status + ' ' + body);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  _cachedToken = data.apiKey;
  // JWT expira em 2h; decodifica exp para saber exatamente
  try {
    const payload = JSON.parse(Buffer.from(_cachedToken.split('.')[1], 'base64').toString());
    _cachedTokenExp = payload.exp * 1000;
  } catch (_) {
    _cachedTokenExp = now + 2 * 60 * 60 * 1000 - 60000; // fallback: 1h59min
  }
  return _cachedToken;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Pluggy-Client-Id, X-Pluggy-Client-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const clientId = req.headers['x-pluggy-client-id'];
  const clientSecret = req.headers['x-pluggy-client-secret'];

  if (!clientId || !clientSecret) {
    return res.status(401).json({ error: 'Client ID e Client Secret obrigatorios' });
  }

  const endpoint = req.query.endpoint;
  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint obrigatorio' });
  }

  try {
    const apiKey = await getApiKey(clientId, clientSecret);

    // Monta URL final com query params extras (ex: itemId, accountId, from, to)
    const params = new URLSearchParams();
    Object.entries(req.query).forEach(function(entry) {
      if (entry[0] !== 'endpoint') params.append(entry[0], entry[1]);
    });
    const qs = params.toString();
    const url = PLUGGY_BASE + '/' + endpoint + (qs ? '?' + qs : '');

    const fetchOptions = {
      method: req.method,
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      }
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(url, fetchOptions);
    const data = await response.text();

    // Repassa rate-limit headers para o frontend poder reagir
    const rl = response.headers.get('ratelimit-limit');
    const rr = response.headers.get('ratelimit-reset');
    if (rl) res.setHeader('X-RateLimit-Limit', rl);
    if (rr) res.setHeader('X-RateLimit-Reset', rr);

    res.status(response.status);
    try {
      return res.json(JSON.parse(data));
    } catch (_) {
      return res.send(data);
    }
  } catch (error) {
    console.error('Pluggy proxy error:', error);
    const status = error.status || 500;
    return res.status(status).json({ error: 'Erro no proxy Pluggy', details: error.message });
  }
}
