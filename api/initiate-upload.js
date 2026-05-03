// Vercel Serverless Function — start a Gemini resumable upload session
// Returns an uploadUrl the browser uses to send PDF bytes directly to Google,
// bypassing Vercel's 4.5 MB body limit entirely.
export const config = {
  api: { bodyParser: { sizeLimit: '4kb' } },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
