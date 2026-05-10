// Vercel Serverless Function — Gemini Real Estate Valuation
export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
};

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

function buildPrompt(property) {
  const {
    region, stadt, plz, typ, modus,
    flaeche, grundstueck, zimmer, baujahr, zustand,
    ausstattung, energieklasse, etage, moebliert,
  } = property;

  const ausstattungText = Array.isArray(ausstattung) && ausstattung.length > 0
    ? ausstattung.join(', ')
    : 'keine besonderen Merkmale';

  return `Du bist ein erfahrener Immobiliengutachter und Marktanalyst für den deutschen Immobilienmarkt.
Analysiere die folgende Immobilie und erstelle eine fundierte Marktbewertung.

IMMOBILIEN-DATEN:
- Typ: ${typ || 'Wohnung'}
- Modus: ${modus || 'Kaufen'}
- Region/Lage: ${region || 'nicht angegeben'}
- Stadt: ${stadt || 'nicht angegeben'}
- PLZ: ${plz || 'nicht angegeben'}
- Wohnfläche: ${flaeche ? flaeche + ' m²' : 'nicht angegeben'}
- Grundstücksfläche: ${grundstueck ? grundstueck + ' m²' : 'nicht zutreffend'}
- Zimmer: ${zimmer || 'nicht angegeben'}
- Baujahr: ${baujahr || 'nicht angegeben'}
- Zustand: ${zustand || 'nicht angegeben'}
- Ausstattung: ${ausstattungText}
- Energieklasse: ${energieklasse || 'nicht angegeben'}
- Etage: ${etage !== undefined && etage !== '' ? etage : 'nicht angegeben'}
- Möbliert: ${moebliert ? 'Ja' : 'Nein'}

Basiere deine Analyse auf aktuellen deutschen Immobilienmarktdaten (2024/2025), typischen Preisen für die Region und alle angegebenen Eigenschaften.

Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt ohne Markdown-Formatierung, ohne Codeblöcke, ohne Erklärungen davor oder danach. Nur das reine JSON:

{
  "marktWert": {
    "min": <untere Schätzung in EUR als Zahl>,
    "max": <obere Schätzung in EUR als Zahl>,
    "median": <wahrscheinlichster Wert in EUR als Zahl>,
    "qmPreis": <Preis pro m² in EUR als Zahl>
  },
  "mietWert": {
    "min": <monatliche Kaltmiete min in EUR als Zahl>,
    "max": <monatliche Kaltmiete max in EUR als Zahl>,
    "qmMiete": <Miete pro m² in EUR als Zahl>
  },
  "scores": {
    "investition": <Investitionspotenzial 0-100 als Zahl>,
    "lage": <Lage-Score 0-100 als Zahl>,
    "zukunft": <Zukunftspotenzial 0-100 als Zahl>,
    "gesamt": <Gesamtscore 0-100 als Zahl>
  },
  "insights": [
    "<konkrete Erkenntnis 1>",
    "<konkrete Erkenntnis 2>",
    "<konkrete Erkenntnis 3>",
    "<konkrete Erkenntnis 4>"
  ],
  "risiken": [
    "<konkretes Risiko 1>",
    "<konkretes Risiko 2>",
    "<konkretes Risiko 3>"
  ],
  "chancen": [
    "<konkrete Chance 1>",
    "<konkrete Chance 2>",
    "<konkrete Chance 3>"
  ],
  "bericht": {
    "zusammenfassung": "<2-3 Sätze Gesamtbewertung>",
    "lageAnalyse": "<detaillierte Analyse der Lage, Infrastruktur, Nachbarschaft>",
    "marktAnalyse": "<Markttrends, Vergleichspreise, Nachfrage in der Region>",
    "zustandsBewertung": "<Bewertung von Baujahr, Zustand, Ausstattung, Energieeffizienz>",
    "empfehlung": "<konkrete Kauf-/Miet-/Investitionsempfehlung>"
  },
  "vergleich": {
    "stadtDurchschnitt": <durchschnittlicher Kaufpreis pro m² in der Stadt als Zahl>,
    "trend": <jährliche Preisentwicklung in % als Zahl, z.B. 3.2>,
    "nachfrage": "<hoch|mittel|niedrig>"
  }
}`;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY nicht konfiguriert' });
  }

  const { property } = req.body || {};
  if (!property || typeof property !== 'object') {
    return res.status(400).json({ error: 'property-Objekt erforderlich' });
  }

  const prompt = buildPrompt(property);

  const geminiBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: 0.2,
      topP: 0.9,
      topK: 40,
    },
  });

  const allErrors = [];

  for (const model of MODELS) {
    let geminiRes;
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: geminiBody,
      });
    } catch (fetchErr) {
      allErrors.push(`${model}: Netzwerkfehler — ${fetchErr.message}`);
      continue;
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => '');
      allErrors.push(`${model}: HTTP ${geminiRes.status} — ${errText.slice(0, 200)}`);
      continue;
    }

    let geminiData;
    try {
      geminiData = await geminiRes.json();
    } catch (parseErr) {
      allErrors.push(`${model}: JSON-Parse-Fehler — ${parseErr.message}`);
      continue;
    }

    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!rawText) {
      allErrors.push(`${model}: Leere Antwort von Gemini`);
      continue;
    }

    // Extract JSON from response — strip markdown code blocks if present
    let jsonText = rawText.trim();
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (jsonErr) {
      // Try to find JSON object in the text
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          allErrors.push(`${model}: Konnte JSON nicht parsen — ${jsonErr.message}`);
          continue;
        }
      } else {
        allErrors.push(`${model}: Kein JSON in Antwort gefunden`);
        continue;
      }
    }

    return res.status(200).json({
      ...parsed,
      _meta: { model, property: { stadt: property.stadt, typ: property.typ } },
    });
  }

  return res.status(500).json({
    error: `Alle Gemini-Modelle fehlgeschlagen: ${allErrors.join(' | ')}`,
  });
}
