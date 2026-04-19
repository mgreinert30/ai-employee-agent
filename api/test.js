export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(200).json({ error: 'Kein Key in Vercel gesetzt' });

  const keyInfo = `${apiKey.slice(0, 6)}...${apiKey.slice(-4)} (${apiKey.length} Zeichen)`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await r.json();
    if (data.error) return res.status(200).json({ keyInfo, error: data.error.message });
    const models = (data.models || []).map(m => m.name);
    return res.status(200).json({ keyInfo, models });
  } catch (err) {
    return res.status(200).json({ keyInfo, error: err.message });
  }
}
