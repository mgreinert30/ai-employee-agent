// Vercel Serverless Function — Gemini Real Estate Valuation (DE)
export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

const MODELS = [
  { name: 'gemini-2.5-flash',      api: 'v1beta' },
  { name: 'gemini-2.5-flash-lite', api: 'v1beta' },
  { name: 'gemini-2.5-pro',        api: 'v1beta' },
];

function buildPrompt(property) {
  const {
    region, stadt, plz, typ, modus,
    flaeche, grundstueck, zimmer, baujahr, renovierung,
    zustand, ausstattung, ausstattungsqualitaet, energieklasse,
    etagen, etage, heiztechnik, moebliert,
    balkon, garten, garage, aufzug, keller, kueche,
    smarthome, fussboden, dachterrasse, pool,
  } = property;

  const ausstattungText = Array.isArray(ausstattung) && ausstattung.length > 0
    ? ausstattung.join(', ')
    : 'keine besonderen Merkmale';

  return `Du bist ein führender KI-Immobiliengutachter in Deutschland mit umfassendem Wissen über aktuelle Bodenrichtwerte (BORIS), Mietspiegel, Gutachterausschuss-Berichte, Bundesbank-Immobilienpreisindikator, Destatis-Statistiken, BBSR/INKAR Regionaldaten und aktuelle Marktdaten von ImmoScout24, Immowelt und Immonet. Nutze dein Wissen über aktuelle Bodenrichtwerte (BORIS), Mietspiegel, Gutachterausschuss-Berichte und aktuelle Marktdaten von ImmoScout24/Immowelt für diese Bewertung.

Dein Wissen umfasst folgende deutsche Immobiliendatenquellen:
- BORIS Deutschland (Bodenrichtwerte) — offizielle Bodenrichtwerte der Bundesländer
- Gutachterausschüsse (Grundstücksmarktberichte) — offizielle Marktberichte der regionalen Ausschüsse
- Mietspiegel der jeweiligen Stadt — qualifizierte und einfache Mietspiegel
- Destatis (Statistisches Bundesamt) — Immobilienpreisindizes, Baufertigstellungen
- Bundesbank Immobilienpreisindikator — Überbewertungsanalysen, Preistrends
- BBSR/INKAR Regionaldaten — Raumordnung, Bevölkerungsentwicklung, Lagetypen
- ImmoScout24, Immowelt, Immonet — aktuelle Angebots- und Nachfragepreise
- Bevölkerungsentwicklung und Demografie — Wachstum/Schrumpfung der Region
- Infrastrukturanalysen — ÖPNV, Schulen, Ärzte, Einkaufsmöglichkeiten
- Lärmkarten und Umweltrisiken — EU-Umgebungslärmrichtlinie, Hochwassergefahrenkarten
- Bauaktivität und Baugenehmigungen — regionales Angebot, Neubauquote

IMMOBILIEN-DATEN ZUR BEWERTUNG:
- Typ: ${typ || 'Wohnung'}
- Modus: ${modus || 'Kaufen'}
- Region/Lage: ${region || 'nicht angegeben'}
- Stadt: ${stadt || 'nicht angegeben'}
- PLZ: ${plz || 'nicht angegeben'}
- Wohnfläche: ${flaeche ? flaeche + ' m²' : 'nicht angegeben'}
- Grundstücksfläche: ${grundstueck ? grundstueck + ' m²' : 'nicht zutreffend'}
- Zimmer: ${zimmer || 'nicht angegeben'}
- Baujahr: ${baujahr || 'nicht angegeben'}
- Letzte Renovierung: ${renovierung || 'nicht angegeben'}
- Zustand: ${zustand || 'nicht angegeben'}
- Ausstattungsqualität: ${ausstattungsqualitaet || 'Standard'}
- Ausstattung: ${ausstattungText}
- Energieklasse: ${energieklasse || 'nicht angegeben'}
- Etagen im Gebäude: ${etagen || 'nicht angegeben'}
- Eigene Etage: ${etage !== undefined && etage !== '' ? etage : 'nicht angegeben'}
- Heiztechnik: ${heiztechnik || 'nicht angegeben'}
- Möbliert: ${moebliert ? 'Ja' : 'Nein'}

BEWERTUNGSAUFGABE:
Analysiere diese Immobilie auf Basis deines umfassenden Wissens über den deutschen Immobilienmarkt (Stand 2025).

LAGEANALYSE (sehr wichtig):
Beschreibe die Mikrolage präzise: Ist die Immobilie in der Innenstadt, am Wasser (Fluss, See, Meer, Kanal), in einer Villengegend, am Stadtrand, in einem Industrie-Quartier, neben Grünflächen, in einer Fußgängerzone oder Einkaufsstraße? Nenne konkrete Merkmale der unmittelbaren Umgebung und wie diese den Wert beeinflussen. Verwende den BORIS-Bodenrichtwert für exakt diese Lage (Straße/Stadtteil/PLZ), nicht nur den Stadtdurchschnitt.

MIETPREISE (sehr wichtig):
Gib min und max der Kaltmiete pro m² basierend auf dem qualifizierten Mietspiegel der Stadt für diese Lage, Baujahr, Ausstattungsqualität und Etage. Trenne dabei deutlich: einfache Lage vs. gute Lage vs. sehr gute Lage. Nutze die offizielle Mietspiegeltabelle, nicht nur Durchschnittswerte.

VERGLEICHSOBJEKTE (sehr wichtig):
Nenne ausschließlich Vergleichsobjekte im Umkreis von maximal 500 Metern oder direkt auf der gleichen Straße. Bevorzuge Objekte in der gleichen Straße oder im gleichen Straßenblock. Wenn keine bekannten Objekte auf der gleichen Straße vorhanden sind, wähle die nächstgelegenen innerhalb 500m. Gib für jedes Objekt die tatsächliche Entfernung an (z.B. "gleiche Straße", "120m", "350m").

Beziehe alle relevanten Datenquellen ein: BORIS-Bodenrichtwerte für exakt diese PLZ/Straße, Mietspiegel (Tabellenwerte), aktuelle ImmoScout24/Immowelt-Vergleichspreise und den Bundesbank-Immobilienpreisindikator.
Berücksichtige: Makrolage (Stadtgröße, Wirtschaftsstärke), Mikrolage (Stadtteil, Wasserlagen, Parknähe, Infrastruktur), Objekteigenschaften (Baujahr, Zustand, Ausstattung, Energieklasse) und aktuelle Marktdynamik.
${ausstattung && ausstattung.length > 0 ? `Berücksichtige bei der Bewertung besonders diese Ausstattungsmerkmale: ${ausstattungText}.` : ''}

Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt. Kein Markdown, keine Codeblöcke, keine Erklärungen. Nur das reine JSON-Objekt:

{
  "marktWert": {
    "min": <untere Schätzung in EUR als Zahl>,
    "max": <obere Schätzung in EUR als Zahl>,
    "median": <wahrscheinlichster Marktwert in EUR als Zahl>,
    "qmPreis": <Kaufpreis pro m² in EUR als Zahl>
  },
  "mietWert": {
    "min": <monatliche Kaltmiete min in EUR laut Mietspiegel-Untergrenze für diese Lage/Baujahr/Ausstattung als Zahl>,
    "max": <monatliche Kaltmiete max in EUR laut Mietspiegel-Obergrenze für diese Lage/Baujahr/Ausstattung als Zahl>,
    "qmMiete": <mittlerer Mietspiegel-Wert Kaltmiete pro m² für diese konkrete Lage als Zahl>,
    "qmMin": <Mietspiegel-Untergrenze pro m² für diese Lage als Zahl>,
    "qmMax": <Mietspiegel-Obergrenze pro m² für diese Lage als Zahl>,
    "bruttoRendite": <Bruttomietrendite in % als Zahl, z.B. 4.2>
  },
  "scores": {
    "investition": <Investitionspotenzial 0-100 als Zahl>,
    "lage": <Lage-Score 0-100 als Zahl>,
    "zukunft": <Zukunftspotenzial 0-100 als Zahl>,
    "gesamt": <Gesamtscore 0-100 als Zahl>,
    "confidence": <KI-Sicherheit der Schätzung 0-100 als Zahl>,
    "lageDetails": {
      "nahverkehr": <ÖPNV-Score 0-100 als Zahl>,
      "schulen": <Schulen/Bildung-Score 0-100 als Zahl>,
      "einkaufen": <Einkaufsmöglichkeiten-Score 0-100 als Zahl>,
      "gesundheit": <Gesundheitsversorgung-Score 0-100 als Zahl>,
      "gruenflaechen": <Grünflächen/Natur-Score 0-100 als Zahl>,
      "laerm": <Lärmbelastung-Score 0-100 als Zahl — 100 = ruhig, 0 = laut>,
      "sicherheit": <Sicherheits-Score 0-100 als Zahl>,
      "infrastruktur": <Gesamtinfrastruktur-Score 0-100 als Zahl>
    }
  },
  "prognose": {
    "ein_jahr": <erwartete Preisentwicklung in % nach 1 Jahr als Zahl, z.B. 2.5>,
    "drei_jahre": <kumulierte Preisentwicklung in % nach 3 Jahren als Zahl>,
    "fuenf_jahre": <kumulierte Preisentwicklung in % nach 5 Jahren als Zahl>
  },
  "renovierung": {
    "kosten_min": <minimale Renovierungskosten in EUR als Zahl, 0 wenn nicht nötig>,
    "kosten_max": <maximale Renovierungskosten in EUR als Zahl, 0 wenn nicht nötig>,
    "empfehlung": "<konkrete Renovierungsempfehlung oder 'Kein Renovierungsbedarf' als Text>"
  },
  "vergleich": {
    "stadtDurchschnitt": <durchschnittlicher Kaufpreis pro m² in der Stadt als Zahl>,
    "stadteilDurchschnitt": <durchschnittlicher Kaufpreis pro m² im Stadtteil als Zahl>,
    "trend": <jährliche Preisentwicklung in % als Zahl, z.B. 3.2>,
    "nachfrage": "<hoch|mittel|niedrig>"
  },
  "vergleichsobjekte": [
    {
      "typ": "<Objekttyp als Text>",
      "flaeche": <Wohnfläche in m² als Zahl>,
      "preis": <Kaufpreis in EUR als Zahl>,
      "qmPreis": <Preis pro m² als Zahl>,
      "entfernung": "<exakte Entfernung: 'gleiche Straße', '80m', '250m' oder max. '500m'>",
      "strasse": "<Straßenname des Vergleichsobjekts oder 'selbe Straße'>",
      "zustand": "<Zustand des Vergleichsobjekts>"
    },
    { "typ": "", "flaeche": 0, "preis": 0, "qmPreis": 0, "entfernung": "", "strasse": "", "zustand": "" },
    { "typ": "", "flaeche": 0, "preis": 0, "qmPreis": 0, "entfernung": "", "strasse": "", "zustand": "" }
  ],
  "insights": [
    "<konkrete KI-Erkenntnis 1 zur Immobilie/Lage>",
    "<konkrete KI-Erkenntnis 2 zu Markt/Rendite>",
    "<konkrete KI-Erkenntnis 3 zu Risiken/Chancen>",
    "<konkrete KI-Erkenntnis 4 zu Zukunft/Prognose>"
  ],
  "risiken": [
    { "titel": "<kurzer Risikotitel>", "beschreibung": "<detaillierte Beschreibung>", "schwere": "<niedrig|mittel|hoch>" },
    { "titel": "", "beschreibung": "", "schwere": "niedrig" },
    { "titel": "", "beschreibung": "", "schwere": "niedrig" }
  ],
  "chancen": [
    { "titel": "<kurzer Chancen-Titel>", "beschreibung": "<detaillierte Beschreibung>", "potenzial": "<niedrig|mittel|hoch>" },
    { "titel": "", "beschreibung": "", "potenzial": "mittel" },
    { "titel": "", "beschreibung": "", "potenzial": "mittel" }
  ],
  "bildAnalyse": {
    "zustand": "<Zustandsbewertung aus Fotos oder 'Keine Fotos vorhanden'>",
    "modernitaet": <Modernitätsscore 0-100 als Zahl, 0 wenn keine Fotos>,
    "renovierungsbedarf": "<Renovierungsbedarf aus Fotos oder 'Nicht beurteilbar'>",
    "stilbewertung": "<Stilbeschreibung aus Fotos oder 'Keine Fotos vorhanden'>"
  },
  "bericht": {
    "zusammenfassung": "<2-3 Sätze: Gesamtbewertung der Immobilie>",
    "lageAnalyse": "<detaillierte Analyse: Makrolage (Stadt, Wirtschaft), Mikrolage (Stadtteil, Straße, unmittelbare Umgebung: Wasserlage/Innenstadt/Villenviertel/Grünfläche/etc.), Infrastruktur, ÖPNV, BORIS-Bodenrichtwert für genau diese PLZ/Lage>",
    "marktAnalyse": "<aktuelle Marktlage: BORIS-Wert für diese PLZ, Mietspiegel-Tabellenwerte (min/max/m²) für diese Lage und Ausstattungsklasse, aktuelle ImmoScout24/Immowelt-Vergleichspreise in 500m Umkreis, Bundesbank-Indikator, Angebot/Nachfrage>",
    "zustandsBewertung": "<Baujahr, Zustand, Ausstattungsqualität, Energieklasse, technische Einschätzung>",
    "investitionsAnalyse": "<Renditeberechnung, Cashflow-Einschätzung, Finanzierungsüberlegungen>",
    "empfehlung": "<konkrete Handlungsempfehlung: Kaufen/Verkaufen/Halten/Mieten + Begründung + Verhandlungsspielraum>"
  },
  "quellen": [
    "BORIS Deutschland",
    "Mietspiegel ${stadt || '[Stadt]'}",
    "ImmoScout24 Marktdaten",
    "Immowelt Angebotspreise",
    "Destatis Immobilienpreisindex",
    "Bundesbank Immobilienpreisindikator",
    "Gutachterausschuss ${region || stadt || '[Region]'}",
    "BBSR Regionaldaten"
  ]
}`;
}

