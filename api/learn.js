// Serverless learning store — extracts non-sensitive domain insights via Gemini,
// persists them in Supabase, and injects them into future analyses as context.
// Degrades gracefully: if Supabase env vars are absent, returns empty learnings.

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_ANON_KEY;
const GEMINI_KEY    = process.env.GEMINI_API_KEY;

function supabaseHeaders() {
  return { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
}

async function getRecentLearnings(taskType) {
  const filter = taskType
    ? `task_type=eq.${encodeURIComponent(taskType)}&order=created_at.desc&limit=8`
    : `order=created_at.desc&limit=8`;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/learnings?${filter}`, { headers: supabaseHeaders() });
  if (!r.ok) return [];
  return r.json();
}

async function extractInsights(resultText) {
  const prompt = `You are a quality-improvement system. From the AI analysis result below, extract 2–3 GENERAL, NON-SENSITIVE domain insights that could improve future similar analyses.

STRICT RULES — VIOLATIONS DISQUALIFY THE INSIGHT:
• NO names, companies, countries, job titles, or people
• NO financial figures, dates, percentages, or specific numbers
• NO product names, brands, or project names
• ONLY general patterns, best practices, or domain-level knowledge

Return ONLY a valid JSON array (no markdown, no explanation):
[{"insight": "...", "task_type": "general|pdf|email|report|contract|finance"}]

ANALYSIS RESULT:
${resultText.slice(0, 2500)}`;

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 400, temperature: 0.1 },
      }),
    }
  );
  if (!r.ok) return [];
  const d = await r.json();
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
  try {
    const match = text.match(/\[[\s\S]*?\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch (_) { return []; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // GET — retrieve learnings for a task type to inject as context
  if (req.method === 'GET') {
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json({ learnings: [] });
    try {
      const learnings = await getRecentLearnings(req.query.type || null);
      return res.status(200).json({ learnings });
    } catch (_) {
      return res.status(200).json({ learnings: [] });
    }
  }

  // POST — extract insights from a completed analysis and store them
  if (req.method === 'POST') {
    if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) {
      return res.status(200).json({ stored: false, reason: 'not configured' });
    }

    const { result, taskType } = req.body || {};
    if (!result || typeof result !== 'string') {
      return res.status(400).json({ error: 'result (string) required' });
    }

    const insights = await extractInsights(result);
    if (!insights.length) return res.status(200).json({ stored: false, reason: 'no insights' });

    let count = 0;
    for (const ins of insights) {
      if (!ins.insight || ins.insight.length < 10) continue;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/learnings`, {
        method: 'POST',
        headers: { ...supabaseHeaders(), 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          task_type: ins.task_type || taskType || 'general',
          insight: ins.insight.slice(0, 500),
        }),
      });
      if (r.ok || r.status === 201) count++;
    }

    return res.status(200).json({ stored: count > 0, count });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
