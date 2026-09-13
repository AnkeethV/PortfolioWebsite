import { query } from '../db.js';
import { requireAdmin } from '../auth.js';
import { initSchema } from '../seed.js';
import { getFallbackPersonalInfo } from './fallbackHelper.js';
import { saveJsonBackup, syncPersonalInfoToProfileMd } from '../dataStore.js';

/**
 * /api/admin/personal-info
 * GET: Retrieve personal info
 * PUT: Update personal info
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Auth Guard
  if (!requireAdmin(req, res)) return;

  try {
    if (req.method === 'GET') {
      let info = null;
      try {
        const result = await query('SELECT * FROM personal_info ORDER BY id ASC LIMIT 1');
        info = result.rows[0] || null;
      } catch (dbErr) {
        console.warn('Personal-info DB query failed:', dbErr.message);
      }
      if (!info) {
        info = getFallbackPersonalInfo();
      }
      return res.status(200).json({
        success: true,
        data: info
      });
    }

    if (req.method === 'PUT') {
      const b = req.body || {};

      try {
        await initSchema();
      } catch (_) {}

      // Check if row exists
      let existing = {};
      try {
        const check = await query('SELECT * FROM personal_info LIMIT 1');
        existing = check.rows[0] || {};
      } catch (_) {}

      const name = (b.name !== undefined && b.name.trim()) ? b.name.trim() : (existing.name || 'Ankeeth V');
      const email = (b.email !== undefined && b.email.trim()) ? b.email.trim() : (existing.email || 'ankeeth.v@gmail.com');
      const title = b.title !== undefined ? b.title : (existing.title || '');
      const location = b.location !== undefined ? b.location : (existing.location || '');
      const linkedin_url = b.linkedin_url !== undefined ? b.linkedin_url : existing.linkedin_url;
      const github_url = b.github_url !== undefined ? b.github_url : existing.github_url;
      const bio = b.bio !== undefined ? b.bio : (existing.bio || '');

      // Preserve existing photo_url and resume_url if not explicitly provided or if empty
      const resume_url = (b.resume_url !== undefined && b.resume_url !== '')
        ? b.resume_url
        : (existing.resume_url || '/resume.pdf');

      const photo_url = (b.photo_url !== undefined && b.photo_url !== '')
        ? b.photo_url
        : (existing.photo_url || '/assets/placeholder-avatar.svg');

      let savedRecord;
      if (!existing.id) {
        // Insert new if empty
        const insertRes = await query(
          `INSERT INTO personal_info 
            (name, title, location, email, linkedin_url, github_url, bio, resume_url, photo_url, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           RETURNING *`,
          [name, title, location, email, linkedin_url, github_url, bio, resume_url, photo_url]
        );
        savedRecord = insertRes.rows[0];
      } else {
        const id = existing.id;
        const updateRes = await query(
          `UPDATE personal_info
           SET name = $1, title = $2, location = $3, email = $4,
               linkedin_url = $5, github_url = $6, bio = $7,
               resume_url = $8, photo_url = $9, updated_at = NOW()
           WHERE id = $10
           RETURNING *`,
          [name, title, location, email, linkedin_url, github_url, bio, resume_url, photo_url, id]
        );
        savedRecord = updateRes.rows[0];
      }

      if (!savedRecord) {
        savedRecord = {
          id: existing.id || 1,
          name,
          title,
          location,
          email,
          linkedin_url,
          github_url,
          bio,
          resume_url,
          photo_url,
          updated_at: new Date().toISOString()
        };
      }

      // Persist across serverless instances, cold boots, and local restarts
      saveJsonBackup('personal_info_backup.json', savedRecord);
      syncPersonalInfoToProfileMd(savedRecord);

      return res.status(200).json({ success: true, data: savedRecord });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Error in /api/admin/personal-info:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
