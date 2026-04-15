// Proxy Vercel para a API do Banco Inter Empresas (cdpj.partners.bancointer.com.br).
// A API do Inter exige mTLS (certificado digital + chave privada) + OAuth2
// client_credentials. Como o navegador nao consegue fazer mTLS, este proxy
// serverless faz o trabalho: recebe credenciais + cert/key via headers,
// obtem o access_token e repassa a chamada.
//
// Headers esperados (enviados do frontend):
//   X-Inter-Client-Id       — client_id do app no portal dev.inter.co
//   X-Inter-Client-Secret   — client_secret
//   X-Inter-Conta-Corrente  — numero da conta corrente (ex: "12345678")
//   X-Inter-Cert            — certificado PEM (base64 do .crt) OU PEM em texto
//   X-Inter-Key             — chave privada PEM (base64 do .key) OU PEM em texto
//   X-Inter-Scope           — escopo(s) OAuth (ex: "extrato.read")
//
// Query params:
//   endpoint  — path apos /banking/v2/ (ex: "saldo", "extrato", "extrato/completo")
//   + qualquer outro param que a API do Inter aceite (ex: dataInicio, dataFim)

import https from 'https';

const INTER_BASE = 'https://cdpj.partners.bancointer.com.br';
const INTER_TOKEN_PATH = '/oauth/v2/token';
const INTER_API_PREFIX = '/banking/v2/';

// Cache de token em memoria (por cold-start do serverless). O token do Inter
// dura 3600s; cacheamos ate 60s antes de expirar.
let _cachedToken = null;
let _cachedTokenExp = 0;
let _cachedTokenKey = null; // hash simples para invalidar se credenciais mudarem

function normalizePem(raw) {
  if (!raw) return '';
  // Aceita tanto PEM em texto puro quanto base64 (sem headers BEGIN/END).
  // Se ja comeca com "-----BEGIN", usa direto.
  if (raw.indexOf('-----BEGIN') >= 0) return raw.replace(/\\n/g, '\n');
  // Tenta decodificar base64
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    if (decoded.indexOf('-----BEGIN') >= 0) return decoded;
  } catch (_) {}
  return raw;
}

function credKey(clientId, certPem) {
  // Chave de cache — troca de cert/client invalida token
  return String(clientId).slice(0, 12) + ':' + String(certPem).length;
}

// Faz fetch com mTLS via Node https.request (nao da para usar fetch nativo
// com cert/key no runtime Node da Vercel).
function mtlsRequest(urlStr, options, cert, key, body) {
  return new Promise(function(resolve, reject) {
    const url = new URL(urlStr);
    const reqOpts = {
      method: options.method || 'GET',
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      headers: options.headers || {},
      cert: cert,
      key: key
    };
    const req = https.request(reqOpts, function(resp) {
      const chunks = [];
      resp.on('data', function(c) { chunks.push(c); });
      resp.on('end', function() {
        const buf = Buffer.concat(chunks).toString('utf8');
        resolve({
          status: resp.statusCode,
          headers: resp.headers,
          body: buf
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getAccessToken(clientId, clientSecret, scope, cert, key) {
  const now = Date.now();
  const ckey = credKey(clientId, cert);
  if (_cachedToken && _cachedTokenKey === ckey && _cachedTokenExp > now + 60000) {
    return _cachedToken;
  }
  const form = new URLSearchParams();
  form.append('client_id', clientId);
  form.append('client_secret', clientSecret);
  form.append('grant_type', 'client_credentials');
  form.append('scope', scope || 'extrato.read');
  const bodyStr = form.toString();

  const resp = await mtlsRequest(INTER_BASE + INTER_TOKEN_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(bodyStr)
    }
  }, cert, key, bodyStr);

  if (resp.status < 200 || resp.status >= 300) {
    const err = new Error('Inter OAuth falhou: ' + resp.status + ' ' + resp.body);
    err.status = resp.status;
    throw err;
  }
  let data;
  try { data = JSON.parse(resp.body); }
  catch (e) { throw new Error('Inter OAuth respondeu JSON invalido: ' + resp.body); }

  _cachedToken = data.access_token;
  _cachedTokenKey = ckey;
  _cachedTokenExp = now + (data.expires_in || 3600) * 1000;
  return _cachedToken;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',
    'Content-Type, X-Inter-Client-Id, X-Inter-Client-Secret, X-Inter-Conta-Corrente, X-Inter-Cert, X-Inter-Key, X-Inter-Scope');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const clientId     = req.headers['x-inter-client-id'];
  const clientSecret = req.headers['x-inter-client-secret'];
  const contaCorrente = req.headers['x-inter-conta-corrente'];
  const certRaw      = req.headers['x-inter-cert'];
  const keyRaw       = req.headers['x-inter-key'];
  const scope        = req.headers['x-inter-scope'] || 'extrato.read';

  if (!clientId || !clientSecret || !certRaw || !keyRaw) {
    return res.status(401).json({
      error: 'Credenciais Inter obrigatorias',
      details: 'Envie X-Inter-Client-Id, X-Inter-Client-Secret, X-Inter-Cert e X-Inter-Key'
    });
  }

  const endpoint = req.query.endpoint;
  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint obrigatorio (ex: saldo, extrato)' });
  }

  const cert = normalizePem(certRaw);
  const key  = normalizePem(keyRaw);

  try {
    const token = await getAccessToken(clientId, clientSecret, scope, cert, key);

    // Monta URL final com query params (exceto "endpoint")
    const params = new URLSearchParams();
    Object.entries(req.query).forEach(function(entry) {
      if (entry[0] !== 'endpoint') params.append(entry[0], entry[1]);
    });
    const qs = params.toString();
    const fullUrl = INTER_BASE + INTER_API_PREFIX + endpoint + (qs ? '?' + qs : '');

    const headers = {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/json'
    };
    if (contaCorrente) headers['x-conta-corrente'] = contaCorrente;

    let body = null;
    if (req.method === 'POST' && req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
    }

    const apiResp = await mtlsRequest(fullUrl, {
      method: req.method,
      headers: headers
    }, cert, key, body);

    res.status(apiResp.status);
    try {
      return res.json(JSON.parse(apiResp.body));
    } catch (_) {
      return res.send(apiResp.body);
    }
  } catch (error) {
    console.error('Inter proxy error:', error);
    const status = error.status || 500;
    return res.status(status).json({
      error: 'Erro no proxy Inter',
      details: error.message
    });
  }
}
