// Vercel Serverless Function — Support chatbot powered by Gemini
export const config = { api: { bodyParser: { sizeLimit: '32kb' } } };

const MODELS = ['gemini-2.5-flash', 'gemini-flash-latest'];

const SYSTEM_DE = `Du bist ein freundlicher Support-Assistent für "AI Employee Agent" — eine KI-Plattform für kleine Unternehmen.

Was du über die Plattform weißt:
- AI Employee Agent analysiert Geschäftsdokumente (PDFs, E-Mails, Webseiten, Finanzdaten, Wettbewerb) mit KI
- Nutzer wählen zwischen zwei KI-Mitarbeitern: Alex (professionell & präzise) oder Emma (effizient & zuverlässig)
- Es gibt 5 Dienste: PDF-Analyse, E-Mail-Analyse, Website-Analyse, Finanzanalyse, Wettbewerbsanalyse
- Analyse läuft direkt im Browser — kein Download nötig, Ergebnis als PDF-Bericht downloadbar
- DSGVO-konform: alle hochgeladenen Daten werden nach der Analyse sofort gelöscht
- Kostenloser Account nötig (E-Mail + Passwort) — Anmeldung direkt auf der Seite
- Passwort vergessen: per E-Mail zurücksetzen möglich
- Geschäftsfarben und Firmenname für den PDF-Bericht einstellbar (Owner-Panel)
- Preise: noch nicht öffentlich
- Sprachen: Deutsch und Englisch umschaltbar (oben rechts)

Antworte immer auf Deutsch. Bleib freundlich, kurz (max. 3 Sätze) und hilfreich.`;

const SYSTEM_EN = `You are a friendly support assistant for "AI Employee Agent" — an AI platform for small businesses.

What you know:
- Analyzes business documents (PDFs, emails, websites, finances, competitors) using AI
- Two AI employees: Alex (professional & precise) or Emma (efficient & reliable)
- 5 services: PDF, email, website, finance, competitor analysis
- Runs in the browser, results exportable as PDF report
- GDPR-compliant: data deleted after analysis
- Free account required (email + password)
- Password reset via email
- Business colors/name customizable in Owner Panel
- Pricing: not yet public

Always reply in English. Stay friendly, brief (max. 3 sentences), and helpful.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, history = [], lang = 'de' } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Keine Nachricht' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'KI nicht konfiguriert' });

  const systemPrompt = lang === 'en' ? SYSTEM_EN : SYSTEM_DE;

  // Build conversation: inject system prompt into the first user turn
  const historyParts = history.map(h => ({
    role: h.role === 'model' ? 'model' : 'user',
    parts: [{ text: h.text }]
  }));

  const firstUserText = historyParts.length === 0
    ? `${systemPrompt}\n\n---\nNutzer: ${message}`
    : message;

  const contents = historyParts.length === 0
    ? [{ role: 'user', parts: [{ text: firstUserText }] }]
    : [...historyParts, { role: 'user', parts: [{ text: message }] }];

  const allErrors = [];

  for (const model of MODELS) {
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: { maxOutputTokens: 400, temperature: 0.7 }
          })
        }
      );

      let data;
      try { data = await geminiRes.json(); } catch (_) {
        allErrors.push(`[${model}] kein JSON`); continue;
      }

      if (!geminiRes.ok || data.error) {
        allErrors.push(`[${model}] ${data.error?.message || geminiRes.status}`); continue;
      }

      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply) { allErrors.push(`[${model}] leere Antwort`); continue; }

      return res.status(200).json({ reply });

    } catch (err) {
      allErrors.push(`[${model}] ${err.message}`);
    }
  }

  return res.status(500).json({ error: allErrors.join(' | ') });
}
