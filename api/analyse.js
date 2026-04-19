// Vercel Serverless Function — Gemini PDF Analysis
// The API key is stored securely as a Vercel environment variable (GEMINI_API_KEY).
// This keeps the key off the client and makes real AI available to every user.

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers so the frontend can call this from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { prompt } = req.body || {};

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt (string) is required' });
  }

  // Truncate to ~120 000 chars to stay within Gemini token limits
  const safePrompt = prompt.length > 120000 ? prompt.slice(0, 120000) + '\n\n[Dokument gekürzt — zu lang für eine Übertragung]' : prompt;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: safePrompt }] }],
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.3,
            topP: 0.9,
            topK: 40
          }
        })
      }
    );

    const data = await geminiRes.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const result = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!result) {
      return res.status(500).json({ error: 'Keine Antwort von Gemini erhalten' });
    }

    return res.status(200).json({ result });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unbekannter Fehler' });
  }
}
