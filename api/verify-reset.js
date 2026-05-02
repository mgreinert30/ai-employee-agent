// Vercel Serverless Function — Verify password reset token
// Returns { email } if token is valid and not expired

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

async function hmacSign(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Buffer.from(sig).toString('hex');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Token fehlt' });

  const secret = process.env.RESET_SECRET || 'fallback-secret-change-me';

  const dotIdx = token.lastIndexOf('.');
  if (dotIdx === -1) return res.status(400).json({ error: 'Ungültiger Token' });

  const payload = token.slice(0, dotIdx);
  const sig     = token.slice(dotIdx + 1);

  const expectedSig = await hmacSign(secret, payload);
  if (sig !== expectedSig) return res.status(400).json({ error: 'Token ungültig oder manipuliert' });

  let email, expiry;
  try {
    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    [email, expiry] = decoded.split('|');
  } catch {
    return res.status(400).json({ error: 'Token konnte nicht gelesen werden' });
  }

  if (!email || Date.now() > parseInt(expiry)) {
    return res.status(400).json({ error: 'Link abgelaufen. Bitte erneut anfordern.' });
  }

  return res.status(200).json({ ok: true, email });
}
