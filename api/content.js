import { query } from './_lib/db.js';
import { ensureSeeded } from './_lib/seed.js';

/**
 * Vercel Serverless Function: GET /api/content
 * Returns public portfolio data: personal_info, experience, projects, skills, faq
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

  try {
    // Ensure database has initial data
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
    const projRes = await query('SELECT id, name, description, tech_tags, thumbnail_url, video_url, external_link, sort_order FROM projects ORDER BY sort_order ASC, id ASC');
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

    // Cache control for public read (revalidate every 60 seconds)
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

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
  } catch (err) {
    console.error('Error fetching content:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve portfolio content',
      details: err.message
    });
  }
}
