// Vercel Serverless Function — Send password reset email via Resend
// Token = base64(email|expiry) + "." + HMAC-SHA256(secret, payload) — no DB needed

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };

async function hmacSign(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Buffer.from(sig).toString('hex');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Ungültige E-Mail' });

  const resendKey = process.env.RESEND_API_KEY;
  const secret    = process.env.RESET_SECRET || 'fallback-secret-change-me';
  const siteUrl   = process.env.SITE_URL || 'https://ai-employee-agent.vercel.app';

  if (!resendKey) return res.status(500).json({ error: 'E-Mail-Dienst nicht konfiguriert' });

  // Build signed token valid for 1 hour
  const expiry  = Date.now() + 60 * 60 * 1000;
  const payload = Buffer.from(`${email}|${expiry}`).toString('base64url');
  const sig     = await hmacSign(secret, payload);
  const token   = `${payload}.${sig}`;
  const link    = `${siteUrl}?reset=${encodeURIComponent(token)}`;

  const emailBody = {
    from: 'AI Employee <noreply@aiemployee.de>',
    to: [email],
    subject: 'Passwort zurücksetzen — AI Employee',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0f172a;color:#e2e8f0;border-radius:16px;">
        <div style="font-size:22px;font-weight:800;margin-bottom:8px;">AI<span style="color:#2563eb;">Employee</span></div>
        <h2 style="font-size:18px;margin:24px 0 12px;">Passwort zurücksetzen</h2>
        <p style="color:#94a3b8;font-size:14px;line-height:1.6;">Du hast eine Passwortzurücksetzung für dein Konto (<strong style="color:#e2e8f0;">${email}</strong>) angefordert.</p>
        <a href="${link}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:#2563eb;color:white;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">Neues Passwort festlegen →</a>
        <p style="color:#64748b;font-size:12px;">Dieser Link ist <strong>1 Stunde</strong> gültig. Falls du kein Reset angefordert hast, kannst du diese E-Mail ignorieren.</p>
      </div>
    `,
  };

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(emailBody),
  });

  if (!resendRes.ok) {
    const err = await resendRes.json().catch(() => ({}));
    return res.status(500).json({ error: err.message || 'E-Mail konnte nicht gesendet werden' });
  }

  return res.status(200).json({ ok: true });
}
