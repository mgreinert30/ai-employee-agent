// Vercel Serverless — returns public (non-secret) configuration for the frontend
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).json({
    paypalClientId: process.env.PAYPAL_CLIENT_ID || null,
    paypalEnv: process.env.PAYPAL_ENV || 'sandbox',
  });
}
