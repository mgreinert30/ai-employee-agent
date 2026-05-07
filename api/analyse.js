// Vercel Serverless Function — Gemini PDF Analysis
export const config = {
  api: { bodyParser: { sizeLimit: '8mb' } },
};

// Two models only — fastest first, fallback if overloaded
const MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash'];

// Conservative limits: Gemini Flash ≈ 100 tok/s → 2048=~20s, 4096=~40s, 6144=~55s
// Each model gets ONE shot — no retries that waste precious seconds.
const TOKEN_LIMITS = {
  short:  2048,   // ~15-20s
  medium: 4096,   // ~30-40s
  long:   6144,   // ~50-55s — tight but fits if first model responds
};

// Max prompt size — keeps transfer + processing time under control
const MAX_PROMPT_CHARS = 30000;

async function callGemini(model, apiKey, body) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
    );

    let data;
    try { data = await res.json(); } catch (_) {
      return { error: `HTTP ${res.status} — no JSON` };
    }

    if (!res.ok || data.error) {
      return { error: `HTTP ${res.status}: ${data.error?.message || JSON.stringify(data).slice(0, 120)}` };
    }

    const result = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!result) return { error: `empty response: ${JSON.stringify(data).slice(0, 120)}` };

    return { result };
  } catch (err) {
    return { error: err.message };
  }
}

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

  const modePrefix = hasFile
    ? `NATIVE PDF ANALYSIS MODE — You have direct access to the complete PDF document via the Gemini File API.\nRead ALL text, tables, charts, and data directly from the document without any limitations.\n\n`
    : hasImages
    ? `VISUAL ANALYSIS MODE — You are viewing ${images.length} rendered page image(s).\n- TABLES: extract EVERY row and column exactly as Markdown tables.\n- CHARTS: describe all data points, axis labels, trends.\n- Prefer visual data for tables/numbers over extracted text.\n\n`
    : '';

  const safePrompt = modePrefix + (prompt.length > MAX_PROMPT_CHARS
    ? prompt.slice(0, MAX_PROMPT_CHARS) + '\n\n[Dokument gekürzt]'
    : prompt);

  const parts = hasFile
    ? [{ fileData: { mimeType: fileMimeType || 'application/pdf', fileUri } }, { text: safePrompt }]
    : hasImages
    ? [...images.map(b64 => ({ inlineData: { mimeType: 'image/jpeg', data: b64 } })), { text: safePrompt }]
    : [{ text: safePrompt }];

  const maxTokens = TOKEN_LIMITS[analysisLength] || TOKEN_LIMITS.medium;

  // No Google Search grounding — adds 10-20s latency that causes 504 timeouts
  const geminiBody = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.3, topP: 0.9, topK: 40,
    },
  });

  const allErrors = [];

  for (const model of MODELS) {
    const { result, error } = await callGemini(model, apiKey, geminiBody);
    if (result) {
      return res.status(200).json({ result, model, pagesAnalysed: hasFile ? 'all' : hasImages ? images.length : 0 });
    }
    allErrors.push(`[${model}] ${error}`);
    // Only fall through to next model for retriable errors (overload/rate-limit)
    if (!error?.includes('503') && !error?.includes('429') && !error?.includes('overload')) break;
  }

  return res.status(500).json({ error: allErrors.join(' | '), allErrors });
}
