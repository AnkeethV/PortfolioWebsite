import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './_lib/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Vercel Serverless Function: GET /api/resume (and rewritten from /resume.pdf)
 * Streams the active resume PDF:
 * 1. From database if a custom PDF was uploaded (decoding base64 if needed)
 * 2. Or from public/resume.pdf static asset fallback
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    let customResumeUrl = null;

    try {
      const pRes = await query('SELECT resume_url FROM personal_info LIMIT 1');
      customResumeUrl = pRes.rows[0]?.resume_url || null;
    } catch (_) {}

    // Case 1: Custom resume uploaded as Base64 Data URL
    if (customResumeUrl && customResumeUrl.startsWith('data:application/pdf;base64,')) {
      const base64Clean = customResumeUrl.replace(/^data:application\/pdf;base64,/, '');
      const buffer = Buffer.from(base64Clean, 'base64');

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Content-Disposition', 'inline; filename="Ankeeth_V_Resume.pdf"');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.end(buffer);
    }

    // Case 2: Static file public/resume.pdf
    const defaultPdfPath = path.resolve(__dirname, '../public/resume.pdf');
    if (fs.existsSync(defaultPdfPath)) {
      const buffer = fs.readFileSync(defaultPdfPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Content-Disposition', 'inline; filename="Ankeeth_V_Resume.pdf"');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.end(buffer);
    }

    return res.status(404).json({ error: 'Resume PDF not found' });
  } catch (err) {
    console.error('Error serving resume PDF:', err);
    return res.status(500).json({ error: 'Internal server error serving resume PDF' });
  }
}
