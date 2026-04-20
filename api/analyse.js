// Vercel Serverless Function — Gemini PDF Analysis (text + vision)
// Increase body size limit so PDF page images (up to ~6 MB base64) can be transmitted
export const config = {
  api: { bodyParser: { sizeLimit: '8mb' } },
};

// Vision models see the actual rendered page layout, including tables and charts.

// Models confirmed available via /api/models endpoint
const VISION_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
];

const TEXT_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
];

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { prompt, images } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt (string) is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
  }

  const hasImages = Array.isArray(images) && images.length > 0;
  const models    = hasImages ? VISION_MODELS : TEXT_MODELS;

  // Build the multimodal prompt prefix when images are present
  const visionPrefix = hasImages
    ? `VISUAL ANALYSIS MODE — You are viewing ${images.length} rendered page image(s) of the document.
CRITICAL INSTRUCTIONS FOR VISUAL CONTENT:
- TABLES: When you see a table in the images, extract EVERY row and column exactly. Format as:
  | Column 1 | Column 2 | Column 3 |
  |----------|----------|----------|
  | value    | value    | value    |
- CHARTS/GRAPHS: Describe all visible data points, axis labels, trends, and peak values.
- LAYOUT: Use the visual structure (headers, sections, indentation) to understand hierarchy.
- The text extraction below supplements the images — prefer visual data for tables/numbers.

`
    : '';

  const safePrompt = visionPrefix + (prompt.length > 100000
    ? prompt.slice(0, 100000) + '\n\n[Dokument gekürzt]'
    : prompt);

  // Assemble content parts: images first, then the text prompt
  const parts = hasImages
    ? [
        ...images.map(b64 => ({ inlineData: { mimeType: 'image/jpeg', data: b64 } })),
        { text: safePrompt },
      ]
    : [{ text: safePrompt }];

  const geminiBody = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { maxOutputTokens: 8192, temperature: 0.3, topP: 0.9, topK: 40 },
  });

  const allErrors = [];

  for (const model of models) {
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: geminiBody }
      );

      let data;
      try { data = await geminiRes.json(); }
      catch (_) { allErrors.push(`[${model}] HTTP ${geminiRes.status} — kein JSON`); continue; }

      if (!geminiRes.ok || data.error) {
        allErrors.push(`[${model}] HTTP ${geminiRes.status}: ${data.error?.message || JSON.stringify(data).slice(0,120)}`);
        continue;
      }

      const result = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!result) {
        allErrors.push(`[${model}] Leere Antwort: ${JSON.stringify(data).slice(0,120)}`);
        continue;
      }

      return res.status(200).json({ result, model, pagesAnalysed: hasImages ? images.length : 0 });

    } catch (err) {
      allErrors.push(`[${model}] ${err.message}`);
    }
  }

  return res.status(500).json({
    error: allErrors.join(' | '),
    allErrors,
  });
}
