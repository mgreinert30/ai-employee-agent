// Vercel Serverless Function — Support chatbot powered by Gemini
export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };

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
- Preise: noch nicht öffentlich — Nutzer können Interesse bekunden
- Sprachen: Deutsch und Englisch umschaltbar (oben rechts)

Antworte immer auf Deutsch. Bleib freundlich, kurz (max. 3 Sätze) und hilfreich. Wenn du etwas nicht weißt, sage es ehrlich und bitte den Nutzer, den Betreiber zu kontaktieren.`;

const SYSTEM_EN = `You are a friendly support assistant for "AI Employee Agent" — an AI platform for small businesses.

What you know about the platform:
- AI Employee Agent analyzes business documents (PDFs, emails, websites, finances, competitors) using AI
- Users choose between two AI employees: Alex (professional & precise) or Emma (efficient & reliable)
- 5 services: PDF analysis, email analysis, website analysis, finance analysis, competitor analysis
- Analysis runs directly in the browser — no download needed, results exportable as PDF report
- GDPR-compliant: all uploaded data is deleted immediately after analysis
- Free account required (email + password) — sign up directly on the site
- Forgot password: reset via email
- Business colors and company name customizable for PDF reports (Owner Panel)
- Pricing: not yet public — users can express interest
- Languages: German and English (toggle top right)

Always reply in English. Stay friendly, brief (max. 3 sentences) and helpful. If you don't know something, say so honestly and suggest contacting the operator.`;

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

  const contents = [
    ...history.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: message }] }
  ];

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: 300, temperature: 0.6 }
      })
    }
  );

  if (!geminiRes.ok) {
    const err = await geminiRes.json().catch(() => ({}));
    return res.status(500).json({ error: err.error?.message || 'KI-Fehler' });
  }

  const data = await geminiRes.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
    ?? (lang === 'en' ? 'Sorry, I could not generate a response.' : 'Entschuldigung, ich konnte keine Antwort generieren.');

  return res.status(200).json({ reply });
}
