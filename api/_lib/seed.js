import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, getClient, exec } from './db.js';
import { parseProfile } from './parseProfile.js';
import { loadJsonBackup } from './dataStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initializes tables from schema.sql if they do not exist
 */
export async function initSchema() {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  await exec(sql);
}

/**
 * Checks if all required database tables exist and have records
 */
export async function isSeeded() {
  try {
    const [pRes, projRes, expRes, skillRes, faqRes] = await Promise.all([
      query('SELECT COUNT(*) AS count FROM personal_info'),
      query('SELECT COUNT(*) AS count FROM projects'),
      query('SELECT COUNT(*) AS count FROM experience'),
      query('SELECT COUNT(*) AS count FROM skills'),
      query('SELECT COUNT(*) AS count FROM faq')
    ]);
    const pCount = parseInt(pRes.rows[0]?.count || '0', 10);
    const projCount = parseInt(projRes.rows[0]?.count || '0', 10);
    const expCount = parseInt(expRes.rows[0]?.count || '0', 10);
    const skillCount = parseInt(skillRes.rows[0]?.count || '0', 10);
    const faqCount = parseInt(faqRes.rows[0]?.count || '0', 10);

    return pCount > 0 && projCount > 0 && expCount > 0 && skillCount > 0 && faqCount > 0;
  } catch (err) {
    // If any table doesn't exist yet, it's not seeded
    return false;
  }
}

/**
 * Seeds the database using profile.md
 * @param {boolean} [force=false] - If true, truncates and re-seeds all tables
 */
