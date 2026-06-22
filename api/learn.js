// ─────────────────────────────────────────────────────────────────────────────
// Privacy-Preserving Learning System — Serverless API
// ─────────────────────────────────────────────────────────────────────────────
//
// SUPABASE SETUP — run once in Supabase SQL Editor:
//
// CREATE TABLE IF NOT EXISTS learnings (
//   id bigserial primary key,
//   task_type text,
//   insight text,
//   created_at timestamptz default now()
// );
// CREATE TABLE IF NOT EXISTS learning_signals (
//   id bigserial primary key,
//   task_category text not null,
//   outcome text not null,
//   issue_type text,
//   improvement_rule text,
//   strategy text,
//   quality_score int,
//   created_at timestamptz default now()
// );
// CREATE TABLE IF NOT EXISTS behavior_rules (
//   id bigserial primary key,
//   task_category text not null,
//   rule_text text not null,
//   confidence int default 1,
//   created_at timestamptz default now(),
//   updated_at timestamptz default now()
// );

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const GEMINI_KEY   = process.env.GEMINI_API_KEY;

// ── Privacy Filter ────────────────────────────────────────────────────────────
const PII_PATTERNS = [
  /\b[A-ZÄÖÜ][a-zäöü]{1,20}\s+[A-ZÄÖÜ][a-zäöü]{1,20}\b/,  // full names
  /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/i,                          // email
  /\b\+?[\d][\d\s\-\(\)]{6,14}[\d]\b/,                        // phone
  /\b\d{4,5}\b/,                                               // ZIP/PLZ
  /\b(Herr|Frau|Mr\.?|Mrs\.?|Dr\.?|Prof\.?)\s+[A-ZÄÖÜ]/,     // title + name
  /(Straße|Str\.|Weg|Platz|Allee|Gasse|Avenue)\s+\d/i,        // address
  /\b(IBAN|BIC|SEPA|Kontonummer)\b/i,                          // banking
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/,                  // card number
  /\b(geboren|birthdate|geburtsdatum|Steuer-?Nr|Steuernummer|Krankenkasse)\b/i,
  /\b(GmbH|AG|KG|e\.V\.|UG)\s+[A-ZÄÖÜ]/,                     // specific company names
];

function passesPrivacyFilter(text) {
  if (!text || typeof text !== 'string') return false;
  if (text.length > 300) return false;
  if (PII_PATTERNS.some(p => p.test(text))) return false;
  // Reject conversational first-person phrases
  if (/^(ich |wir |sie |er |sie hat|du |können Sie|bitte |danke )/i.test(text.trim())) return false;
  return true;
}

// ── Supabase Helpers ──────────────────────────────────────────────────────────
function sbHeaders() {
  return { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
}

async function sbGet(table, query = '') {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: sbHeaders() });
    if (!r.ok) return [];
    return r.json();
  } catch (_) { return []; }
}

async function sbInsert(table, row) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
      body: JSON.stringify(row),
    });
    return r.ok || r.status === 201;
  } catch (_) { return false; }
}

async function sbDeleteAll(table) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    // Supabase requires a filter for DELETE — use id > 0 to delete all rows
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=gt.0`, {
      method: 'DELETE',
      headers: sbHeaders(),
    });
    return r.ok;
  } catch (_) { return false; }
}

// ── Gemini helper with model fallback ────────────────────────────────────────
const LEARN_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-1.5-flash-002',
];

async function callGeminiJson(key, body) {
  for (const model of LEARN_MODELS) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );
      if (r.ok) return r;
      const status = r.status;
      if (status !== 404 && status !== 400 && status !== 503 && status !== 429) break;
    } catch (_) {}
  }
  return null;
}

// ── Insight Extractor (Gemini) ────────────────────────────────────────────────
async function extractInsights(resultText, taskType) {
  if (!GEMINI_KEY) return [];
  const prompt = `You are a privacy-safe quality-improvement system. From this AI analysis result, extract 2-3 GENERAL domain insights for improving future analyses.

STRICT PRIVACY RULES — ALL must be satisfied:
• NO names, people, companies, locations, countries
• NO numbers, dates, percentages, financial figures
• NO product names, brands, project names
• NO verbatim sentences from conversations or user input
• ONLY abstract patterns, structural best practices, domain methodology rules
• Each insight must be a reusable rule for future analyses
• Max 150 characters per insight

Return ONLY valid JSON array (no markdown, no explanation):
[{"insight": "...", "task_type": "${taskType || 'general'}"}]

RESULT TO ANALYSE:
${resultText.slice(0, 2000)}`;

  try {
    const r = await callGeminiJson(GEMINI_KEY, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 400, temperature: 0.1 },
    });
    if (!r) return [];
    const d = await r.json();
    const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = text.match(/\[[\s\S]*?\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch (_) { return []; }
}

// ── Rule Optimizer (derives behavior rules from accumulated signals) ───────────
async function deriveRulesFromSignals(signals) {
  if (!GEMINI_KEY || signals.length < 3) return [];
  const summary = signals.map(s =>
    `category=${s.task_category} outcome=${s.outcome} issue=${s.issue_type || '-'} rule="${s.improvement_rule || '-'}"`
  ).join('\n');

  const prompt = `You are a behavior rule optimizer. From these anonymous quality signals, derive 2-3 general improvement rules.

