// Vercel Serverless Function — HeyGen Avatar-Liste
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'HEYGEN_API_KEY nicht konfiguriert' });

  try {
    // Avatar Groups = einzelne Charaktere (Alex, Emma etc.)
    const [groupsRes, looksRes] = await Promise.all([
      fetch('https://api.heygen.com/v3/avatar-groups?include_public=false', {
        headers: { 'X-Api-Key': apiKey },
      }),
      fetch('https://api.heygen.com/v3/avatars?include_public=false', {
        headers: { 'X-Api-Key': apiKey },
      }),
    ]);

    const groups = await groupsRes.json();
    const looks  = await looksRes.json();

    return res.status(200).json({
      groups: groups.data?.avatar_groups || groups.data || [],
      avatars: looks.data?.avatars       || looks.data  || [],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
