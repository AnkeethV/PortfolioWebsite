import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'ankeeth-portfolio-jwt-secret-key-2026';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const COOKIE_NAME = 'admin_token';
const TOKEN_EXPIRY_SECONDS = 86400; // 24 hours

/**
 * Validate submitted password against ADMIN_PASSWORD
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') return false;
  return password === ADMIN_PASSWORD;
}

/**
 * Signs a 24-hour admin JWT token
 */
export function generateToken(payload = { role: 'admin' }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

/**
 * Creates Set-Cookie header string for HTTP-only JWT
 */
export function serializeAuthCookie(token) {
  const isProd = process.env.NODE_ENV === 'production';
  return cookie.serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: TOKEN_EXPIRY_SECONDS
  });
}

/**
 * Creates Set-Cookie header string to clear/expire session cookie
 */
export function clearAuthCookie() {
  const isProd = process.env.NODE_ENV === 'production';
  return cookie.serialize(COOKIE_NAME, '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: 0
  });
}

/**
 * Parses cookies from request headers
 */
export function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  return cookie.parse(header);
}

/**
 * Verifies request authentication (cookie or Bearer token)
 * Returns decoded payload if authorized; returns null if unauthorized
 */
export function verifyToken(req) {
  try {
    let token = null;

    // 1. Check HTTP-only cookie
    const cookies = parseCookies(req);
    if (cookies[COOKIE_NAME]) {
      token = cookies[COOKIE_NAME];
    }

    // 2. Check Authorization header fallback (Bearer <token>)
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    return null;
  }
}

/**
 * Express/Vercel middleware helper: returns true if authorized,
 * or automatically sends HTTP 401 response and returns false
 */
export function requireAdmin(req, res) {
  const user = verifyToken(req);
  if (!user) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized: Valid admin session required.'
    });
    return false;
  }
  req.admin = user;
  return true;
}

export default {
  validatePassword,
  generateToken,
  serializeAuthCookie,
  clearAuthCookie,
  parseCookies,
  verifyToken,
  requireAdmin
};
