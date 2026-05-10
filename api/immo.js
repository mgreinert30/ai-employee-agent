// Vercel Serverless Function — Gemini Real Estate Valuation (DE)
export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
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
Beziehe alle relevanten Datenquellen ein: BORIS-Bodenrichtwerte für die Region, den gültigen Mietspiegel, aktuelle ImmoScout24/Immowelt-Vergleichspreise und den Bundesbank-Immobilienpreisindikator.
Berücksichtige: Makrolage (Stadtgröße, Wirtschaftsstärke), Mikrolage (Stadtteil, Infrastruktur), Objekteigenschaften (Baujahr, Zustand, Ausstattung, Energieklasse) und aktuelle Marktdynamik.
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
    "min": <monatliche Kaltmiete min in EUR als Zahl>,
    "max": <monatliche Kaltmiete max in EUR als Zahl>,
    "qmMiete": <Kaltmiete pro m² in EUR als Zahl>,
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
      "entfernung": "<geschätzte Entfernung, z.B. '500m' oder '1,2km'>",
      "zustand": "<Zustand des Vergleichsobjekts>"
    },
    { "typ": "", "flaeche": 0, "preis": 0, "qmPreis": 0, "entfernung": "", "zustand": "" },
    { "typ": "", "flaeche": 0, "preis": 0, "qmPreis": 0, "entfernung": "", "zustand": "" }
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
    "lageAnalyse": "<detaillierte Analyse: Makrolage, Mikrolage, Stadtteil, Infrastruktur, Nahverkehr, Umgebung>",
    "marktAnalyse": "<aktuelle Marktlage: Preisindex, Vergleichspreise, BORIS-Werte, Mietspiegel, Angebot/Nachfrage>",
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

  const geminiBody = JSON.stringify({
    contents: [{ parts }],
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

    // Strip markdown code fences if present
    let jsonText = rawText.trim();
    const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonText = fenceMatch[1].trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      // Try to extract JSON object from surrounding text
      const objMatch = jsonText.match(/\{[\s\S]*\}/);
      if (objMatch) {
        try {
          parsed = JSON.parse(objMatch[0]);
        } catch (innerErr) {
          allErrors.push(`${model}: JSON-Parse fehlgeschlagen — ${innerErr.message}`);
          continue;
        }
      } else {
        allErrors.push(`${model}: Kein JSON-Objekt in Antwort gefunden`);
        continue;
      }
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
