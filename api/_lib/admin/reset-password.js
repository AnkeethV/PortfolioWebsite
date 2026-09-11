import { requireAdmin, validatePassword, setMasterPassword, generateToken, serializeAuthCookie } from '../auth.js';

/**
 * POST /api/admin/reset-password
 * Allows an authenticated admin to change/reset the master password.
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
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  // Auth Guard: Admin session required
  if (!requireAdmin(req, res)) return;

  const { currentPassword, newPassword, confirmPassword } = req.body || {};

  if (!currentPassword) {
    return res.status(400).json({
      success: false,
      error: 'Current master password is required.'
    });
  }

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      error: 'New password must be at least 6 characters long.'
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      error: 'New password and confirmation do not match.'
    });
  }

  // Verify current password
  const isValidCurrent = await validatePassword(currentPassword);
  if (!isValidCurrent) {
    return res.status(400).json({
      success: false,
      error: 'Current master password is incorrect.'
    });
  }

  try {
    await setMasterPassword(newPassword);

    // Refresh auth session cookie with new token
    const token = generateToken({ user: 'admin', role: 'admin' });
    const cookieHeader = serializeAuthCookie(token);
    res.setHeader('Set-Cookie', cookieHeader);

    return res.status(200).json({
      success: true,
      message: 'Master password has been reset successfully.'
    });
  } catch (err) {
    console.error('Error resetting master password:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to reset master password.'
    });
  }
}
