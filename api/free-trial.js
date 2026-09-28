// Vercel Serverless — stellt einen signierten Free-Trial-Token aus
// Jede Session-ID bekommt genau EINEN Token (Rate-Limit pro IP + Session)
// Ersetzt den hartkodierten String 'free-trial' in api/analyse.js
import { issueToken } from './_token.js';

export const config = { api: { bodyParser: { sizeLimit: '1kb' } } };

const usedSessions = new Map(); // sessionId → timestamp
const ipCounts = new Map();     // ip → { count, resetAt }

function isIpLimited(ip) {
  const now = Date.now();
  const rec = ipCounts.get(ip);
  if (!rec || now > rec.resetAt) {
    ipCounts.set(ip, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 }); // 24h Fenster
    return false;
  }
  if (rec.count >= 3) return true; // max 3 Free Trials pro IP pro Tag
  rec.count++;
  return false;
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { sessionId } = req.body || {};
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length < 8) {
    return res.status(400).json({ error: 'sessionId fehlt' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

  // Session bereits genutzt?
  if (usedSessions.has(sessionId)) {
    return res.status(409).json({ error: 'Free Trial bereits genutzt.' });
  }

  // IP-Limit
  if (isIpLimited(ip)) {
    return res.status(429).json({ error: 'Free-Trial-Limit erreicht. Bitte wähle einen Tarif.' });
  }

  try {
    const token = issueToken({ use: 'analyse', sessionId, amount: '0' });
    usedSessions.set(sessionId, Date.now());
    return res.status(200).json({ token });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
