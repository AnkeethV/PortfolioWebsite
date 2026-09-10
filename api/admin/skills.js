import { query } from '../_lib/db.js';
import { requireAdmin } from '../_lib/auth.js';

/**
 * /api/admin/skills
 * GET, POST, PUT, DELETE for skills
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
    // 1. GET all skills
    if (req.method === 'GET') {
      const result = await query('SELECT * FROM skills ORDER BY category ASC, sort_order ASC, id ASC');
      return res.status(200).json({ success: true, data: result.rows });
    }

    // 2. POST create skill
    if (req.method === 'POST') {
      const { category, value, sort_order } = req.body || {};
      if (!category || !value) {
        return res.status(400).json({ success: false, error: 'Skill category and value are required.' });
      }

      const validCat = ['technical', 'tools', 'soft'].includes(category.toLowerCase())
        ? category.toLowerCase()
        : 'technical';

      let order = sort_order;
      if (order === undefined || order === null) {
        const maxOrderRes = await query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM skills WHERE category = $1', [validCat]);
        order = maxOrderRes.rows[0].next_order;
      }

      const insertRes = await query(
        `INSERT INTO skills (category, value, sort_order)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [validCat, value.trim(), order]
      );

      return res.status(201).json({ success: true, data: insertRes.rows[0] });
    }

    // 3. PUT update skill (or batch update)
    if (req.method === 'PUT') {
      const b = req.body || {};

      if (Array.isArray(b.items)) {
        for (const item of b.items) {
          if (item.id && item.sort_order !== undefined) {
            await query('UPDATE skills SET sort_order = $1 WHERE id = $2', [item.sort_order, item.id]);
          }
        }
        return res.status(200).json({ success: true, message: 'Skills reordered' });
      }

      const { id, category, value, sort_order } = b;
      if (!id) {
        return res.status(400).json({ success: false, error: 'Skill ID is required for update.' });
      }

      const updateRes = await query(
        `UPDATE skills
         SET category = COALESCE($1, category),
             value = COALESCE($2, value),
             sort_order = COALESCE($3, sort_order)
         WHERE id = $4
         RETURNING *`,
        [category, value ? value.trim() : null, sort_order, id]
      );

      if (updateRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Skill entry not found' });
      }

      return res.status(200).json({ success: true, data: updateRes.rows[0] });
    }

    // 4. DELETE skill
    if (req.method === 'DELETE') {
      const id = req.query?.id || req.body?.id;
      if (!id) {
        return res.status(400).json({ success: false, error: 'Skill ID is required for deletion.' });
      }

      const deleteRes = await query('DELETE FROM skills WHERE id = $1 RETURNING id', [id]);
      if (deleteRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Skill not found' });
      }

      return res.status(200).json({ success: true, message: 'Skill deleted', id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Error in /api/admin/skills:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
