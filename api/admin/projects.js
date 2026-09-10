import { query } from '../_lib/db.js';
import { requireAdmin } from '../_lib/auth.js';

/**
 * /api/admin/projects
 * GET, POST, PUT, DELETE for project entries
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
    // 1. GET all projects
    if (req.method === 'GET') {
      const result = await query('SELECT * FROM projects ORDER BY sort_order ASC, id ASC');
      const items = result.rows.map(row => ({
        ...row,
        tech_tags: typeof row.tech_tags === 'string' ? JSON.parse(row.tech_tags) : (row.tech_tags || [])
      }));
      return res.status(200).json({ success: true, data: items });
    }

    // 2. POST create project
    if (req.method === 'POST') {
      const { name, description, tech_tags, thumbnail_url, video_url, external_link, sort_order } = req.body || {};
      if (!name || !description) {
        return res.status(400).json({ success: false, error: 'Project name and description are required.' });
      }

      let order = sort_order;
      if (order === undefined || order === null) {
        const maxOrderRes = await query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM projects');
        order = maxOrderRes.rows[0].next_order;
      }

      const tagsJson = JSON.stringify(Array.isArray(tech_tags) ? tech_tags : []);
      const insertRes = await query(
        `INSERT INTO projects (name, description, tech_tags, thumbnail_url, video_url, external_link, sort_order, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING *`,
        [name, description, tagsJson, thumbnail_url || '/assets/placeholder-avatar.svg', video_url || null, external_link || null, order]
      );

      const created = insertRes.rows[0];
      created.tech_tags = typeof created.tech_tags === 'string' ? JSON.parse(created.tech_tags) : created.tech_tags;
      return res.status(201).json({ success: true, data: created });
    }

    // 3. PUT update project (single item or batch reorder)
    if (req.method === 'PUT') {
      const b = req.body || {};

      if (Array.isArray(b.items)) {
        for (const item of b.items) {
          if (item.id && item.sort_order !== undefined) {
            await query('UPDATE projects SET sort_order = $1, updated_at = NOW() WHERE id = $2', [item.sort_order, item.id]);
          }
        }
        return res.status(200).json({ success: true, message: 'Projects reorder saved' });
      }

      const { id, name, description, tech_tags, thumbnail_url, video_url, external_link, sort_order } = b;
      if (!id) {
        return res.status(400).json({ success: false, error: 'Project ID is required for update.' });
      }

      const tagsJson = JSON.stringify(Array.isArray(tech_tags) ? tech_tags : []);
      const updateRes = await query(
        `UPDATE projects
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             tech_tags = COALESCE($3, tech_tags),
             thumbnail_url = COALESCE($4, thumbnail_url),
             video_url = COALESCE($5, video_url),
             external_link = COALESCE($6, external_link),
             sort_order = COALESCE($7, sort_order),
             updated_at = NOW()
         WHERE id = $8
         RETURNING *`,
        [name, description, tagsJson, thumbnail_url, video_url, external_link, sort_order, id]
      );

      if (updateRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Project entry not found' });
      }

      const updated = updateRes.rows[0];
      updated.tech_tags = typeof updated.tech_tags === 'string' ? JSON.parse(updated.tech_tags) : updated.tech_tags;
      return res.status(200).json({ success: true, data: updated });
    }

    // 4. DELETE project
    if (req.method === 'DELETE') {
      const id = req.query?.id || req.body?.id;
      if (!id) {
        return res.status(400).json({ success: false, error: 'Project ID is required for deletion.' });
      }

      const deleteRes = await query('DELETE FROM projects WHERE id = $1 RETURNING id', [id]);
      if (deleteRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Project not found' });
      }

      return res.status(200).json({ success: true, message: 'Project deleted successfully', id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Error in /api/admin/projects:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
