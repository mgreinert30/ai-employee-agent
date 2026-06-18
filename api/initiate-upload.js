// Vercel Serverless Function — start a Gemini resumable upload session
// Returns an uploadUrl the browser uses to send PDF bytes directly to Google,
// bypassing Vercel's 4.5 MB body limit entirely.
import { verifyToken, rejectToken } from './_token.js';

export const config = {
  api: { bodyParser: { sizeLimit: '4kb' } },
};

const rateLimitMap = new Map();
function isRateLimited(ip, max = 8, windowMs = 60000) {
  const now = Date.now();
  const rec = rateLimitMap.get(ip);
  if (!rec || now - rec.t > windowMs) { rateLimitMap.set(ip, { t: now, n: 1 }); return false; }
  rec.n++;
  return rec.n > max;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Zu viele Anfragen. Bitte warte eine Minute.' });

  // Token-Prüfung — Upload-URL nur mit gültigem Analyse-Token ausgeben
  const token = req.headers['x-analysis-token'] || req.body?.analysisToken;
  if (token !== 'free-trial') {
    const tokenCheck = verifyToken(token, 'analyse');
    if (!tokenCheck.valid) return rejectToken(res, tokenCheck.reason);
  }

  const { filename, mimeType, fileSize } = req.body || {};
  if (!filename || !mimeType || !fileSize) {
    return res.status(400).json({ error: 'filename, mimeType, fileSize required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  try {
    const initiateRes = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}&uploadType=resumable`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(fileSize),
          'X-Goog-Upload-Header-Content-Type': mimeType,
        },
        body: JSON.stringify({ file: { displayName: filename } }),
      }
    );

    if (!initiateRes.ok) {
      const text = await initiateRes.text().catch(() => '');
      return res.status(500).json({
        error: `Gemini upload init failed: HTTP ${initiateRes.status} — ${text.slice(0, 200)}`,
      });
    }

    const uploadUrl = initiateRes.headers.get('X-Goog-Upload-URL');
    if (!uploadUrl) {
      return res.status(500).json({ error: 'No upload URL returned from Gemini' });
    }

    return res.status(200).json({ uploadUrl });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
