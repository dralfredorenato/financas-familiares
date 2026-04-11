// Shared helpers for api/* serverless functions.
// Nome comeca com "_" -> Vercel nao expoe como rota publica.

import crypto from 'node:crypto';

export const DEFAULT_PASSWORD = '#123456';

// ============================================================
// CORS
// ============================================================
export function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ============================================================
// Password hashing (PBKDF2-SHA256, 100k iterations, 32 bytes)
// Formato: "<saltHex>:<hashHex>"
// ============================================================
export function hashPassword(password, existingSalt) {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 32, 'sha256')
    .toString('hex');
  return salt + ':' + hash;
}

export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt] = stored.split(':');
  const computed = hashPassword(password, salt);
  try {
    const a = Buffer.from(computed);
    const b = Buffer.from(stored);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

// ============================================================
// Vercel KV / Upstash Redis REST API
// Env vars esperadas (auto-injetadas pela integracao Vercel KV):
//   KV_REST_API_URL
//   KV_REST_API_TOKEN
// ============================================================
export function kvConfigured() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvCommand(command) {
  if (!kvConfigured()) {
    const err = new Error('Vercel KV nao configurado');
    err.code = 'KV_NOT_CONFIGURED';
    throw err;
  }
  const res = await fetch(process.env.KV_REST_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.KV_REST_API_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error('KV error ' + res.status + ': ' + text);
  }
  const data = await res.json();
  return data.result;
}

export async function kvGet(key) {
  if (!kvConfigured()) return null;
  return kvCommand(['GET', key]);
}

export async function kvSet(key, value, exSeconds) {
  if (exSeconds) {
    return kvCommand(['SET', key, String(value), 'EX', String(exSeconds)]);
  }
  return kvCommand(['SET', key, String(value)]);
}

export async function kvDel(key) {
  return kvCommand(['DEL', key]);
}

// ============================================================
// Utils
// ============================================================
export function normalizeEmail(e) {
  return String(e || '').trim().toLowerCase();
}

export function emailAllowed(email) {
  // Se APP_EMAIL estiver definida, restringe login a esse e-mail.
  const allowed = (process.env.APP_EMAIL || '').toLowerCase();
  if (!allowed) return true;
  return normalizeEmail(email) === allowed;
}

// Parse request body - Vercel parses JSON automatically, but be defensive
export function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return req.body;
}
