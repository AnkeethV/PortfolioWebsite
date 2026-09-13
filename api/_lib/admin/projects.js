import { query } from '../db.js';
import { requireAdmin } from '../auth.js';
import { initSchema, ensureSeeded } from '../seed.js';
import { getFallbackProjects } from './fallbackHelper.js';
import { saveJsonBackup, syncProjectsToProfileMd } from '../dataStore.js';

async function syncBackup() {
  try {
    const res = await query('SELECT * FROM projects ORDER BY sort_order ASC, id ASC');
    if (res && Array.isArray(res.rows)) {
      saveJsonBackup('projects_backup.json', res.rows);
      syncProjectsToProfileMd(res.rows);
    }
  } catch (err) {
    console.warn('Could not save projects backup:', err.message);
  }
}

let schemaInitialized = false;

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

  // Ensure DB columns exist & seeded
  if (!schemaInitialized) {
    try {
      await initSchema();
      await ensureSeeded();
      schemaInitialized = true;
    } catch (err) {
      console.warn('Could not auto-migrate schema in projects handler:', err.message);
    }
  }

  try {
    // 1. GET all projects
    if (req.method === 'GET') {
      let items = [];
      try {
        const result = await query('SELECT * FROM projects ORDER BY sort_order ASC, id ASC');
        items = result.rows.map(row => ({
          ...row,
          tech_tags: typeof row.tech_tags === 'string' ? JSON.parse(row.tech_tags) : (row.tech_tags || []),
          is_visible: row.is_visible !== false
        }));
      } catch (dbErr) {
        console.warn('Projects DB query failed:', dbErr.message);
      }
      if (items.length === 0) {
        items = getFallbackProjects();
      }
      return res.status(200).json({ success: true, data: items });
    }

    // 2. POST create project
    if (req.method === 'POST') {
      const {
        name,
        description,
        project_type,
        domain,
        other_tools,
        short_info,
        tech_tags,
        thumbnail_url,
        screenshot1_url,
        screenshot1_desc,
        screenshot2_url,
        screenshot2_desc,
        video_url,
        powerbi_url,
        linkedin_url,
        github_url,
        platform_name,
        external_link,
        is_visible,
        sort_order
      } = req.body || {};

      const projectName = (name && name.trim()) ? name.trim() : 'Untitled Project';
      const projectDesc = (description && description.trim()) ? description.trim() : '';

      let order = sort_order;
      if (order === undefined || order === null) {
        const maxOrderRes = await query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM projects');
        order = maxOrderRes.rows[0].next_order;
      }

      const tagsJson = JSON.stringify(Array.isArray(tech_tags) ? tech_tags : []);
      const visible = is_visible !== undefined ? (is_visible === true || is_visible === 'true' || is_visible === 1) : true;

      const insertRes = await query(
        `INSERT INTO projects (
          name, description, project_type, domain, other_tools, short_info,
          tech_tags, thumbnail_url, screenshot1_url, screenshot1_desc,
          screenshot2_url, screenshot2_desc, video_url, powerbi_url,
          linkedin_url, github_url, platform_name, external_link,
          is_visible, sort_order, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17, $18,
          $19, $20, NOW()
        )
        RETURNING *`,
        [
          projectName,
          projectDesc,
          project_type || null,
          domain || null,
          other_tools || null,
          short_info || null,
          tagsJson,
          thumbnail_url || '/assets/placeholder-avatar.svg',
          screenshot1_url || null,
          screenshot1_desc || null,
          screenshot2_url || null,
          screenshot2_desc || null,
          video_url || null,
          powerbi_url || null,
          linkedin_url || null,
          github_url || null,
          platform_name || null,
          external_link || null,
          visible,
          order
        ]
      );

      const created = insertRes.rows[0];
      created.tech_tags = typeof created.tech_tags === 'string' ? JSON.parse(created.tech_tags) : created.tech_tags;
      created.is_visible = created.is_visible !== false;
      await syncBackup();
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
        await syncBackup();
        return res.status(200).json({ success: true, message: 'Projects reorder saved' });
      }

      const { id } = b;
      if (!id) {
        return res.status(400).json({ success: false, error: 'Project ID is required for update.' });
      }

      const existingRes = await query('SELECT * FROM projects WHERE id = $1', [id]);
      if (existingRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Project entry not found' });
      }
      const existing = existingRes.rows[0];

      const name = b.name !== undefined ? b.name : existing.name;
      const description = b.description !== undefined ? b.description : existing.description;
      const project_type = b.project_type !== undefined ? b.project_type : existing.project_type;
      const domain = b.domain !== undefined ? b.domain : existing.domain;
      const other_tools = b.other_tools !== undefined ? b.other_tools : existing.other_tools;
      const short_info = b.short_info !== undefined ? b.short_info : existing.short_info;
      const tech_tags = b.tech_tags !== undefined
        ? JSON.stringify(Array.isArray(b.tech_tags) ? b.tech_tags : [])
        : (typeof existing.tech_tags === 'string' ? existing.tech_tags : JSON.stringify(existing.tech_tags || []));
      const thumbnail_url = b.thumbnail_url !== undefined ? b.thumbnail_url : existing.thumbnail_url;
      const screenshot1_url = b.screenshot1_url !== undefined ? b.screenshot1_url : existing.screenshot1_url;
      const screenshot1_desc = b.screenshot1_desc !== undefined ? b.screenshot1_desc : existing.screenshot1_desc;
      const screenshot2_url = b.screenshot2_url !== undefined ? b.screenshot2_url : existing.screenshot2_url;
      const screenshot2_desc = b.screenshot2_desc !== undefined ? b.screenshot2_desc : existing.screenshot2_desc;
      const video_url = b.video_url !== undefined ? b.video_url : existing.video_url;
      const powerbi_url = b.powerbi_url !== undefined ? b.powerbi_url : existing.powerbi_url;
      const linkedin_url = b.linkedin_url !== undefined ? b.linkedin_url : existing.linkedin_url;
      const github_url = b.github_url !== undefined ? b.github_url : existing.github_url;
      const platform_name = b.platform_name !== undefined ? b.platform_name : existing.platform_name;
      const external_link = b.external_link !== undefined ? b.external_link : existing.external_link;
      const is_visible = b.is_visible !== undefined
        ? (b.is_visible === true || b.is_visible === 'true' || b.is_visible === 1)
        : (existing.is_visible !== false);
      const sort_order = b.sort_order !== undefined ? b.sort_order : existing.sort_order;

      const updateRes = await query(
        `UPDATE projects
         SET name = $1,
             description = $2,
             project_type = $3,
             domain = $4,
             other_tools = $5,
             short_info = $6,
             tech_tags = $7,
             thumbnail_url = $8,
             screenshot1_url = $9,
             screenshot1_desc = $10,
             screenshot2_url = $11,
             screenshot2_desc = $12,
             video_url = $13,
             powerbi_url = $14,
             linkedin_url = $15,
             github_url = $16,
             platform_name = $17,
             external_link = $18,
             is_visible = $19,
             sort_order = $20,
             updated_at = NOW()
         WHERE id = $21
         RETURNING *`,
        [
          name,
          description,
          project_type,
          domain,
          other_tools,
          short_info,
          tech_tags,
          thumbnail_url,
          screenshot1_url,
          screenshot1_desc,
          screenshot2_url,
          screenshot2_desc,
          video_url,
          powerbi_url,
          linkedin_url,
          github_url,
          platform_name,
          external_link,
          is_visible,
          sort_order,
          id
        ]
      );

      const updated = updateRes.rows[0];
      updated.tech_tags = typeof updated.tech_tags === 'string' ? JSON.parse(updated.tech_tags) : updated.tech_tags;
      updated.is_visible = updated.is_visible !== false;
      await syncBackup();
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

      await syncBackup();
      return res.status(200).json({ success: true, message: 'Project deleted successfully', id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Error in /api/admin/projects:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
