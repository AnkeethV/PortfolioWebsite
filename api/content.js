import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query } from './_lib/db.js';
import { ensureSeeded } from './_lib/seed.js';
import { parseProfile } from './_lib/parseProfile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parses profile.md directly as a robust zero-failure fallback
 * when a live PostgreSQL database is not connected on Vercel.
 */
function getFallbackContent() {
  const profilePath = path.resolve(__dirname, '../profile.md');
  if (!fs.existsSync(profilePath)) {
    throw new Error(`profile.md not found at ${profilePath}`);
  }
  const parsed = parseProfile(profilePath);

  const skills = {
    technical: [],
    tools: [],
    soft: []
  };

  (parsed.skills || []).forEach((s, idx) => {
    const cat = s.category ? s.category.toLowerCase() : 'technical';
    const item = { id: s.id || idx + 1, value: s.value, sort_order: s.sort_order || idx + 1 };
    if (skills[cat]) {
      skills[cat].push(item);
    } else {
      skills.technical.push(item);
    }
  });

  const backupDir = process.env.VERCEL ? '/tmp' : path.resolve(__dirname, '../.data');
  const projectsBackup = path.join(backupDir, 'projects_backup.json');
  let fallbackProjects = (parsed.projects || []).map(p => ({ ...p, is_visible: p.is_visible !== false }));
  if (fs.existsSync(projectsBackup)) {
    try {
      const saved = JSON.parse(fs.readFileSync(projectsBackup, 'utf-8'));
      if (Array.isArray(saved) && saved.length > 0) {
        fallbackProjects = saved.map(row => ({
          ...row,
          tech_tags: typeof row.tech_tags === 'string' ? JSON.parse(row.tech_tags) : (row.tech_tags || []),
          is_visible: row.is_visible !== false
        }));
      }
    } catch (_) {}
  }
  const visibleProjects = fallbackProjects.filter(p => p.is_visible !== false);

  return {
    personal_info: parsed.personalInfo,
    experience: parsed.experience,
    projects: visibleProjects,
    skills,
    faq: parsed.faq
  };
}

/**
 * Vercel Serverless Function: GET /api/content
 * Returns public portfolio data: personal_info, experience, projects, skills, faq
 * Seamlessly pulls from PostgreSQL when available, or instantly falls back to
 * profile.md so the live website is NEVER blank.
 */
export default async function handler(req, res) {
  // CORS & method check
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  // 1. Attempt database query first (both remote Postgres or local PGlite)
  try {
    await ensureSeeded();

    // 1. Fetch Personal Info
    const pRes = await query('SELECT * FROM personal_info ORDER BY id ASC LIMIT 1');
    const personalInfo = pRes.rows[0] || null;

    // 2. Fetch Experience
    const eRes = await query('SELECT id, company, title, start_date, end_date, bullets, sort_order FROM experience ORDER BY sort_order ASC, id ASC');
    const experience = eRes.rows.map(row => ({
      ...row,
      bullets: typeof row.bullets === 'string' ? JSON.parse(row.bullets) : (row.bullets || [])
    }));

    // 3. Fetch Projects
    const projRes = await query('SELECT * FROM projects WHERE is_visible IS NOT FALSE ORDER BY sort_order ASC, id ASC');
    const projects = projRes.rows.map(row => ({
      ...row,
      tech_tags: typeof row.tech_tags === 'string' ? JSON.parse(row.tech_tags) : (row.tech_tags || [])
    }));

    // 4. Fetch Skills (grouped by category)
    const sRes = await query('SELECT id, category, value, sort_order FROM skills ORDER BY sort_order ASC, id ASC');
    const skills = {
      technical: [],
      tools: [],
      soft: []
    };
    sRes.rows.forEach(s => {
      const cat = s.category ? s.category.toLowerCase() : 'technical';
      if (skills[cat]) {
        skills[cat].push({ id: s.id, value: s.value, sort_order: s.sort_order });
      } else {
        skills.technical.push({ id: s.id, value: s.value, sort_order: s.sort_order });
      }
    });

    // 5. Fetch FAQ
    const fRes = await query('SELECT id, question, answer, sort_order FROM faq ORDER BY sort_order ASC, id ASC');
    const faq = fRes.rows;

    if (personalInfo || (experience && experience.length > 0)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.status(200).json({
        success: true,
        data: {
          personal_info: personalInfo,
          experience,
          projects,
          skills,
          faq
        }
      });
    }
  } catch (err) {
    console.warn('Database query failed or unconfigured, falling back to profile.md content:', err.message);
  }

  // 2. Fallback: Parse profile.md directly (zero-config, high performance, always works)
  try {
    const fallbackData = getFallbackContent();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.status(200).json({
      success: true,
      data: fallbackData,
      source: 'profile_markdown'
    });
  } catch (fallbackErr) {
    console.error('Fatal error loading fallback content:', fallbackErr);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve portfolio content',
      details: fallbackErr.message
    });
  }
}
