// Vercel Serverless Function — HeyGen Video-Status prüfen
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'HEYGEN_API_KEY nicht konfiguriert' });

  const videoId = req.query.id;
  if (!videoId) return res.status(400).json({ error: 'Parameter ?id=VIDEO_ID fehlt' });

  try {
    const r = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
      headers: { 'X-Api-Key': apiKey },
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({ error: data.message || 'HeyGen API Fehler', details: data });
    }

    const info = data.data || data;
    return res.status(200).json({
      videoId,
      status: info.status,           // processing | completed | failed
      videoUrl: info.video_url,      // Download-URL wenn fertig
      thumbnailUrl: info.thumbnail_url,
      duration: info.duration,
      createdAt: info.created_at,
      raw: data,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
