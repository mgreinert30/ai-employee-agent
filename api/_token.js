// Shared HMAC token utilities — NOT a Vercel route (underscore prefix)
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const TTL = 900; // 15 minutes

export function issueToken({ use = 'analyse', sessionId = '', amount = '' } = {}) {
  const secret = process.env.TOKEN_SECRET;
  if (!secret) throw new Error('TOKEN_SECRET not configured');

  const payload = {
    tid: randomBytes(8).toString('hex'),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TTL,
    use,
    amt: String(amount),
    sid: String(sessionId).slice(0, 64),
  };

  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

export function verifyToken(token, expectedUse = 'analyse') {
  if (!token || typeof token !== 'string') return { valid: false, reason: 'missing' };

  const secret = process.env.TOKEN_SECRET;
  if (!secret) return { valid: false, reason: 'server_error' };

  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false, reason: 'format' };

  const [b64, sig] = parts;
  try {
    const expected = createHmac('sha256', secret).update(b64).digest('base64url');
    const a = Buffer.from(sig, 'base64url');
    const b = Buffer.from(expected, 'base64url');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { valid: false, reason: 'signature' };
    }
  } catch {
    return { valid: false, reason: 'signature' };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf-8'));
  } catch {
    return { valid: false, reason: 'payload' };
  }

  if (!payload.exp || Math.floor(Date.now() / 1000) > payload.exp) {
    return { valid: false, reason: 'expired' };
  }
  if (payload.use !== expectedUse) {
    return { valid: false, reason: 'wrong_use' };
  }

  return { valid: true, payload };
}

export function rejectToken(res, reason) {
  const msg = {
    missing:      'Analyse-Token fehlt. Bitte zuerst eine Zahlung abschließen.',
    expired:      'Analyse-Token abgelaufen (15 Min). Bitte eine neue Zahlung starten.',
    signature:    'Ungültiger Analyse-Token.',
    format:       'Ungültiger Analyse-Token.',
    payload:      'Ungültiger Analyse-Token.',
    wrong_use:    'Dieser Token gilt für einen anderen Dienst.',
    server_error: 'TOKEN_SECRET fehlt — Serverkonfigurationsfehler.',
  };
  const status = reason === 'server_error' ? 503 : reason === 'missing' ? 401 : 403;
  return res.status(status).json({ error: msg[reason] ?? 'Ungültiger Token.', code: reason });
}
