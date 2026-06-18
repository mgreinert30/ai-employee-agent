// Vercel Serverless — create a PayPal order (server-side, secret stays hidden)
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
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
  ).toString('base64');
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('PayPal-Authentifizierung fehlgeschlagen');
  return data.access_token;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Zu viele Anfragen.' });

  const { PAYPAL_CLIENT_ID, PAYPAL_SECRET } = process.env;
  if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
    return res.status(503).json({ error: 'PayPal nicht konfiguriert' });
  }

  const { amount, description } = req.body || {};
  const amt = parseFloat(amount);
  if (!amount || isNaN(amt) || amt <= 0) {
    return res.status(400).json({ error: 'Ungültiger Betrag' });
  }

  try {
    const accessToken = await getAccessToken();
    const orderRes = await fetch(`${paypalBase()}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
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