export async function seedDatabase(force = false) {
  await initSchema();

  const alreadySeeded = await isSeeded();
  if (alreadySeeded && !force) {
    return {
      seeded: false,
      reason: 'Database is already seeded. Live records preserved.'
    };
  }

  const profilePath = path.resolve(__dirname, '../../profile.md');
  const data = parseProfile(profilePath);

  const client = await getClient();

  try {
    await client.query('BEGIN');

    if (force) {
      await client.query('TRUNCATE TABLE faq, skills, projects, experience, personal_info RESTART IDENTITY CASCADE');
    }

    // 1. Insert Personal Info
    let p = data.personalInfo || {};
    const savedPersonal = loadJsonBackup('personal_info_backup.json');
    if (savedPersonal && savedPersonal.name) {
      p = { ...p, ...savedPersonal };
    }

    await client.query(
      `INSERT INTO personal_info 
        (name, title, location, email, linkedin_url, github_url, bio, resume_url, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        p.name || 'Ankeeth V',
        p.title || 'Senior Engineer',
        p.location || 'Bengaluru, India',
        p.email || 'ankeeth.v@gmail.com',
        p.linkedin_url || null,
        p.github_url || null,
        p.bio || '',
        p.resume_url || '/resume.pdf',
        p.photo_url || '/assets/placeholder-avatar.svg'
      ]
    );

    // Restore Admin Settings (master password) if available
    const savedSettings = loadJsonBackup('admin_settings.json');
    if (savedSettings && savedSettings.master_password) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS admin_settings (
          key VARCHAR(100) PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await client.query(`
        INSERT INTO admin_settings (key, value, updated_at)
        VALUES ('master_password', $1, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `, [savedSettings.master_password]);
    }

    // 2. Insert Experience
    const savedExp = loadJsonBackup('experience_backup.json');
    const expToSeed = (Array.isArray(savedExp) && savedExp.length > 0) ? savedExp : data.experience;
    for (const exp of expToSeed) {
      if (exp.id) {
        await client.query(
          `INSERT INTO experience 
            (id, company, title, start_date, end_date, bullets, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            exp.id,
            exp.company,
            exp.title,
            exp.start_date,
            exp.end_date,
            JSON.stringify(exp.bullets || []),
            exp.sort_order || 0
          ]
        );
      } else {
        await client.query(
          `INSERT INTO experience 
            (company, title, start_date, end_date, bullets, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            exp.company,
            exp.title,
            exp.start_date,
            exp.end_date,
            JSON.stringify(exp.bullets || []),
            exp.sort_order || 0
          ]
        );
      }
    }
    try {
      await client.query("SELECT setval(pg_get_serial_sequence('experience', 'id'), COALESCE((SELECT MAX(id) FROM experience), 1))");
    } catch (_) {}

    // 3. Insert Projects
    const savedProjects = loadJsonBackup('projects_backup.json');
    let projectsToSeed = data.projects;
    let isFromBackup = false;
    if (Array.isArray(savedProjects) && savedProjects.length > 0) {
      projectsToSeed = savedProjects;
      isFromBackup = true;
    }

    const cleanLink = (link) => {
      if (!link || typeof link !== 'string') return null;
      const trimmed = link.trim();
      if (!trimmed || trimmed.toLowerCase().includes('not specified in the source')) return null;
      return trimmed;
    };

    for (const proj of projectsToSeed) {
      const sanitizedExternal = cleanLink(proj.external_link);
      const sanitizedVideo = cleanLink(proj.video_url);
      const sanitizedPowerBi = cleanLink(proj.powerbi_url);
      const sanitizedLinkedIn = cleanLink(proj.linkedin_url);
      const sanitizedGitHub = cleanLink(proj.github_url);

      if (isFromBackup && proj.id) {
        await client.query(
          `INSERT INTO projects 
            (id, name, description, project_type, domain, other_tools, short_info,
             tech_tags, thumbnail_url, screenshot1_url, screenshot1_desc,
             screenshot2_url, screenshot2_desc, video_url, powerbi_url,
             linkedin_url, github_url, platform_name, external_link,
             is_visible, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
          [
            proj.id,
            proj.name,
            proj.description || '',
            proj.project_type || null,
            proj.domain || null,
            proj.other_tools || null,
            proj.short_info || null,
            JSON.stringify(Array.isArray(proj.tech_tags) ? proj.tech_tags : []),
            proj.thumbnail_url || '/assets/placeholder-avatar.svg',
            proj.screenshot1_url || null,
            proj.screenshot1_desc || null,
            proj.screenshot2_url || null,
            proj.screenshot2_desc || null,
            sanitizedVideo,
            sanitizedPowerBi,
            sanitizedLinkedIn,
            sanitizedGitHub,
            proj.platform_name || null,
            sanitizedExternal,
            proj.is_visible !== false,
            proj.sort_order || 0
          ]
        );
      } else if (isFromBackup) {
        await client.query(
          `INSERT INTO projects 
            (name, description, project_type, domain, other_tools, short_info,
             tech_tags, thumbnail_url, screenshot1_url, screenshot1_desc,
             screenshot2_url, screenshot2_desc, video_url, powerbi_url,
             linkedin_url, github_url, platform_name, external_link,
             is_visible, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
          [
            proj.name,
            proj.description || '',
            proj.project_type || null,
            proj.domain || null,
            proj.other_tools || null,
            proj.short_info || null,
            JSON.stringify(Array.isArray(proj.tech_tags) ? proj.tech_tags : []),
            proj.thumbnail_url || '/assets/placeholder-avatar.svg',
            proj.screenshot1_url || null,
            proj.screenshot1_desc || null,
            proj.screenshot2_url || null,
            proj.screenshot2_desc || null,
            sanitizedVideo,
            sanitizedPowerBi,
            sanitizedLinkedIn,
            sanitizedGitHub,
            proj.platform_name || null,
            sanitizedExternal,
            proj.is_visible !== false,
            proj.sort_order || 0
          ]
        );
      } else {
        await client.query(
          `INSERT INTO projects 
            (name, description, tech_tags, thumbnail_url, video_url, external_link, sort_order, is_visible)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            proj.name,
            proj.description,
            JSON.stringify(proj.tech_tags || []),
            proj.thumbnail_url,
            sanitizedVideo,
            sanitizedExternal,
            proj.sort_order || 0,
            true
          ]
        );
      }
    }
    try {
      await client.query("SELECT setval(pg_get_serial_sequence('projects', 'id'), COALESCE((SELECT MAX(id) FROM projects), 1))");
    } catch (_) {}

    // 4. Insert Skills
    const savedSkills = loadJsonBackup('skills_backup.json');
    const skillsToSeed = (Array.isArray(savedSkills) && savedSkills.length > 0) ? savedSkills : data.skills;
    for (const skill of skillsToSeed) {
      if (skill.id) {
        await client.query(
          `INSERT INTO skills 
            (id, category, value, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [
            skill.id,
            skill.category,
            skill.value,
            skill.sort_order || 0
          ]
        );
      } else {
        await client.query(
          `INSERT INTO skills 
            (category, value, sort_order)
           VALUES ($1, $2, $3)`,
          [
            skill.category,
            skill.value,
            skill.sort_order || 0
          ]
        );
      }
    }
    try {
      await client.query("SELECT setval(pg_get_serial_sequence('skills', 'id'), COALESCE((SELECT MAX(id) FROM skills), 1))");
    } catch (_) {}

    // 5. Insert FAQ
    const savedFaq = loadJsonBackup('faq_backup.json');
    const faqToSeed = (Array.isArray(savedFaq) && savedFaq.length > 0) ? savedFaq : data.faq;
    for (const faqItem of faqToSeed) {
      if (faqItem.id) {
        await client.query(
          `INSERT INTO faq 
            (id, question, answer, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [
            faqItem.id,
            faqItem.question,
            faqItem.answer,
            faqItem.sort_order || 0
          ]
        );
      } else {
        await client.query(
          `INSERT INTO faq 
            (question, answer, sort_order)
           VALUES ($1, $2, $3)`,
          [
            faqItem.question,
            faqItem.answer,
            faqItem.sort_order || 0
          ]
        );
      }
    }
    try {
      await client.query("SELECT setval(pg_get_serial_sequence('faq', 'id'), COALESCE((SELECT MAX(id) FROM faq), 1))");
    } catch (_) {}

    await client.query('COMMIT');

    return {
      seeded: true,
      counts: {
        personalInfo: 1,
        experience: data.experience.length,
        projects: data.projects.length,
        skills: data.skills.length,
        faq: data.faq.length
      }
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during database seeding:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Ensures the database is seeded; safe to call on serverless cold boots
 */
export async function ensureSeeded() {
  const seeded = await isSeeded();
  if (!seeded) {
    return await seedDatabase(false);
  }
  return { seeded: false, reason: 'Already seeded' };
}

export default {
  initSchema,
  isSeeded,
  seedDatabase,
  ensureSeeded
};
