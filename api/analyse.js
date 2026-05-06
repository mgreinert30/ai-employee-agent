// Vercel Serverless Function — Gemini PDF Analysis
export const config = {
  api: { bodyParser: { sizeLimit: '8mb' } },
};

// Fastest models first — lite/flash complete well within 60s
const VISION_MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
];

const TEXT_MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callGemini(model, apiKey, body, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
      );

      let data;
      try { data = await res.json(); } catch (_) {
        if (attempt < retries) { await sleep(500); continue; }
        return { error: `HTTP ${res.status} — no JSON` };
      }

      if (res.status === 503 || data?.error?.code === 503) {
        if (attempt < retries) { await sleep(800); continue; }
        return { error: `HTTP 503: model overloaded` };
      }

      if (res.status === 429 || data?.error?.code === 429) {
        if (attempt < retries) { await sleep(1000); continue; }
        return { error: `HTTP 429: rate limit` };
      }

      if (!res.ok || data.error) {
        return { error: `HTTP ${res.status}: ${data.error?.message || JSON.stringify(data).slice(0, 120)}` };
      }

      const result = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!result) return { error: `empty response: ${JSON.stringify(data).slice(0, 120)}` };

      return { result };
    } catch (err) {
      if (attempt < retries) { await sleep(500); continue; }
      return { error: err.message };
    }
  }
}

// Token limits tuned to finish well within 60s on Vercel Hobby plan
const TOKEN_LIMITS = {
  short:  2048,
  medium: 8192,
  long:   16384,
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { prompt, images, fileUri, fileMimeType, analysisLength } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt (string) is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });

  const hasFile   = typeof fileUri === 'string' && fileUri.startsWith('https://');
  const hasImages = !hasFile && Array.isArray(images) && images.length > 0;
  const models    = (hasFile || hasImages) ? VISION_MODELS : TEXT_MODELS;

  const modePrefix = hasFile
    ? `NATIVE PDF ANALYSIS MODE — You have direct access to the complete PDF document via the Gemini File API.
Read ALL text, tables, charts, and data directly from the document without any limitations.
Extract and analyse the full content comprehensively — no page limits apply.

`
    : hasImages
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

  // Keep prompt under 60k chars to leave processing headroom
  const safePrompt = modePrefix + (prompt.length > 60000
    ? prompt.slice(0, 60000) + '\n\n[Dokument gekürzt]'
    : prompt);

  const parts = hasFile
    ? [{ fileData: { mimeType: fileMimeType || 'application/pdf', fileUri } }, { text: safePrompt }]
    : hasImages
    ? [...images.map(b64 => ({ inlineData: { mimeType: 'image/jpeg', data: b64 } })), { text: safePrompt }]
    : [{ text: safePrompt }];

  const maxTokens = TOKEN_LIMITS[analysisLength] || TOKEN_LIMITS.medium;

  const geminiBody = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.3, topP: 0.9, topK: 40,
    },
  });

  const allErrors = [];

  for (const model of models) {
    const { result, error } = await callGemini(model, apiKey, geminiBody);
    if (result) {
      return res.status(200).json({ result, model, pagesAnalysed: hasFile ? 'all' : hasImages ? images.length : 0 });
    }
    allErrors.push(`[${model}] ${error}`);
  }

  return res.status(500).json({ error: allErrors.join(' | '), allErrors });
}
