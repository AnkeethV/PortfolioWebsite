import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { requireAdmin } from '../auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_CONFIG = {
  photo: {
    exts: ['.jpg', '.jpeg', '.png', '.webp'],
    mimes: ['image/jpeg', 'image/png', 'image/webp'],
    folder: 'photos',
    maxSize: 15 * 1024 * 1024 // 15MB
  },
  resume: {
    exts: ['.pdf'],
    mimes: ['application/pdf'],
    folder: 'resumes',
    maxSize: 20 * 1024 * 1024 // 20MB
  },
  thumbnail: {
    exts: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'],
    mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'],
    folder: 'thumbnails',
    maxSize: 15 * 1024 * 1024 // 15MB
  },
  screenshot: {
    exts: ['.jpg', '.jpeg', '.png', '.webp'],
    mimes: ['image/jpeg', 'image/png', 'image/webp'],
    folder: 'screenshots',
    maxSize: 15 * 1024 * 1024 // 15MB
  },
  video: {
    exts: ['.mp4', '.webm', '.ogg', '.mov', '.mkv'],
    mimes: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-matroska'],
    folder: 'videos',
    maxSize: 100 * 1024 * 1024 // 100MB
  }
};

/**
 * POST /api/admin/upload
 * Handles media uploads for photos, resumes, thumbnails, and video files.
 * Works seamlessly on local disk AND on serverless platforms (Vercel) via Data URL fallback.
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

  try {
    const { filename, fileType, base64Data, category } = req.body || {};

    if (!category || !ALLOWED_CONFIG[category]) {
      return res.status(400).json({
        success: false,
        error: `Invalid category: '${category}'. Allowed: ${Object.keys(ALLOWED_CONFIG).join(', ')}.`
      });
    }

    if (!filename || !base64Data) {
      return res.status(400).json({
        success: false,
        error: 'Missing required upload parameters: filename and base64Data.'
      });
    }

    const config = ALLOWED_CONFIG[category];
    const rawExt = path.extname(filename).toLowerCase();

    // Validate extension
    if (!config.exts.includes(rawExt)) {
      return res.status(400).json({
        success: false,
        error: `Invalid file extension '${rawExt}' for ${category}. Allowed extensions: ${config.exts.join(', ')}`
      });
    }

    // Validate mime type if supplied
    if (fileType && !config.mimes.includes(fileType.toLowerCase())) {
      const mimeMatch = config.mimes.some(m => fileType.toLowerCase().startsWith(m.split('/')[0]));
      if (!mimeMatch) {
        return res.status(400).json({
          success: false,
          error: `Invalid MIME type '${fileType}' for ${category}. Allowed types: ${config.mimes.join(', ')}`
        });
      }
    }

    // Clean base64 string
    const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    if (buffer.length > config.maxSize) {
      return res.status(400).json({
        success: false,
        error: `File size exceeds maximum permitted limit (${Math.round(config.maxSize / (1024 * 1024))}MB).`
      });
    }

    const mime = fileType || (config.mimes[0] || 'application/octet-stream');
    const dataUrl = base64Data.startsWith('data:') ? base64Data : `data:${mime};base64,${base64Clean}`;

    // Generate safe unique filename
    const safeBase = path.basename(filename, rawExt).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const safeFilename = `${safeBase}-${uniqueSuffix}${rawExt}`;

    let publicUrl = dataUrl;

    // Try saving to disk if writable (local dev server).
    // On Vercel serverless, the filesystem is read-only, so we safely use dataUrl.
    try {
      const uploadFolder = path.resolve(__dirname, '../../../public/uploads', config.folder);
      if (!fs.existsSync(uploadFolder)) {
        fs.mkdirSync(uploadFolder, { recursive: true });
      }
      const targetFilePath = path.join(uploadFolder, safeFilename);
      fs.writeFileSync(targetFilePath, buffer);
      publicUrl = `/uploads/${config.folder}/${safeFilename}`;
    } catch (diskErr) {
      console.warn('Disk is read-only (Vercel serverless). Using data URL for media:', diskErr.message);
      publicUrl = dataUrl;
    }

    return res.status(200).json({
      success: true,
      url: publicUrl,
      filename: safeFilename,
      size: buffer.length,
      category
    });
  } catch (err) {
    console.error('Error during media upload:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'File upload failed.'
    });
  }
}
