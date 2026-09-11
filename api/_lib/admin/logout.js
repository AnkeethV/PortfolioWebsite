import { clearAuthCookie } from '../auth.js';

/**
 * POST /api/admin/logout
 * Clears the HTTP-only admin_token cookie
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  res.setHeader('Set-Cookie', clearAuthCookie());
  return res.status(200).json({
    success: true,
    message: 'Admin session terminated.'
  });
}