RULES FOR OUTPUT:
• Rules must be abstract behavioral guidelines — no specific data or names
• Each rule should be actionable and general enough for reuse
• Max 150 characters per rule

SIGNALS:
${summary}

Return ONLY valid JSON array (no markdown):
[{"rule": "...", "category": "general|pdf|email|report|contract|finance"}]`;

  try {
    const r = await callGeminiJson(GEMINI_KEY, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 300, temperature: 0.2 },
    });
    if (!r) return [];
    const d = await r.json();
    const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = text.match(/\[[\s\S]*?\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch (_) { return []; }
}

// ── Main Handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { action, type } = req.query || {};

  // ── GET ───────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json({ learnings: [], rules: [] });

    if (action === 'rules') {
      const rules = await sbGet('behavior_rules',
        type ? `task_category=eq.${encodeURIComponent(type)}&order=confidence.desc&limit=6`
             : `order=confidence.desc&limit=6`);
      return res.status(200).json({ rules: (rules || []).map(r => r.rule_text) });
    }

    if (action === 'stats') {
      const [insights, signals, rules] = await Promise.all([
        sbGet('learnings', 'select=id&limit=1000'),
        sbGet('learning_signals', 'select=id&limit=1000'),
        sbGet('behavior_rules', 'select=id&limit=1000'),
      ]);
      return res.status(200).json({
        insights: (insights || []).length,
        signals:  (signals  || []).length,
        rules:    (rules    || []).length,
      });
    }

    // Default: insights
    const learnings = await sbGet('learnings',
      type ? `task_type=eq.${encodeURIComponent(type)}&order=created_at.desc&limit=8`
           : `order=created_at.desc&limit=8`);
    return res.status(200).json({ learnings: learnings || [] });
  }

  // ── DELETE: reset all learning data ──────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json({ reset: false, reason: 'not_configured' });
    const [a, b, c] = await Promise.all([
      sbDeleteAll('learnings'),
      sbDeleteAll('learning_signals'),
      sbDeleteAll('behavior_rules'),
    ]);
    return res.status(200).json({ reset: a || b || c });
  }

  // ── POST ──────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json({ stored: false, reason: 'not_configured' });

    // POST ?action=signal — store structured privacy-safe learning signal
    if (action === 'signal') {
      const { signal } = req.body || {};
      if (!signal || typeof signal !== 'object') return res.status(400).json({ error: 'signal object required' });

      // Hard block on personal data flag
      if (signal.contains_personal_data === true) {
        return res.status(200).json({ stored: false, reason: 'personal_data_flagged' });
      }

      // Privacy filter — check all text fields
      const textFields = [signal.improvement_rule, signal.strategy, signal.task_category].filter(Boolean);
      for (const field of textFields) {
        if (!passesPrivacyFilter(field)) {
          return res.status(200).json({ stored: false, reason: 'privacy_filter_blocked', field });
        }
      }

      const row = {
        task_category:    String(signal.task_category || 'general').slice(0, 50),
        outcome:          String(signal.outcome || 'unclear').slice(0, 30),
        issue_type:       signal.issue_type    ? String(signal.issue_type).slice(0, 50)     : null,
        improvement_rule: signal.improvement_rule ? String(signal.improvement_rule).slice(0, 200) : null,
        strategy:         signal.strategy      ? String(signal.strategy).slice(0, 100)      : null,
        quality_score:    typeof signal.quality_score === 'number'
                            ? Math.min(5, Math.max(1, Math.round(signal.quality_score))) : null,
      };

      const stored = await sbInsert('learning_signals', row);

      // Periodically run Rule Optimizer (every 5 new signals)
      if (stored) {
        const recentSignals = await sbGet('learning_signals', 'order=created_at.desc&limit=10');
        if (recentSignals.length >= 5 && recentSignals.length % 5 === 0) {
          const newRules = await deriveRulesFromSignals(recentSignals);
          for (const r of newRules) {
            if (!r.rule || !passesPrivacyFilter(r.rule)) continue;
            await sbInsert('behavior_rules', {
              task_category: String(r.category || 'general').slice(0, 50),
              rule_text:     r.rule.slice(0, 200),
            });
          }
        }
      }

      return res.status(200).json({ stored });
    }

    // POST (default) — extract domain insights from completed result
    const { result, taskType } = req.body || {};
    if (!result || typeof result !== 'string') return res.status(400).json({ error: 'result string required' });
    if (!GEMINI_KEY) return res.status(200).json({ stored: false, reason: 'gemini_not_configured' });

    const insights = await extractInsights(result, taskType);
    let count = 0;
    for (const ins of insights) {
      if (!ins.insight || ins.insight.length < 10) continue;
      if (!passesPrivacyFilter(ins.insight)) continue; // double-check
      const ok = await sbInsert('learnings', {
        task_type: String(ins.task_type || taskType || 'general').slice(0, 50),
        insight:   ins.insight.slice(0, 500),
      });
      if (ok) count++;
    }
    return res.status(200).json({ stored: count > 0, count });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
