import { query } from '../db.js';
import { requireAdmin } from '../auth.js';
import { initSchema } from '../seed.js';
import { getFallbackFaq } from './fallbackHelper.js';
import { saveJsonBackup, syncFaqToProfileMd } from '../dataStore.js';

async function syncBackup() {
  try {
    const res = await query('SELECT * FROM faq ORDER BY sort_order ASC, id ASC');
    if (res && Array.isArray(res.rows)) {
      saveJsonBackup('faq_backup.json', res.rows);
      syncFaqToProfileMd(res.rows);
    }
  } catch (err) {
    console.warn('Could not save faq backup:', err.message);
  }
}

/**
 * /api/admin/faq
 * GET, POST, PUT, DELETE for FAQ entries
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Auth Guard
  if (!requireAdmin(req, res)) return;

  try {
    // 1. GET all FAQs
    if (req.method === 'GET') {
      let items = [];
      try {
        const result = await query('SELECT * FROM faq ORDER BY sort_order ASC, id ASC');
        items = result.rows;
      } catch (dbErr) {
        console.warn('FAQ DB query failed:', dbErr.message);
      }
      if (items.length === 0) {
        items = getFallbackFaq();
      }
      return res.status(200).json({ success: true, data: items });
    }

    // 2. POST create FAQ
    if (req.method === 'POST') {
      const { question, answer, sort_order } = req.body || {};
      if (!question || !answer) {
        return res.status(400).json({ success: false, error: 'Question and answer are required.' });
      }

      let order = sort_order;
      if (order === undefined || order === null) {
        const maxOrderRes = await query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM faq');
        order = maxOrderRes.rows[0].next_order;
      }

      const insertRes = await query(
        `INSERT INTO faq (question, answer, sort_order, updated_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING *`,
        [question.trim(), answer.trim(), order]
      );

      await syncBackup();
      return res.status(201).json({ success: true, data: insertRes.rows[0] });
    }

    // 3. PUT update FAQ
    if (req.method === 'PUT') {
      const b = req.body || {};

      if (Array.isArray(b.items)) {
        for (const item of b.items) {
          if (item.id && item.sort_order !== undefined) {
            await query('UPDATE faq SET sort_order = $1, updated_at = NOW() WHERE id = $2', [item.sort_order, item.id]);
          }
        }
        await syncBackup();
        return res.status(200).json({ success: true, message: 'FAQ reorder saved' });
      }

      const { id, question, answer, sort_order } = b;
      if (!id) {
        return res.status(400).json({ success: false, error: 'FAQ ID is required for update.' });
      }

      const updateRes = await query(
        `UPDATE faq
         SET question = COALESCE($1, question),
             answer = COALESCE($2, answer),
             sort_order = COALESCE($3, sort_order),
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [question ? question.trim() : null, answer ? answer.trim() : null, sort_order, id]
      );

      if (updateRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'FAQ entry not found' });
      }

      await syncBackup();
      return res.status(200).json({ success: true, data: updateRes.rows[0] });
    }

    // 4. DELETE FAQ
    if (req.method === 'DELETE') {
      const id = req.query?.id || req.body?.id;
      if (!id) {
        return res.status(400).json({ success: false, error: 'FAQ ID is required for deletion.' });
      }

      const deleteRes = await query('DELETE FROM faq WHERE id = $1 RETURNING id', [id]);
      if (deleteRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'FAQ entry not found' });
      }

      await syncBackup();
      return res.status(200).json({ success: true, message: 'FAQ entry deleted', id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Error in /api/admin/faq:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
