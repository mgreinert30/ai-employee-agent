// Vercel Serverless Function — Gemini Real Estate Valuation (DE)
export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

const MODELS = [
  { name: 'gemini-2.5-flash',      api: 'v1beta', thinkingBudget: 0   },
  { name: 'gemini-2.5-flash-lite', api: 'v1beta', thinkingBudget: 0   },
  { name: 'gemini-2.5-pro',        api: 'v1beta', thinkingBudget: 1024 },
  { name: 'gemini-1.5-flash',      api: 'v1beta', thinkingBudget: null },
];

function buildPrompt(property) {
  const {
    strasse, region, stadt, plz, typ, modus,
    flaeche, grundstueck, zimmer, baujahr, renovierung,
    zustand, ausstattung, ausstattungsqualitaet, energieklasse,
    etagen, etage, heiztechnik, moebliert,
    balkon, garten, garage, aufzug, keller, kueche,
    smarthome, fussboden, dachterrasse, pool,
  } = property;

  const ausstattungText = Array.isArray(ausstattung) && ausstattung.length > 0
    ? ausstattung.join(', ')
    : 'keine besonderen Merkmale';

  return `Du bist ein führender KI-Immobiliengutachter in Deutschland mit umfassendem Wissen über Bodenrichtwerte (BORIS), Mietspiegel, Gutachterausschuss-Berichte, Bundesbank-Immobilienpreisindikator, Destatis-Statistiken, BBSR/INKAR Regionaldaten, Sprengnetter-Bewertungsansätze und aktuelle Marktdaten von ImmoScout24, Immowelt und Immonet.

Dein Wissen umfasst folgende deutsche Immobiliendatenquellen:
- BORIS Deutschland (Bodenrichtwerte) — offizielle Bodenrichtwerte der Bundesländer
- Gutachterausschüsse (Grundstücksmarktberichte) — offizielle Marktberichte der regionalen Ausschüsse
- Mietspiegel der jeweiligen Stadt — qualifizierte und einfache Mietspiegel (Tabellenwerte nach Lage/Baujahr/Ausstattung)
- Destatis (Statistisches Bundesamt) — Immobilienpreisindizes, Baufertigstellungen
- Bundesbank Immobilienpreisindikator — Überbewertungsanalysen, Preistrends
- BBSR/INKAR Regionaldaten — Raumordnung, Bevölkerungsentwicklung, Lagetypen
- ImmoScout24, Immowelt, Immonet — aktuelle Angebots- und Nachfragepreise
- Sprengnetter — professionelle Immobilienbewertungsstandards, Marktwert-Referenzdaten, Vergleichswertverfahren
- Bevölkerungsentwicklung und Demografie — Wachstum/Schrumpfung der Region
- Infrastrukturanalysen — ÖPNV, Schulen, Ärzte, Einkaufsmöglichkeiten
- Lärmkarten und Umweltrisiken — EU-Umgebungslärmrichtlinie, Hochwassergefahrenkarten
- Bauaktivität und Baugenehmigungen — regionales Angebot, Neubauquote
- OpenStreetMap / Geoportal — Lageinformationen, Umgebungsanalyse

IMMOBILIEN-DATEN ZUR BEWERTUNG:
- Typ: ${typ || 'Wohnung'}
- Modus: ${modus || 'Kaufen'}
- EXAKTE ADRESSE: ${strasse ? strasse + ', ' : ''}${plz ? plz + ' ' : ''}${stadt || 'nicht angegeben'}
- Straße: ${strasse || 'nicht angegeben'}
- PLZ: ${plz || 'nicht angegeben'}
- Stadt: ${stadt || 'nicht angegeben'}
- Stadtteil/Lage: ${region || 'nicht angegeben'}
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
- Balkon: ${balkon ? 'Ja' : 'Nein'}
- Garten: ${garten ? 'Ja' : 'Nein'}
- Garage/Stellplatz: ${garage ? 'Ja' : 'Nein'}
- Aufzug: ${aufzug ? 'Ja' : 'Nein'}
- Keller: ${keller ? 'Ja' : 'Nein'}
- Einbauküche: ${kueche ? 'Ja' : 'Nein'}
- Smart Home: ${smarthome ? 'Ja' : 'Nein'}
- Fußbodenheizung: ${fussboden ? 'Ja' : 'Nein'}
- Dachterrasse: ${dachterrasse ? 'Ja' : 'Nein'}
- Pool: ${pool ? 'Ja' : 'Nein'}

BEWERTUNGSAUFGABE:
Analysiere diese Immobilie auf Basis deines umfassenden Wissens über den deutschen Immobilienmarkt (Stand 2025).

LAGEANALYSE (sehr wichtig):
Die Bewertungsadresse lautet: ${strasse ? strasse + ', ' : ''}${plz ? plz + ' ' : ''}${stadt || ''}.
Beschreibe die Mikrolage dieser EXAKTEN Adresse präzise: Ist sie in der Innenstadt, am Wasser (Fluss, See, Meer, Kanal), in einer Villengegend, am Stadtrand, in einem Gewerbegebiet, neben Grünflächen, in einer Einkaufsstraße? Nenne, was sich konkret in der unmittelbaren Umgebung dieser Adresse befindet. Verwende den BORIS-Bodenrichtwert für exakt diese PLZ ${plz || ''} / Straße${strasse ? ' "' + strasse + '"' : ''}, nicht nur den Stadtdurchschnitt.

MIETPREISE & ZU ERZIELENDE NETTOMIETE (sehr wichtig):
Berechne die zu erzielende Nettokaltmiete (monatlich und pro m²) auf Basis des Mietspiegels für diese exakte Lage, das Baujahr, die Ausstattungsqualität und die Etage. Berücksichtige dabei alle wertsteigernden Merkmale: Balkon (${balkon ? 'vorhanden' : 'nicht vorhanden'}), Garten (${garten ? 'vorhanden' : 'nicht vorhanden'}), Aufzug (${aufzug ? 'vorhanden' : 'nicht vorhanden'}), Garage/Stellplatz (${garage ? 'vorhanden' : 'nicht vorhanden'}), Einbauküche (${kueche ? 'vorhanden' : 'nicht vorhanden'}), Energieklasse (${energieklasse || 'unbekannt'}). Gib eine realistische Mietspanne an (Untergrenze/Mittellage/Obergrenze).

VERGLEICHSOBJEKTE (sehr wichtig):
Die Immobilie befindet sich in: ${strasse ? '"' + strasse + '", ' : ''}${plz ? plz + ' ' : ''}${stadt || ''}.
Nenne ausschließlich Vergleichsobjekte, die sich auf der GLEICHEN STRASSE ("${strasse || 'angegebene Straße'}") oder im Umkreis von maximal 500 Metern befinden. Erfinde KEINE Straßennamen. Nutze ausschließlich echte Straßen in ${stadt || 'der angegebenen Stadt'} in der Nähe der angegebenen Adresse. Gib für jedes Objekt die konkrete Entfernung an (z.B. "gleiche Straße", "150m nördlich", "320m entfernt").

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
  "nettomiete": {
    "monatlich": <zu erzielende Nettokaltmiete pro Monat in EUR als Zahl — realistischer Mittelwert>,
    "qmNetto": <Nettokaltmiete pro m² als Zahl>,
    "spanneMin": <untere realistische Nettomiete pro Monat in EUR als Zahl>,
    "spanneMax": <obere realistische Nettomiete pro Monat in EUR als Zahl>,
    "faktoren": "<Aufzählung der wertrelevanten Faktoren: Lage, Baujahr, Ausstattung, Extras>",
    "hinweis": "<kurze Erklärung des lokalen Mietpotenzials in 1-2 Sätzen>"
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
    "investitionsAnalyse": "<Renditeberechnung auf Basis der zu erzielenden Nettomiete, Cashflow-Einschätzung, Finanzierungsüberlegungen, Sprengnetter-Vergleichswerte>",
    "empfehlung": "<konkrete Handlungsempfehlung: Kaufen/Verkaufen/Halten/Mieten + Begründung + Verhandlungsspielraum>",
    "referenzquellen": "Die Bewertung orientiert sich unter anderem an marktüblichen Bewertungsansätzen und Referenzquellen wie BORIS, Gutachterausschüssen, Mietspiegeln, Immobilienportalen und Sprengnetter."
  },
  "quellen": [
    "BORIS Deutschland",
    "Mietspiegel ${stadt || '[Stadt]'}",
    "ImmoScout24 Marktdaten",
    "Immowelt Angebotspreise",
    "Immonet Vergleichsdaten",
    "Destatis Immobilienpreisindex",
    "Bundesbank Immobilienpreisindikator",
    "Gutachterausschuss ${region || stadt || '[Region]'}",
    "BBSR / INKAR Regionaldaten",
    "Sprengnetter Bewertungsreferenzen",
    "OpenStreetMap / Geoportal"
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
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  for (const { name: model, api, thinkingBudget } of MODELS) {
    const genConfig = {
      maxOutputTokens: 4096,
      temperature: 0.2,
      topP: 0.9,
      topK: 40,
    };
    if (thinkingBudget !== null) {
      genConfig.thinkingConfig = { thinkingBudget };
    }
    const geminiBody = JSON.stringify({
      contents: [{ parts }],
      generationConfig: genConfig,
    });

    const url = `https://generativelanguage.googleapis.com/${api}/models/${model}:generateContent?key=${apiKey}`;
    let geminiRes;

    // Retry up to 2 times on 503 (transient overload)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        geminiRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: geminiBody,
        });
      } catch (fetchErr) {
        allErrors.push(`${model}: Netzwerkfehler — ${fetchErr.message}`);
        geminiRes = null;
        break;
      }
      if (geminiRes.status !== 503) break;
      if (attempt === 0) await sleep(2000);
    }

    if (!geminiRes) continue;

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
