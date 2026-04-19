// Vercel Serverless Function — Gemini PDF Analysis
// Tries multiple models in order until one works.

const MODELS = [
  'gemini-2.0-flash',
  'gemini-2.5-flash-preview-04-17',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro-latest',
  'gemini-pro',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt (string) is required' });
  }

  const safePrompt = prompt.length > 120000
    ? prompt.slice(0, 120000) + '\n\n[Dokument gekürzt]'
    : prompt;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
  }

  const body = JSON.stringify({
    contents: [{ parts: [{ text: safePrompt }] }],
    generationConfig: { maxOutputTokens: 8192, temperature: 0.3, topP: 0.9, topK: 40 }
  });

  let lastError = 'Kein Modell verfügbar';

  for (const model of MODELS) {
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
      );
      const data = await geminiRes.json();

      if (data.error) {
        lastError = `[${model}] ${data.error.message}`;
        continue; // try next model
      }

      const result = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!result) {
        lastError = `[${model}] Keine Antwort erhalten`;
        continue;
      }

      return res.status(200).json({ result, model });

    } catch (err) {
      lastError = `[${model}] ${err.message}`;
    }
  }

  return res.status(500).json({ error: lastError });
}
