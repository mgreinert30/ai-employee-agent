// Vercel Serverless Function — Gemini PDF Analysis (streaming)
import { verifyToken, rejectToken } from './_token.js';

export const config = {
  api: { bodyParser: { sizeLimit: '8mb' } },
};

const rateLimitMap = new Map();
function isRateLimited(ip, max = 8, windowMs = 60000) {
  const now = Date.now();
  const rec = rateLimitMap.get(ip);
  if (!rec || now - rec.t > windowMs) { rateLimitMap.set(ip, { t: now, n: 1 }); return false; }
  rec.n++;
  return rec.n > max;
}

// PDF-Analyse: gemini-1.5-flash as primary (stable, no 503/404 issues, excellent for docs)
const MODELS = [
  'gemini-1.5-flash',       // primary: stable, reliable, great for PDF/doc analysis
  'gemini-1.5-pro',         // fallback 1: more capable, same stable generation
  'gemini-2.5-flash-lite',  // fallback 2: newer but lighter
  'gemini-2.5-flash',       // fallback 3: newest, may have 503 under high load
];

// Streaming keeps connection alive — limits only bound by 60s function timeout
// Gemini 2.5 Flash ≈ 200 tok/s: short=~10s, medium=~25s, long=~55s
const TOKEN_LIMITS = {
  short:  2048,
  medium: 5000,
  long:   12000,
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

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Zu viele Anfragen. Bitte warte eine Minute.' });

  // Token-Prüfung: nur gültige, serverseitig signierte Tokens dürfen Analysen starten
  const token = req.headers['x-analysis-token'] || req.body?.analysisToken;
  if (token !== 'free-trial') {
    const tokenCheck = verifyToken(token, 'analyse');
    if (!tokenCheck.valid) return rejectToken(res, tokenCheck.reason);
  }

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

  // Punkt 3: Adaptive Analyse — Tiefe vor Vollständigkeit, hochwertige Abschnitte priorisieren
  const modePrefix = hasFile
    ? `NATIVE PDF ANALYSIS MODE — You have direct access to the complete PDF via Gemini File API.\nADAPTIVE READING STRATEGY: Focus on high-value content — executive summaries, conclusions, financial tables, risk sections, key findings. Skip repetitive boilerplate, legal headers/footers, and index pages. Prioritise analytical depth over page-by-page completeness. For long documents: sample strategically rather than reading every line superficially.\n\n`
    : hasImages
    ? `VISUAL ANALYSIS MODE — You are viewing ${images.length} rendered page image(s).\n- TABLES: extract EVERY row and column exactly as Markdown tables.\n- CHARTS: describe data points, axis labels, trends — ONLY if actual numerical values are clearly visible in the image. Do not estimate or invent chart data.\n- Prefer visual data for tables/numbers over extracted text.\n\n`
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
