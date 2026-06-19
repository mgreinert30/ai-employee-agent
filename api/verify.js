// Stateless E-Mail-Verifizierung — kein DB nötig
// send: generiert 6-stelligen Code, signiert ihn, sendet per Resend
// check: verifiziert Code gegen Token

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

const rateLimitMap = new Map();
function isRateLimited(ip, max = 8, windowMs = 60000) {
  const now = Date.now();
  const rec = rateLimitMap.get(ip);
  if (!rec || now - rec.t > windowMs) { rateLimitMap.set(ip, { t: now, n: 1 }); return false; }
  return ++rec.n > max;
}

async function hmacSign(key, message) {
  const enc = new TextEncoder();
  const ck  = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig  = await crypto.subtle.sign('HMAC', ck, enc.encode(message));
  return Buffer.from(sig).toString('hex');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Zu viele Anfragen. Bitte warte eine Minute.' });

  const { action, email, code, token } = req.body || {};
  const secret = process.env.RESET_SECRET || 'fallback-secret-change-me';

  // ── SEND: Code generieren, signieren, per E-Mail senden ──────────────────────
  if (action === 'send') {
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return res.status(500).json({ error: 'E-Mail-Dienst nicht konfiguriert' });

    const codeStr = String(Math.floor(100000 + Math.random() * 900000)); // 6-stellig
    const expiry  = Date.now() + 10 * 60 * 1000; // 10 Minuten gültig
    const payload = Buffer.from(`${email.toLowerCase()}|${expiry}`).toString('base64url');
    // Code wird NICHT im Payload gespeichert — nur als HMAC-Key verwendet (sicher gegen Client-Auslesen)
    const sig         = await hmacSign(`${secret}:${codeStr}`, payload);
    const verifyToken = `${payload}.${sig}`;

    const emailBody = {
      from: 'AI Employee <onboarding@resend.dev>',
      to:   [email],
      subject: 'Dein Bestätigungscode — AI Employee',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0f172a;color:#e2e8f0;border-radius:16px;">
          <div style="font-size:22px;font-weight:800;margin-bottom:8px;">AI<span style="color:#2563eb;">Employee</span></div>
          <h2 style="font-size:18px;margin:24px 0 12px;">E-Mail bestätigen</h2>
          <p style="color:#94a3b8;font-size:14px;line-height:1.6;">Dein Bestätigungscode für <strong style="color:#e2e8f0;">${email}</strong>:</p>
          <div style="margin:28px 0;text-align:center;letter-spacing:10px;font-size:38px;font-weight:900;background:#1e293b;border-radius:12px;padding:22px 16px;color:#60a5fa;">${codeStr}</div>
          <p style="color:#64748b;font-size:12px;line-height:1.7;">Dieser Code ist <strong>10 Minuten</strong> gültig.<br>Falls du kein Konto erstellt hast, ignoriere diese E-Mail einfach.</p>
        </div>
      `,
    };

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(emailBody),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(500).json({ error: err.message || 'E-Mail konnte nicht gesendet werden' });
    }
    return res.status(200).json({ ok: true, token: verifyToken });
  }

  // ── CHECK: Code gegen Token verifizieren ─────────────────────────────────────
  if (action === 'check') {
    if (!code || !token) return res.status(400).json({ error: 'Code oder Token fehlt' });

    const dotIdx = token.lastIndexOf('.');
    if (dotIdx === -1) return res.status(400).json({ error: 'Ungültiger Token' });

    const payload  = token.slice(0, dotIdx);
    const sig      = token.slice(dotIdx + 1);
    const codeStr  = String(code).trim();

    const expectedSig = await hmacSign(`${secret}:${codeStr}`, payload);
    if (sig !== expectedSig) return res.status(400).json({ error: 'Falscher Code. Bitte nochmal versuchen.' });

    let emailOut, expiry;
    try {
      const decoded = Buffer.from(payload, 'base64url').toString('utf8');
      [emailOut, expiry] = decoded.split('|');
    } catch {
      return res.status(400).json({ error: 'Token konnte nicht gelesen werden' });
    }

    if (Date.now() > parseInt(expiry)) {
      return res.status(400).json({ error: 'Code abgelaufen (10 min). Bitte neuen Code anfordern.' });
    }

    return res.status(200).json({ ok: true, email: emailOut });
  }

  return res.status(400).json({ error: 'Unbekannte Aktion. Erwartet: send oder check' });
}
