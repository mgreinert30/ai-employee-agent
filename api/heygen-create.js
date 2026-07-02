// Vercel Serverless Function — HeyGen Instagram-Video erstellen
export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };

// Humor-Script: Alex & Emma erklären AI Employee Agent (6 Szenen, ~60 Sek)
const DEFAULT_SCENES = [
  {
    avatar: 'alex',
    text: 'Stell dir vor, dein Mitarbeiter kommt NIE zu spät, braucht KEINEN Kaffee — und beschwert sich NIE über zu viel Arbeit.',
    duration: 8,
  },
  {
    avatar: 'emma',
    text: 'Das bin ich — Emma. KI-Mitarbeiterin. Und das ist Alex. Wir arbeiten 24/7 und fragen nie nach einer Gehaltserhöhung.',
    duration: 9,
  },
  {
    avatar: 'alex',
    text: 'Zusammen analysieren wir deine PDFs, sortieren deine E-Mails und schreiben deine Berichte — in unter 2 Minuten. Kein Witz.',
    duration: 10,
  },
  {
    avatar: 'emma',
    text: 'Du lädst ein PDF hoch. Alex liest jede Seite. Du trinkst deinen Kaffee. Alex liefert einen fertigen Bericht. Einer von uns arbeitet dabei härter.',
    duration: 11,
  },
  {
    avatar: 'alex',
    text: 'Das Beste? Dein erster Auftrag ist komplett gratis. Danach ab 99 Cent. Billiger als ein Kaffee — und ich bin schneller.',
    duration: 9,
  },
  {
    avatar: 'emma',
    text: 'Teste es jetzt auf a-i-employee.de — wir warten bereits. Buchstäblich. Wir sind KI.',
    duration: 8,
  },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Nur POST erlaubt' });

  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'HEYGEN_API_KEY nicht konfiguriert' });

  const {
    alexAvatarId,   // Avatar-ID für Alex aus /api/heygen-avatars
    emmaAvatarId,   // Avatar-ID für Emma aus /api/heygen-avatars
    alexVoiceId,    // Voice-ID für Alex (optional)
    emmaVoiceId,    // Voice-ID für Emma (optional)
    scenes = DEFAULT_SCENES,
  } = req.body || {};

  if (!alexAvatarId || !emmaAvatarId) {
    return res.status(400).json({
      error: 'alexAvatarId und emmaAvatarId sind Pflichtfelder.',
      hint: 'Rufe zuerst /api/heygen-avatars auf um die IDs deiner Avatare zu finden.',
    });
  }

  // Szenen in HeyGen video_inputs Format konvertieren
  const video_inputs = scenes.map((scene) => {
    const isAlex = scene.avatar === 'alex';
    const avatarId = isAlex ? alexAvatarId : emmaAvatarId;
    const voiceId  = isAlex ? alexVoiceId  : emmaVoiceId;

    const input = {
      character: {
        type: 'avatar',
        avatar_id: avatarId,
        avatar_style: 'normal',
      },
      voice: {
        type: 'text',
        input_text: scene.text,
        speed: 1.05,
        ...(voiceId ? { voice_id: voiceId } : {}),
      },
      background: {
        type: 'color',
        value: '#0f172a', // Website-Dunkelblau
      },
    };

    if (scene.duration) input.duration_in_seconds = scene.duration;
    return input;
  });

  const body = {
    video_inputs,
    dimension: { width: 1080, height: 1920 }, // 9:16 für Instagram Reels
    caption: false,
    title: 'AI Employee Agent — Instagram Reel',
  };

  try {
    const r = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({
        error: data.message || data.error || 'HeyGen API Fehler',
        details: data,
      });
    }

    return res.status(200).json({
      videoId: data.data?.video_id || data.video_id,
      status: 'processing',
      message: 'Video wird erstellt. Status prüfen mit /api/heygen-status?id=VIDEO_ID',
      raw: data,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
