import { verifyToken } from '../_lib/auth.js';

/**
 * GET /api/admin/me
 * Checks if client has valid admin session
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({
      authenticated: false,
      error: 'Not authenticated'
    });
  }

  return res.status(200).json({
    authenticated: true,
    user: user.user || 'admin'
  });
}