function repairAndParseJSON(raw) {
  let s = raw.trim();

  // Strip markdown code fences (including nested)
  s = s.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();

  // Extract outermost { ... }
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Kein JSON-Objekt gefunden');
  s = s.slice(start, end + 1);

  // Remove JS-style single-line comments
  s = s.replace(/\/\/[^\n]*/g, '');
  // Remove JS-style block comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  // Replace unfilled angle-bracket placeholders with safe defaults
  s = s.replace(/:\s*<[^>]+als Zahl[^>]*>/g, ': 0');
  s = s.replace(/:\s*<[^>]+als Text[^>]*>/g, ': ""');
  s = s.replace(/:\s*<[^>]*>/g, ': ""');
  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');

  return JSON.parse(s);
}

export default async function handler(req, res) {
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

  const { property, images } = req.body || {};
  if (!property || typeof property !== 'object') {
    return res.status(400).json({ error: 'property-Objekt erforderlich' });
  }

  const prompt = buildPrompt(property);

  // Build parts array — include images if provided
  const hasImages = Array.isArray(images) && images.length > 0;
  const parts = hasImages
    ? [
        ...images.slice(0, 3).map(b64 => ({
          inlineData: { mimeType: 'image/jpeg', data: b64 },
        })),
        { text: prompt },
      ]
    : [{ text: prompt }];

  const allErrors = [];

  for (const { name: model, api } of MODELS) {
    const geminiBody = JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.2,
        topP: 0.9,
        topK: 40,
        // Disable thinking tokens — they corrupt JSON output in 2.5 models
        ...(model.includes('2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    });

    let geminiRes;
    try {
      const url = `https://generativelanguage.googleapis.com/${api}/models/${model}:generateContent?key=${apiKey}`;
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

    let parsed;
    try {
      parsed = repairAndParseJSON(rawText);
    } catch (err) {
      allErrors.push(`${model}: JSON-Parse fehlgeschlagen — ${err.message}`);
      continue;
    }

    return res.status(200).json({
      ...parsed,
      _meta: {
        model,
        hasImages: hasImages ? images.length : 0,
        property: { stadt: property.stadt, typ: property.typ, flaeche: property.flaeche },
      },
    });
  }

  return res.status(500).json({
    error: `Alle Gemini-Modelle fehlgeschlagen: ${allErrors.join(' | ')}`,
  });
}
