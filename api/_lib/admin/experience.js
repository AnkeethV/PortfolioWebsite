import { query } from '../db.js';
import { requireAdmin } from '../auth.js';

/**
 * /api/admin/experience
 * GET, POST, PUT, DELETE for experience entries
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
    // 1. GET all experiences
    if (req.method === 'GET') {
      const result = await query('SELECT * FROM experience ORDER BY sort_order ASC, id ASC');
      const items = result.rows.map(row => ({
        ...row,
        bullets: typeof row.bullets === 'string' ? JSON.parse(row.bullets) : (row.bullets || [])
      }));
      return res.status(200).json({ success: true, data: items });
    }

    // 2. POST create experience
    if (req.method === 'POST') {
      const { company, title, start_date, end_date, bullets, sort_order } = req.body || {};
      if (!company || !title) {
        return res.status(400).json({ success: false, error: 'Company and title are required.' });
      }

      // If sort_order not provided, put at the end
      let order = sort_order;
      if (order === undefined || order === null) {
        const maxOrderRes = await query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM experience');
        order = maxOrderRes.rows[0].next_order;
      }

      const bulletsJson = JSON.stringify(Array.isArray(bullets) ? bullets : []);
      const insertRes = await query(
        `INSERT INTO experience (company, title, start_date, end_date, bullets, sort_order, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING *`,
        [company, title, start_date || '', end_date || 'Present', bulletsJson, order]
      );

      const created = insertRes.rows[0];
      created.bullets = typeof created.bullets === 'string' ? JSON.parse(created.bullets) : created.bullets;
      return res.status(201).json({ success: true, data: created });
    }

    // 3. PUT update experience (single item or reorder batch)
    if (req.method === 'PUT') {
      const b = req.body || {};

      // Batch reorder: { items: [{ id: 1, sort_order: 1 }, { id: 2, sort_order: 2 }] }
      if (Array.isArray(b.items)) {
        for (const item of b.items) {
          if (item.id && item.sort_order !== undefined) {
            await query('UPDATE experience SET sort_order = $1, updated_at = NOW() WHERE id = $2', [item.sort_order, item.id]);
          }
        }
        return res.status(200).json({ success: true, message: 'Reorder saved' });
      }

      // Single item update
      const { id, company, title, start_date, end_date, bullets, sort_order } = b;
      if (!id) {
        return res.status(400).json({ success: false, error: 'Experience ID is required for update.' });
      }

      const bulletsJson = JSON.stringify(Array.isArray(bullets) ? bullets : []);
      const updateRes = await query(
        `UPDATE experience
         SET company = COALESCE($1, company),
             title = COALESCE($2, title),
             start_date = COALESCE($3, start_date),
             end_date = COALESCE($4, end_date),
             bullets = COALESCE($5, bullets),
             sort_order = COALESCE($6, sort_order),
             updated_at = NOW()
         WHERE id = $7
         RETURNING *`,
        [company, title, start_date, end_date, bulletsJson, sort_order, id]
      );

      if (updateRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Experience entry not found' });
      }

      const updated = updateRes.rows[0];
      updated.bullets = typeof updated.bullets === 'string' ? JSON.parse(updated.bullets) : updated.bullets;
      return res.status(200).json({ success: true, data: updated });
    }

    // 4. DELETE experience
    if (req.method === 'DELETE') {
      const id = req.query?.id || req.body?.id;
      if (!id) {
        return res.status(400).json({ success: false, error: 'Experience ID is required for deletion.' });
      }

      const deleteRes = await query('DELETE FROM experience WHERE id = $1 RETURNING id', [id]);
      if (deleteRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Experience entry not found' });
      }

      return res.status(200).json({ success: true, message: 'Experience deleted successfully', id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Error in /api/admin/experience:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
