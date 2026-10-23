import { query } from '../db.js';
import { requireAdmin } from '../auth.js';
import { initSchema, ensureProjectTypesSeeded } from '../seed.js';
import { getFallbackProjectTypes, getFallbackProjects } from './fallbackHelper.js';
import { saveJsonBackup, loadJsonBackup } from '../dataStore.js';

async function syncBackup() {
  try {
    const res = await query('SELECT * FROM project_types ORDER BY sort_order ASC, id ASC');
    if (res && Array.isArray(res.rows) && res.rows.length > 0) {
      saveJsonBackup('project_types_backup.json', res.rows);
      return res.rows;
    }
  } catch (err) {
    console.warn('Could not save project_types backup from DB:', err.message);
  }
  return null;
}

let schemaInitialized = false;

/**
 * /api/admin/project-types
 * GET, POST, PUT, DELETE for project types
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Auth Guard
  if (!requireAdmin(req, res)) return;

  // Ensure DB table exists & seeded
  if (!schemaInitialized) {
    try {
      await initSchema();
      await ensureProjectTypesSeeded();
      schemaInitialized = true;
    } catch (err) {
      console.warn('Could not auto-migrate schema in project-types handler:', err.message);
    }
  }

  try {
    // 1. GET all project types
    if (req.method === 'GET') {
      let items = [];
      let countsMap = {};

      try {
        const result = await query('SELECT * FROM project_types ORDER BY sort_order ASC, id ASC');
        items = result.rows || [];

        // Count projects per type
        const countRes = await query('SELECT project_type, COUNT(*) AS count FROM projects WHERE project_type IS NOT NULL GROUP BY project_type');
        countRes.rows.forEach(r => {
          countsMap[r.project_type] = parseInt(r.count, 10);
        });
      } catch (dbErr) {
        console.warn('Project types DB query failed, using fallback:', dbErr.message);
      }

      if (items.length === 0) {
        items = getFallbackProjectTypes();
      }

      // If countsMap is empty, try computing from fallback projects
      if (Object.keys(countsMap).length === 0) {
        const projs = getFallbackProjects();
        projs.forEach(p => {
          if (p.project_type) {
            countsMap[p.project_type] = (countsMap[p.project_type] || 0) + 1;
          }
        });
      }

      const enriched = items.map(t => ({
        ...t,
        project_count: countsMap[t.name] || 0
      }));

      return res.status(200).json({ success: true, data: enriched });
    }

    // 2. POST create project type
    if (req.method === 'POST') {
      const { name, sort_order } = req.body || {};
      const trimmedName = (name && typeof name === 'string') ? name.trim() : '';

      if (!trimmedName) {
        return res.status(400).json({ success: false, error: 'Project type name is required.' });
      }

      // Try database insert
      try {
        // Check for duplicates
        const existing = await query('SELECT id FROM project_types WHERE LOWER(name) = LOWER($1)', [trimmedName]);
        if (existing.rows.length > 0) {
          return res.status(400).json({ success: false, error: `Project type "${trimmedName}" already exists.` });
        }

        let order = sort_order;
        if (order === undefined || order === null) {
          const maxOrderRes = await query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM project_types');
          order = maxOrderRes.rows[0].next_order;
        }

        const insertRes = await query(
          `INSERT INTO project_types (name, sort_order)
           VALUES ($1, $2)
           RETURNING *`,
          [trimmedName, order]
        );

        await syncBackup();
        return res.status(201).json({ success: true, data: { ...insertRes.rows[0], project_count: 0 } });
      } catch (dbErr) {
        console.warn('DB insert failed for project type, applying local fallback:', dbErr.message);
        // Fallback for file/local mode
        const currentTypes = getFallbackProjectTypes();
        if (currentTypes.some(t => t.name.toLowerCase() === trimmedName.toLowerCase())) {
          return res.status(400).json({ success: false, error: `Project type "${trimmedName}" already exists.` });
        }
        const nextId = currentTypes.reduce((max, t) => Math.max(max, t.id || 0), 0) + 1;
        const nextOrder = currentTypes.reduce((max, t) => Math.max(max, t.sort_order || 0), 0) + 1;
        const newType = { id: nextId, name: trimmedName, sort_order: sort_order || nextOrder, project_count: 0 };
        currentTypes.push(newType);
        saveJsonBackup('project_types_backup.json', currentTypes);
        return res.status(201).json({ success: true, data: newType });
      }
    }

    // 3. PUT update project type (single rename or reorder items)
    if (req.method === 'PUT') {
      const b = req.body || {};

      // Batch reordering
      if (Array.isArray(b.items)) {
        try {
          for (const item of b.items) {
            if (item.id && item.sort_order !== undefined) {
              await query('UPDATE project_types SET sort_order = $1 WHERE id = $2', [item.sort_order, item.id]);
            }
          }
          await syncBackup();
        } catch (_) {
          const currentTypes = getFallbackProjectTypes();
          b.items.forEach(it => {
            const match = currentTypes.find(t => String(t.id) === String(it.id));
            if (match) match.sort_order = it.sort_order;
          });
          saveJsonBackup('project_types_backup.json', currentTypes);
        }
        return res.status(200).json({ success: true, message: 'Project types reordered' });
      }

      // Single item update / rename
      const { id, name, sort_order } = b;
      if (!id) {
        return res.status(400).json({ success: false, error: 'Project type ID is required.' });
      }

      const trimmedName = (name && typeof name === 'string') ? name.trim() : '';
      if (!trimmedName) {
        return res.status(400).json({ success: false, error: 'Project type name cannot be empty.' });
      }

      try {
        // Find existing record
        const findRes = await query('SELECT * FROM project_types WHERE id = $1', [id]);
        if (findRes.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'Project type not found.' });
        }
        const oldType = findRes.rows[0];
        const oldName = oldType.name;

        // Check if name collides with another type
        const dupCheck = await query('SELECT id FROM project_types WHERE LOWER(name) = LOWER($1) AND id != $2', [trimmedName, id]);
        if (dupCheck.rows.length > 0) {
          return res.status(400).json({ success: false, error: `Another project type named "${trimmedName}" already exists.` });
        }

        const updateRes = await query(
          `UPDATE project_types
           SET name = $1,
               sort_order = COALESCE($2, sort_order)
           WHERE id = $3
           RETURNING *`,
          [trimmedName, sort_order !== undefined ? sort_order : oldType.sort_order, id]
        );

        // Cascade rename to existing projects only if projects actually used this type
        if (oldName && oldName !== trimmedName) {
          const pUpdate = await query('UPDATE projects SET project_type = $1 WHERE project_type = $2', [trimmedName, oldName]);
          if (pUpdate && pUpdate.rowCount > 0) {
            try {
              const pRes = await query('SELECT * FROM projects ORDER BY sort_order ASC, id ASC');
              if (pRes && Array.isArray(pRes.rows)) {
                saveJsonBackup('projects_backup.json', pRes.rows);
              }
            } catch (_) {}
          }
        }

        await syncBackup();
        return res.status(200).json({ success: true, data: updateRes.rows[0] });
      } catch (dbErr) {
        console.warn('DB update failed, using local fallback:', dbErr.message);
        const currentTypes = getFallbackProjectTypes();
        const idx = currentTypes.findIndex(t => String(t.id) === String(id));
        if (idx === -1) {
          return res.status(404).json({ success: false, error: 'Project type not found.' });
        }
        const oldName = currentTypes[idx].name;
        currentTypes[idx].name = trimmedName;
        if (sort_order !== undefined) currentTypes[idx].sort_order = sort_order;
        saveJsonBackup('project_types_backup.json', currentTypes);

        // Also update local projects backup if needed
        const projs = getFallbackProjects();
        let changedProjects = false;
        projs.forEach(p => {
          if (p.project_type === oldName) {
            p.project_type = trimmedName;
            changedProjects = true;
          }
        });
        if (changedProjects) {
          saveJsonBackup('projects_backup.json', projs);
        }

        return res.status(200).json({ success: true, data: currentTypes[idx] });
      }
    }

    // 4. DELETE project type
    if (req.method === 'DELETE') {
      const id = req.query?.id || req.body?.id;
      if (!id) {
        return res.status(400).json({ success: false, error: 'Project type ID is required.' });
      }

      try {
        const findRes = await query('SELECT * FROM project_types WHERE id = $1', [id]);
        if (findRes.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'Project type not found.' });
        }
        const deletedType = findRes.rows[0];

        await query('DELETE FROM project_types WHERE id = $1', [id]);

        // Reassign affected projects to 'Other' only if projects actually used this type
        const pReassign = await query("UPDATE projects SET project_type = 'Other' WHERE project_type = $1", [deletedType.name]);
        if (pReassign && pReassign.rowCount > 0) {
          try {
            const pRes = await query('SELECT * FROM projects ORDER BY sort_order ASC, id ASC');
            if (pRes && Array.isArray(pRes.rows)) {
              saveJsonBackup('projects_backup.json', pRes.rows);
            }
          } catch (_) {}
        }

        await syncBackup();
        return res.status(200).json({
          success: true,
          message: `Project type "${deletedType.name}" deleted. Any associated projects were updated to "Other".`,
          id: deletedType.id
        });
      } catch (dbErr) {
        console.warn('DB delete failed, using local fallback:', dbErr.message);
        const currentTypes = getFallbackProjectTypes();
        const idx = currentTypes.findIndex(t => String(t.id) === String(id));
        if (idx === -1) {
          return res.status(404).json({ success: false, error: 'Project type not found.' });
        }
        const [deleted] = currentTypes.splice(idx, 1);
        saveJsonBackup('project_types_backup.json', currentTypes);

        const projs = getFallbackProjects();
        let changedProjects = false;
        projs.forEach(p => {
          if (p.project_type === deleted.name) {
            p.project_type = 'Other';
            changedProjects = true;
          }
        });
        if (changedProjects) {
          saveJsonBackup('projects_backup.json', projs);
        }

        return res.status(200).json({
          success: true,
          message: `Project type "${deleted.name}" deleted.`,
          id: deleted.id
        });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Error in /api/admin/project-types:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
