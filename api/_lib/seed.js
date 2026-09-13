import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, getClient, exec } from './db.js';
import { parseProfile } from './parseProfile.js';

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
 * Checks if personal_info table exists and has at least one record
 */
export async function isSeeded() {
  try {
    const res = await query('SELECT COUNT(*) AS count FROM personal_info');
    const count = parseInt(res.rows[0]?.count || '0', 10);
    return count > 0;
  } catch (err) {
    // If table doesn't exist yet, it's not seeded
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
    const backupFile = path.resolve(__dirname, '../../.data/personal_info_backup.json');
    if (fs.existsSync(backupFile)) {
      try {
        const saved = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));
        if (saved && saved.name) {
          p = { ...p, ...saved };
        }
      } catch (_) {}
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
    const settingsFile = path.resolve(__dirname, '../../.data/admin_settings.json');
    if (fs.existsSync(settingsFile)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
        if (settings && settings.master_password) {
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
          `, [settings.master_password]);
        }
      } catch (_) {}
    }

    // 2. Insert Experience
    for (const exp of data.experience) {
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
          exp.sort_order
        ]
      );
    }

    // 3. Insert Projects
    const projectsBackupFile = path.resolve(__dirname, '../../.data/projects_backup.json');
    let projectsToSeed = data.projects;
    let isFromBackup = false;
    if (fs.existsSync(projectsBackupFile)) {
      try {
        const savedProjects = JSON.parse(fs.readFileSync(projectsBackupFile, 'utf-8'));
        if (Array.isArray(savedProjects) && savedProjects.length > 0) {
          projectsToSeed = savedProjects;
          isFromBackup = true;
        }
      } catch (_) {}
    }

    for (const proj of projectsToSeed) {
      if (isFromBackup) {
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
            proj.video_url || null,
            proj.powerbi_url || null,
            proj.linkedin_url || null,
            proj.github_url || null,
            proj.platform_name || null,
            proj.external_link || null,
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
            proj.video_url,
            proj.external_link,
            proj.sort_order,
            true
          ]
        );
      }
    }

    // 4. Insert Skills
    for (const skill of data.skills) {
      await client.query(
        `INSERT INTO skills 
          (category, value, sort_order)
         VALUES ($1, $2, $3)`,
        [
          skill.category,
          skill.value,
          skill.sort_order
        ]
      );
    }

    // 5. Insert FAQ
    for (const faqItem of data.faq) {
      await client.query(
        `INSERT INTO faq 
          (question, answer, sort_order)
         VALUES ($1, $2, $3)`,
        [
          faqItem.question,
          faqItem.answer,
          faqItem.sort_order
        ]
      );
    }

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
