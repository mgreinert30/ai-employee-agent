// Vercel Serverless — Nutzer-Verwaltung mit Supabase
// Fällt auf Fehler-Antwort zurück, wenn Supabase nicht konfiguriert ist.
// Frontend erkennt das und weicht auf localStorage aus.
//
// Aktionen: register | login | update-name | update-email | update-password
//
// Supabase-Setup (einmalig):
//   1. Supabase-Projekt erstellen: https://supabase.com
//   2. SQL in Supabase → SQL Editor ausführen:
//      CREATE TABLE users (
//        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//        email text UNIQUE NOT NULL,
//        name text NOT NULL,
//        password_hash text NOT NULL,
//        verified boolean DEFAULT false,
//        created_at timestamptz DEFAULT now()
//      );
//      ALTER TABLE users ENABLE ROW LEVEL SECURITY;
//      CREATE POLICY "service_role_only" ON users USING (true) WITH CHECK (true);
//   3. Vercel Env-Vars setzen:
//      SUPABASE_URL=https://xxxx.supabase.co
//      SUPABASE_SERVICE_KEY=<service_role key>   (nicht der anon key!)

import { createHash } from 'crypto';
import { issueToken } from './_token.js';

export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };

const rateLimitMap = new Map();

// Free-Trial Rate-Limiting (aus free-trial.js zusammengeführt)
const _usedSessions = new Map();
const _ipCounts = new Map();
function _isIpLimited(ip) {
  const now = Date.now();
  const rec = _ipCounts.get(ip);
  if (!rec || now > rec.resetAt) {
    _ipCounts.set(ip, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    return false;
  }
  if (rec.count >= 3) return true;
  rec.count++;
  return false;
}
function isRateLimited(ip, max = 15, windowMs = 60000) {
  const now = Date.now();
  const rec = rateLimitMap.get(ip);
  if (!rec || now - rec.t > windowMs) { rateLimitMap.set(ip, { t: now, n: 1 }); return false; }
  return ++rec.n > max;
}

function hashPw(pw) {
  return createHash('sha256').update(pw).digest('hex');
}

function supabaseHeaders() {
  return {
    'apikey': process.env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

async function sbFetch(path, opts = {}) {
  const base = process.env.SUPABASE_URL;
  const r = await fetch(`${base}/rest/v1${path}`, {
    ...opts,
    headers: { ...supabaseHeaders(), ...(opts.headers || {}) },
  });
  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Wenn Supabase nicht konfiguriert → explizit signalisieren, Frontend fällt auf localStorage zurück
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'supabase_not_configured' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Zu viele Anfragen.' });

  const { action, email, name, password, newEmail, newName, newPassword, oldPassword } = req.body || {};

  // ── REGISTER ─────────────────────────────────────────────────────────────────
  if (action === 'register') {
    if (!email || !name || !password) return res.status(400).json({ error: 'Fehlende Felder' });
    if (password.length < 8) return res.status(400).json({ error: 'Passwort zu kurz' });

    // Prüfen ob E-Mail schon existiert
    const check = await sbFetch(`/users?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id`);
    if (!check.ok) return res.status(500).json({ error: 'Datenbankfehler' });
    if (check.data?.length > 0) return res.status(409).json({ error: 'E-Mail bereits registriert.' });

    const insert = await sbFetch('/users', {
      method: 'POST',
      body: JSON.stringify({ email: email.toLowerCase(), name, password_hash: hashPw(password), verified: true }),
    });
    if (!insert.ok) return res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
    const user = insert.data?.[0];
    return res.status(200).json({ ok: true, user: { name: user.name, email: user.email } });
  }

  // ── LOGIN ─────────────────────────────────────────────────────────────────────
  if (action === 'login') {
    if (!email || !password) return res.status(400).json({ error: 'Fehlende Felder' });

    const result = await sbFetch(`/users?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id,name,email,password_hash`);
    if (!result.ok) return res.status(500).json({ error: 'Datenbankfehler' });
    const user = result.data?.[0];
    if (!user || user.password_hash !== hashPw(password)) {
      return res.status(401).json({ error: 'E-Mail oder Passwort falsch.' });
    }
    return res.status(200).json({ ok: true, user: { name: user.name, email: user.email } });
  }

  // ── UPDATE NAME ───────────────────────────────────────────────────────────────
  if (action === 'update-name') {
    if (!email || !newName) return res.status(400).json({ error: 'Fehlende Felder' });
    const r = await sbFetch(`/users?email=eq.${encodeURIComponent(email.toLowerCase())}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: newName }),
    });
    if (!r.ok) return res.status(500).json({ error: 'Fehler beim Speichern' });
    return res.status(200).json({ ok: true });
  }

  // ── UPDATE EMAIL ──────────────────────────────────────────────────────────────
  if (action === 'update-email') {
    if (!email || !newEmail) return res.status(400).json({ error: 'Fehlende Felder' });
    const check = await sbFetch(`/users?email=eq.${encodeURIComponent(newEmail.toLowerCase())}&select=id`);
    if (check.data?.length > 0) return res.status(409).json({ error: 'E-Mail bereits vergeben.' });
    const r = await sbFetch(`/users?email=eq.${encodeURIComponent(email.toLowerCase())}`, {
      method: 'PATCH',
      body: JSON.stringify({ email: newEmail.toLowerCase() }),
    });
    if (!r.ok) return res.status(500).json({ error: 'Fehler beim Speichern' });
    return res.status(200).json({ ok: true });
  }

  // ── UPDATE PASSWORD ───────────────────────────────────────────────────────────
  if (action === 'update-password') {
    if (!email || !oldPassword || !newPassword) return res.status(400).json({ error: 'Fehlende Felder' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Neues Passwort zu kurz (min. 8 Zeichen)' });

    const check = await sbFetch(`/users?email=eq.${encodeURIComponent(email.toLowerCase())}&select=password_hash`);
    if (!check.ok || !check.data?.[0]) return res.status(404).json({ error: 'Nutzer nicht gefunden' });
    if (check.data[0].password_hash !== hashPw(oldPassword)) {
      return res.status(401).json({ error: 'Aktuelles Passwort falsch.' });
    }
    const r = await sbFetch(`/users?email=eq.${encodeURIComponent(email.toLowerCase())}`, {
      method: 'PATCH',
      body: JSON.stringify({ password_hash: hashPw(newPassword) }),
    });
    if (!r.ok) return res.status(500).json({ error: 'Fehler beim Speichern' });
    return res.status(200).json({ ok: true });
  }

  // ── RESET PASSWORD (nach E-Mail-Verifizierung) ────────────────────────────────
  if (action === 'reset-password') {
    if (!email || !newPassword) return res.status(400).json({ error: 'Fehlende Felder' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Passwort zu kurz (min. 8 Zeichen)' });

    // Nutzer existiert → Passwort aktualisieren. Existiert nicht → anlegen (Erst-Reset)
    const check = await sbFetch(`/users?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id`);
    if (!check.ok) return res.status(500).json({ error: 'Datenbankfehler' });

    if (check.data?.length > 0) {
      await sbFetch(`/users?email=eq.${encodeURIComponent(email.toLowerCase())}`, {
        method: 'PATCH',
        body: JSON.stringify({ password_hash: hashPw(newPassword) }),
      });
    } else {
      await sbFetch('/users', {
        method: 'POST',
        body: JSON.stringify({ email: email.toLowerCase(), name: email.split('@')[0], password_hash: hashPw(newPassword), verified: true }),
      });
    }
    return res.status(200).json({ ok: true });
  }

  // ── REGISTER-HASHED: Nutzer mit vorgeberechnetem Hash anlegen ────────────────
  // Wird nach Magic-Link-Bestätigung aufgerufen — Hash kommt aus dem signierten Token.
  if (action === 'register-hashed') {
    const { email: rEmail, name: rName, passwordHash: rHash } = req.body || {};
    if (!rEmail || !rName || !rHash || rHash.length !== 64) {
      return res.status(400).json({ error: 'Fehlende oder ungültige Felder' });
    }
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return res.status(503).json({ error: 'supabase_not_configured' });
    }
    const check = await sbFetch(`/users?email=eq.${encodeURIComponent(rEmail.toLowerCase())}&select=id`);
    if (!check.ok) return res.status(500).json({ error: 'Datenbankfehler' });
    if (check.data?.length > 0) return res.status(200).json({ ok: true }); // bereits registriert
    const insert = await sbFetch('/users', {
      method: 'POST',
      body: JSON.stringify({ email: rEmail.toLowerCase(), name: rName, password_hash: rHash, verified: true }),
    });
    if (!insert.ok) return res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
    const user = insert.data?.[0];
    return res.status(200).json({ ok: true, user: { name: user.name, email: user.email } });
  }

  // ── FREE TRIAL TOKEN ─────────────────────────────────────────────────────────
  if (action === 'get-trial-token') {
    const { sessionId } = req.body || {};
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length < 8) {
      return res.status(400).json({ error: 'sessionId fehlt' });
    }
    if (_usedSessions.has(sessionId)) {
      return res.status(409).json({ error: 'Free Trial bereits genutzt.' });
    }
    if (_isIpLimited(ip)) {
      return res.status(429).json({ error: 'Free-Trial-Limit erreicht. Bitte wähle einen Tarif.' });
    }
    try {
      const token = issueToken({ use: 'analyse', sessionId, amount: '0' });
      _usedSessions.set(sessionId, Date.now());
      return res.status(200).json({ token });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'Unbekannte Aktion' });
}
