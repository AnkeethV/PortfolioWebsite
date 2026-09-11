import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsFilePath = path.resolve(__dirname, '../../.data/admin_settings.json');

function readLocalSettings() {
  try {
    if (fs.existsSync(settingsFilePath)) {
      const content = fs.readFileSync(settingsFilePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (_) {}
  return {};
}

function writeLocalSettings(data) {
  try {
    const dir = path.dirname(settingsFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const existing = readLocalSettings();
    const merged = { ...existing, ...data, updated_at: new Date().toISOString() };
    fs.writeFileSync(settingsFilePath, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write admin_settings.json:', err.message);
  }
}

function verifyHash(password, stored) {
  if (!stored) return false;
  if (stored.includes(':')) {
    const [salt, key] = stored.split(':');
    const hashedBuffer = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(key, 'hex');
    if (hashedBuffer.length === keyBuffer.length && crypto.timingSafeEqual(hashedBuffer, keyBuffer)) {
      return true;
    }
    return false;
  }
  return password === stored;
}

const JWT_SECRET = process.env.JWT_SECRET || 'ankeeth-portfolio-jwt-secret-key-2026';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const COOKIE_NAME = 'admin_token';
const TOKEN_EXPIRY_SECONDS = 86400; // 24 hours

/**
 * Validate submitted password against DB stored hash, local file backup, or ADMIN_PASSWORD fallback
 */
export async function validatePassword(password) {
  if (!password || typeof password !== 'string') return false;

  // 1. Try DB admin_settings
  try {
    const res = await query("SELECT value FROM admin_settings WHERE key = 'master_password' LIMIT 1");
    if (res && res.rows && res.rows.length > 0 && res.rows[0].value) {
      return verifyHash(password, res.rows[0].value);
    }
  } catch (_) {
    // If table doesn't exist yet or connection issue, fall through
  }

  // 2. Try file-backed persistent settings (.data/admin_settings.json)
  const localSettings = readLocalSettings();
  if (localSettings && localSettings.master_password) {
    const matched = verifyHash(password, localSettings.master_password);
    if (matched) {
      // Sync back into DB if DB was restarted
      try {
        await query(`
          CREATE TABLE IF NOT EXISTS admin_settings (
            key VARCHAR(100) PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await query(
          `INSERT INTO admin_settings (key, value, updated_at)
           VALUES ('master_password', $1, NOW())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [localSettings.master_password]
        );
      } catch (_) {}
      return true;
    }
    return false;
  }

  // 3. Fallback to default
  return password === ADMIN_PASSWORD;
}

/**
 * Hash and persist a new master password into both admin_settings table and local file
 */
export async function setMasterPassword(newPassword) {
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters long.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(newPassword, salt, 64).toString('hex');
  const storedValue = `${salt}:${hash}`;

  // 1. Persist to file immediately
  writeLocalSettings({ master_password: storedValue });

  // 2. Persist to DB
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query(
      `INSERT INTO admin_settings (key, value, updated_at)
       VALUES ('master_password', $1, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [storedValue]
    );
  } catch (err) {
    console.warn('Could not persist master password to DB (persisted to file):', err.message);
  }

  return true;
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
  setMasterPassword,
  generateToken,
  serializeAuthCookie,
  clearAuthCookie,
  parseCookies,
  verifyToken,
  requireAdmin
};

