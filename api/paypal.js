// Vercel Serverless — kombinierter PayPal-Endpoint
// GET  → öffentliche Konfiguration (PAYPAL_CLIENT_ID)
// POST → action: 'create-order' | 'capture-order'
import { issueToken } from './_token.js';

export const config = { api: { bodyParser: true } };

const rateLimitMap = new Map();
function isRateLimited(ip, max = 10, ms = 60000) {
  const now = Date.now();
  const r = rateLimitMap.get(ip);
  if (!r || now - r.t > ms) { rateLimitMap.set(ip, { t: now, n: 1 }); return false; }
  return ++r.n > max;
}

function paypalBase() {
  return process.env.PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function getAccessToken() {
  const creds = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');
  const r = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('PayPal-Authentifizierung fehlgeschlagen');
  return d.access_token;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // GET → public config (PAYPAL_CLIENT_ID für PayPal SDK)
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json({
      paypalClientId: process.env.PAYPAL_CLIENT_ID || null,
      paypalEnv:      process.env.PAYPAL_ENV || 'sandbox',
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Zu viele Anfragen.' });

  const { action, amount, description, orderID, sessionId } = req.body || {};

  // ── create-order ────────────────────────────────────────────────────────────
  if (action === 'create-order') {
    const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) return res.status(503).json({ error: 'PayPal nicht konfiguriert' });
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'Ungültiger Betrag' });
    try {
      const token = await getAccessToken();
      const orderRes = await fetch(`${paypalBase()}/v2/checkout/orders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            amount: { currency_code: 'EUR', value: amt.toFixed(2) },
            description: String(description || 'AI Employee Agent').slice(0, 127),
          }],
        }),
      });
      const order = await orderRes.json();
      if (!order.id) throw new Error(`Order-Fehler: ${JSON.stringify(order).slice(0, 150)}`);
      return res.status(200).json({ orderID: order.id });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── capture-order ────────────────────────────────────────────────────────────
  if (action === 'capture-order') {
    const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) return res.status(503).json({ error: 'PayPal nicht konfiguriert' });
    if (!orderID || typeof orderID !== 'string') return res.status(400).json({ error: 'orderID fehlt' });
    try {
      const accessToken = await getAccessToken();
      const captureRes = await fetch(`${paypalBase()}/v2/checkout/orders/${orderID}/capture`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      });
      const capture = await captureRes.json();
      if (capture.status !== 'COMPLETED') {
        return res.status(402).json({ error: `Zahlung nicht abgeschlossen (Status: ${capture.status || 'unbekannt'})` });
      }
      const analysisToken = issueToken({
        use: 'analyse',
        sessionId: String(sessionId || '').slice(0, 64),
        amount: String(amount || ''),
      });
      return res.status(200).json({ token: analysisToken, paypalOrderId: capture.id });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'Unbekannte Aktion. Erwartet: create-order oder capture-order' });
}
