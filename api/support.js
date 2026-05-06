export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, type, message } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Fehlende Felder' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.SUPPORT_EMAIL;
  if (!apiKey || !toEmail) {
    return res.status(500).json({ error: 'Server nicht konfiguriert' });
  }

  const typeLabels = { bug: '🐛 Bug', improvement: '💡 Verbesserung', question: '❓ Frage', other: '📝 Sonstiges' };
  const label = typeLabels[type] || type;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'AI Employee Agent <onboarding@resend.dev>',
      to: [toEmail],
      subject: `[Support] ${label} von ${name}`,
      html: `<p><strong>Name:</strong> ${name}</p>
             <p><strong>E-Mail:</strong> ${email}</p>
             <p><strong>Art:</strong> ${label}</p>
             <hr/>
             <p>${message.replace(/\n/g, '<br>')}</p>`,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return res.status(500).json({ error: err.message || 'Fehler beim Senden' });
  }

  return res.status(200).json({ ok: true });
}
