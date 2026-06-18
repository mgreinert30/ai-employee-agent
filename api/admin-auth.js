// Vercel Serverless Function — Server-side owner authentication
import { createHash, timingSafeEqual } from 'crypto';

export const config = {
  api: { bodyParser: true },
};

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const { email, password } = req.body || {};
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(200).json({ ok: false });
  }

  const ownerEmail = process.env.OWNER_EMAIL;
  const ownerHash  = process.env.OWNER_HASH;

  // Return false (not 500) so the error doesn't reveal whether env vars exist
  if (!ownerEmail || !ownerHash) return res.status(200).json({ ok: false });

  const inputHash = createHash('sha256').update(password).digest('hex');

  let hashesMatch = false;
  try {
    const a = Buffer.from(ownerHash.toLowerCase(), 'hex');
    const b = Buffer.from(inputHash.toLowerCase(), 'hex');
    hashesMatch = a.length === b.length && timingSafeEqual(a, b);
  } catch (_) {}

  return res.status(200).json({ ok: email === ownerEmail && hashesMatch });
}
