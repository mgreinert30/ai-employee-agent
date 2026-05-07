// Vercel Serverless Function — Gemini PDF Analysis (streaming)
export const config = {
  api: { bodyParser: { sizeLimit: '8mb' } },
};

// Model priority list — self-healing: deprecated models 404 and the next one is tried automatically
const MODELS = [
  'gemini-2.5-flash',       // primary: latest, fastest
  'gemini-2.0-flash',       // fallback 1
  'gemini-2.0-flash-lite',  // fallback 2
  'gemini-1.5-flash',       // fallback 3: older but widely available
];

// Conservative limits: Gemini Flash ≈ 100 tok/s → 2048=~20s, 4096=~40s, 6144=~55s
const TOKEN_LIMITS = {
  short:  2048,
  medium: 4096,
  long:   6144,
};

const MAX_PROMPT_CHARS = 30000;

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

  const geminiBody = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.3, topP: 0.9, topK: 40,
    },
  });

  const pagesAnalysed = hasFile ? 'all' : hasImages ? images.length : 0;
  const allErrors = [];

  for (const model of MODELS) {
    let geminiRes;
    try {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: geminiBody }
      );
    } catch (err) {
      allErrors.push(`[${model}] network error: ${err.message}`);
      continue;
    }

    if (!geminiRes.ok) {
      let errMsg = `HTTP ${geminiRes.status}`;
      try { const d = await geminiRes.json(); errMsg += `: ${d.error?.message || JSON.stringify(d).slice(0, 120)}`; } catch (_) {}
      allErrors.push(`[${model}] ${errMsg}`);
      // Skip to next model for: deprecated/unavailable (404), bad request (400), overload (503), rate-limit (429)
      const retriable = geminiRes.status === 404 || geminiRes.status === 400
        || geminiRes.status === 503 || geminiRes.status === 429;
      if (!retriable) break;
      continue;
    }

    // Model responded — start SSE stream back to client
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx/Vercel response buffering

    // First event: metadata
    res.write(`data: ${JSON.stringify({ model, pagesAnalysed })}\n\n`);

    const reader = geminiRes.body.getReader();
    const decoder = new TextDecoder();
    let lineBuffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop(); // keep any incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;
          try {
            const evt = JSON.parse(payload);
            const text = evt.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
          } catch (_) {}
        }
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    return;
  }

  // All models failed — fall back to JSON error response
  return res.status(500).json({ error: allErrors.join(' | '), allErrors });
}
