import { query } from '../db.js';
import { requireAdmin } from '../auth.js';
import { initSchema, ensureSeeded } from '../seed.js';
import {
  getFallbackPersonalInfo,
  getFallbackExperience,
  getFallbackProjects,
  getFallbackSkills,
  getFallbackFaq
} from './fallbackHelper.js';
import {
  saveJsonBackup,
  syncPersonalInfoToProfileMd,
  syncProjectsToProfileMd,
  syncExperienceToProfileMd,
  syncSkillsToProfileMd,
  syncFaqToProfileMd
} from '../dataStore.js';

/**
 * /api/admin/backup
 * GET: Export entire portfolio dataset in a single JSON payload
 * POST: Restore entire portfolio dataset and persist to DB + backup files
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Auth Guard
  if (!requireAdmin(req, res)) return;

  try {
    // 1. GET: Export full dataset
    if (req.method === 'GET') {
      let personal_info = null;
      let experience = [];
      let projects = [];
      let skills = [];
      let faq = [];

      try {
        const pRes = await query('SELECT * FROM personal_info ORDER BY id ASC LIMIT 1');
        personal_info = pRes.rows[0] || null;
      } catch (_) {}
      if (!personal_info) personal_info = getFallbackPersonalInfo();

      try {
        const eRes = await query('SELECT * FROM experience ORDER BY sort_order ASC, id ASC');
        experience = eRes.rows.map(row => ({
          ...row,
          bullets: typeof row.bullets === 'string' ? JSON.parse(row.bullets) : (row.bullets || [])
        }));
      } catch (_) {}
      if (experience.length === 0) experience = getFallbackExperience();

      try {
        const projRes = await query('SELECT * FROM projects ORDER BY sort_order ASC, id ASC');
        projects = projRes.rows.map(row => ({
          ...row,
          tech_tags: typeof row.tech_tags === 'string' ? JSON.parse(row.tech_tags) : (row.tech_tags || []),
          is_visible: row.is_visible !== false
        }));
      } catch (_) {}
      if (projects.length === 0) projects = getFallbackProjects();

      try {
        const sRes = await query('SELECT * FROM skills ORDER BY category ASC, sort_order ASC, id ASC');
        skills = sRes.rows;
      } catch (_) {}
      if (skills.length === 0) skills = getFallbackSkills();

      try {
        const fRes = await query('SELECT * FROM faq ORDER BY sort_order ASC, id ASC');
        faq = fRes.rows;
      } catch (_) {}
      if (faq.length === 0) faq = getFallbackFaq();

      return res.status(200).json({
        success: true,
        exported_at: new Date().toISOString(),
        data: {
          personal_info,
          experience,
          projects,
          skills,
          faq
        }
      });
    }

    // 2. POST: Restore full dataset
    if (req.method === 'POST') {
      const backup = req.body?.data || req.body || {};
      const { personal_info, experience, projects, skills, faq } = backup;

      try {
        await initSchema();
      } catch (_) {}

      // 2a. Restore Personal Info
      if (personal_info && typeof personal_info === 'object') {
        let existing = {};
        try {
          const check = await query('SELECT * FROM personal_info LIMIT 1');
          existing = check.rows[0] || {};
        } catch (_) {}

        const mergedPersonal = {
          id: existing.id || 1,
          name: personal_info.name || existing.name || 'Ankeeth V',
          title: personal_info.title !== undefined ? personal_info.title : (existing.title || ''),
          location: personal_info.location !== undefined ? personal_info.location : (existing.location || ''),
          email: personal_info.email || existing.email || 'ankeeth.v@gmail.com',
          linkedin_url: personal_info.linkedin_url !== undefined ? personal_info.linkedin_url : existing.linkedin_url,
          github_url: personal_info.github_url !== undefined ? personal_info.github_url : existing.github_url,
          bio: personal_info.bio !== undefined ? personal_info.bio : (existing.bio || ''),
          resume_url: personal_info.resume_url || existing.resume_url || '/resume.pdf',
          photo_url: personal_info.photo_url || existing.photo_url || '/assets/placeholder-avatar.svg'
        };

        try {
          if (existing.id) {
            await query(
              `UPDATE personal_info SET
                name = $1, title = $2, location = $3, email = $4,
                linkedin_url = $5, github_url = $6, bio = $7,
                resume_url = $8, photo_url = $9, updated_at = NOW()
               WHERE id = $10`,
              [
                mergedPersonal.name,
                mergedPersonal.title,
                mergedPersonal.location,
                mergedPersonal.email,
                mergedPersonal.linkedin_url,
                mergedPersonal.github_url,
                mergedPersonal.bio,
                mergedPersonal.resume_url,
                mergedPersonal.photo_url,
                existing.id
              ]
            );
          } else {
            await query(
              `INSERT INTO personal_info (name, title, location, email, linkedin_url, github_url, bio, resume_url, photo_url, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
              [
                mergedPersonal.name,
                mergedPersonal.title,
                mergedPersonal.location,
                mergedPersonal.email,
                mergedPersonal.linkedin_url,
                mergedPersonal.github_url,
                mergedPersonal.bio,
                mergedPersonal.resume_url,
                mergedPersonal.photo_url
              ]
            );
          }
        } catch (dbErr) {
          console.warn('DB personal-info restore failed:', dbErr.message);
        }

        saveJsonBackup('personal_info_backup.json', mergedPersonal);
        syncPersonalInfoToProfileMd(mergedPersonal);
      }

      // 2b. Restore Experience
      if (Array.isArray(experience)) {
        try {
          await query('DELETE FROM experience');
          for (let i = 0; i < experience.length; i++) {
            const exp = experience[i];
            const numId = exp.id ? parseInt(exp.id, 10) : null;
            if (numId && !isNaN(numId)) {
              await query(
                `INSERT INTO experience (id, company, title, start_date, end_date, bullets, sort_order)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                  numId,
                  exp.company,
                  exp.title,
                  exp.start_date,
                  exp.end_date,
                  JSON.stringify(Array.isArray(exp.bullets) ? exp.bullets : []),
                  exp.sort_order !== undefined ? exp.sort_order : i + 1
                ]
              );
            } else {
              await query(
                `INSERT INTO experience (company, title, start_date, end_date, bullets, sort_order)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                  exp.company,
                  exp.title,
                  exp.start_date,
                  exp.end_date,
                  JSON.stringify(Array.isArray(exp.bullets) ? exp.bullets : []),
                  exp.sort_order !== undefined ? exp.sort_order : i + 1
                ]
              );
            }
          }
          try {
            await query("SELECT setval(pg_get_serial_sequence('experience', 'id'), COALESCE((SELECT MAX(id) FROM experience), 1))");
          } catch (_) {}
        } catch (dbErr) {
          console.warn('DB experience restore failed:', dbErr.message);
        }
        saveJsonBackup('experience_backup.json', experience);
        syncExperienceToProfileMd(experience);
      }

      // 2c. Restore Projects
      if (Array.isArray(projects)) {
        try {
          await query('DELETE FROM projects');
          for (let i = 0; i < projects.length; i++) {
            const proj = projects[i];
            const tags = Array.isArray(proj.tech_tags) ? proj.tech_tags : [];
            const numId = proj.id ? parseInt(proj.id, 10) : null;
            if (numId && !isNaN(numId)) {
              await query(
                `INSERT INTO projects (
                  id, name, description, project_type, domain, other_tools, short_info,
                  tech_tags, thumbnail_url, screenshot1_url, screenshot1_desc,
                  screenshot2_url, screenshot2_desc, video_url, powerbi_url,
                  linkedin_url, github_url, platform_name, external_link,
                  is_visible, sort_order
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
                [
                  numId,
                  proj.name,
                  proj.description,
                  proj.project_type || 'Analytics',
                  proj.domain || null,
                  proj.other_tools || null,
                  proj.short_info || null,
                  JSON.stringify(tags),
                  proj.thumbnail_url || null,
                  proj.screenshot1_url || null,
                  proj.screenshot1_desc || null,
                  proj.screenshot2_url || null,
                  proj.screenshot2_desc || null,
                  proj.video_url || null,
                  proj.powerbi_url || null,
                  proj.linkedin_url || null,
                  proj.github_url || null,
                  proj.platform_name || null,
                  proj.external_link || null,
                  proj.is_visible !== false,
                  proj.sort_order !== undefined ? proj.sort_order : i + 1
                ]
              );
            } else {
              await query(
                `INSERT INTO projects (
                  name, description, project_type, domain, other_tools, short_info,
                  tech_tags, thumbnail_url, screenshot1_url, screenshot1_desc,
                  screenshot2_url, screenshot2_desc, video_url, powerbi_url,
                  linkedin_url, github_url, platform_name, external_link,
                  is_visible, sort_order
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
                [
                  proj.name,
                  proj.description,
                  proj.project_type || 'Analytics',
                  proj.domain || null,
                  proj.other_tools || null,
                  proj.short_info || null,
                  JSON.stringify(tags),
                  proj.thumbnail_url || null,
                  proj.screenshot1_url || null,
                  proj.screenshot1_desc || null,
                  proj.screenshot2_url || null,
                  proj.screenshot2_desc || null,
                  proj.video_url || null,
                  proj.powerbi_url || null,
                  proj.linkedin_url || null,
                  proj.github_url || null,
                  proj.platform_name || null,
                  proj.external_link || null,
                  proj.is_visible !== false,
                  proj.sort_order !== undefined ? proj.sort_order : i + 1
                ]
              );
            }
          }
          try {
            await query("SELECT setval(pg_get_serial_sequence('projects', 'id'), COALESCE((SELECT MAX(id) FROM projects), 1))");
          } catch (_) {}
        } catch (dbErr) {
          console.warn('DB projects restore failed:', dbErr.message);
        }
        saveJsonBackup('projects_backup.json', projects);
        syncProjectsToProfileMd(projects);
      }

      // 2d. Restore Skills
      if (Array.isArray(skills)) {
        try {
          await query('DELETE FROM skills');
          for (let i = 0; i < skills.length; i++) {
            const s = skills[i];
            const numId = s.id ? parseInt(s.id, 10) : null;
            if (numId && !isNaN(numId)) {
              await query(
                `INSERT INTO skills (id, category, value, sort_order) VALUES ($1, $2, $3, $4)`,
                [
                  numId,
                  (s.category || 'technical').toLowerCase(),
                  s.value,
                  s.sort_order !== undefined ? s.sort_order : i + 1
                ]
              );
            } else {
              await query(
                `INSERT INTO skills (category, value, sort_order) VALUES ($1, $2, $3)`,
                [
                  (s.category || 'technical').toLowerCase(),
                  s.value,
                  s.sort_order !== undefined ? s.sort_order : i + 1
                ]
              );
            }
          }
          try {
            await query("SELECT setval(pg_get_serial_sequence('skills', 'id'), COALESCE((SELECT MAX(id) FROM skills), 1))");
          } catch (_) {}
        } catch (dbErr) {
          console.warn('DB skills restore failed:', dbErr.message);
        }
        saveJsonBackup('skills_backup.json', skills);
        syncSkillsToProfileMd(skills);
      }

      // 2e. Restore FAQ
      if (Array.isArray(faq)) {
        try {
          await query('DELETE FROM faq');
          for (let i = 0; i < faq.length; i++) {
            const f = faq[i];
            const numId = f.id ? parseInt(f.id, 10) : null;
            if (numId && !isNaN(numId)) {
              await query(
                `INSERT INTO faq (id, question, answer, sort_order) VALUES ($1, $2, $3, $4)`,
                [
                  numId,
                  f.question,
                  f.answer,
                  f.sort_order !== undefined ? f.sort_order : i + 1
                ]
              );
            } else {
              await query(
                `INSERT INTO faq (question, answer, sort_order) VALUES ($1, $2, $3)`,
                [
                  f.question,
                  f.answer,
                  f.sort_order !== undefined ? f.sort_order : i + 1
                ]
              );
            }
          }
          try {
            await query("SELECT setval(pg_get_serial_sequence('faq', 'id'), COALESCE((SELECT MAX(id) FROM faq), 1))");
          } catch (_) {}
        } catch (dbErr) {
          console.warn('DB faq restore failed:', dbErr.message);
        }
        saveJsonBackup('faq_backup.json', faq);
        syncFaqToProfileMd(faq);
      }

      return res.status(200).json({
        success: true,
        message: 'All portfolio datasets successfully restored and persisted.'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Error in /api/admin/backup:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
