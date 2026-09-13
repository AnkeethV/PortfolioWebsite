import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Returns the absolute path to the project root directory
 */
export function getRootDir() {
  let curr = __dirname;
  while (curr && !fs.existsSync(path.join(curr, 'package.json')) && path.dirname(curr) !== curr) {
    curr = path.dirname(curr);
  }
  return curr;
}

/**
 * Returns the git-tracked repo data directory (data/)
 */
export function getRepoDataDir() {
  const root = getRootDir();
  const dir = path.join(root, 'data');
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  }
  return dir;
}

/**
 * Returns the runtime cache data directory (.data or /tmp on Vercel)
 */
export function getDataDir() {
  if (process.env.VERCEL) {
    const tmpDir = '/tmp';
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    return tmpDir;
  }
  const root = getRootDir();
  const dataDir = path.join(root, '.data');
  if (!fs.existsSync(dataDir)) {
    try { fs.mkdirSync(dataDir, { recursive: true }); } catch (_) {}
  }
  return dataDir;
}

/**
 * Save JSON data to both runtime cache (.data / /tmp) and git-tracked repo data/ directory
 */
export function saveJsonBackup(filename, data) {
  let saved = false;

  // 1. Write to runtime cache (.data or /tmp)
  try {
    const dir = getDataDir();
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    saved = true;
  } catch (err) {
    console.warn(`Could not save backup to cache ${filename}:`, err.message);
  }

  // 2. Write to git-tracked repo data/ directory (if filesystem is writable)
  try {
    const repoDir = getRepoDataDir();
    const repoFilePath = path.join(repoDir, filename);
    fs.writeFileSync(repoFilePath, JSON.stringify(data, null, 2), 'utf-8');
    saved = true;
  } catch (_) {
    // Read-only filesystem in cloud deployment (e.g. AWS Lambda / Vercel)
  }

  return saved;
}

/**
 * Load JSON data from runtime cache (.data / /tmp) or fallback to git-tracked repo data/
 */
export function loadJsonBackup(filename) {
  // 1. Try runtime cache first
  try {
    const dir = getDataDir();
    const filePath = path.join(dir, filename);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed !== null && parsed !== undefined) {
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        if (!Array.isArray(parsed) && Object.keys(parsed).length > 0) return parsed;
      }
    }
  } catch (_) {}

  // 2. Fallback to git-tracked repo data/ directory
  try {
    const root = getRootDir();
    const repoFilePath = path.join(root, 'data', filename);
    if (fs.existsSync(repoFilePath)) {
      const raw = fs.readFileSync(repoFilePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed !== null && parsed !== undefined) {
        return parsed;
      }
    }
  } catch (_) {}

  return null;
}

/**
 * Helper to safely replace a specific markdown ## section in profile.md
 */
function replaceSectionInProfileMd(sectionName, newSectionContent) {
  try {
    const root = getRootDir();
    const profilePath = path.join(root, 'profile.md');
    if (!fs.existsSync(profilePath)) return false;

    const content = fs.readFileSync(profilePath, 'utf-8');
    const regex = new RegExp(`(##\\s+${sectionName}\\s*\\n)([\\s\\S]*?)(?=\\n## |\\n#[^#]|$)`, 'i');

    const formatted = `## ${sectionName}\n\n${newSectionContent.trim()}\n`;
    if (regex.test(content)) {
      const updated = content.replace(regex, formatted);
      fs.writeFileSync(profilePath, updated, 'utf-8');
      return true;
    }
  } catch (err) {
    console.warn(`Could not sync ${sectionName} to profile.md:`, err.message);
  }
  return false;
}

/**
 * Updates the ## Personal Info section in profile.md
 */
export function syncPersonalInfoToProfileMd(info) {
  if (!info) return;
  const newSection = `* Name: ${info.name || 'Ankeeth V'}\n` +
    `* Current Title: ${info.title || ''}\n` +
    `* Location: ${info.location || ''}\n` +
    `* Email: ${info.email || ''}\n` +
    `* LinkedIn: ${info.linkedin_url || ''}\n` +
    `* GitHub: ${info.github_url || ''}\n` +
    `* Bio: ${info.bio || ''}\n`;

  replaceSectionInProfileMd('Personal Info', newSection);
}

/**
 * Updates the ## Projects section in profile.md so changes persist
 */
export function syncProjectsToProfileMd(projects) {
  if (!Array.isArray(projects) || projects.length === 0) return;
  const lines = projects.map(proj => {
    const name = (proj.name || 'Untitled Project').trim();
    const desc = (proj.description || '').trim();
    const tags = Array.isArray(proj.tech_tags) ? proj.tech_tags : [];
    const techStr = tags.length > 0 ? ` — Tech: ${tags.join(', ')}` : '';
    const link = proj.external_link || proj.powerbi_url || proj.github_url || '';
    const linkStr = link ? ` — Link: ${link}` : '';
    return `* ${name} — ${desc}${techStr}${linkStr}`;
  });

  replaceSectionInProfileMd('Projects', lines.join('\n'));
}

/**
 * Updates the ## Experience section in profile.md so changes persist
 */
export function syncExperienceToProfileMd(experiences) {
  if (!Array.isArray(experiences) || experiences.length === 0) return;
  const blocks = experiences.map(exp => {
    const company = (exp.company || '').trim();
    const title = (exp.title || '').trim();
    const dates = `${exp.start_date || ''}–${exp.end_date || 'Present'}`;
    const header = `* ${company} — ${title} — ${dates}`;
    const bullets = Array.isArray(exp.bullets) ? exp.bullets : [];
    const bulletLines = bullets.map(b => `  * ${b.trim()}`).join('\n');
    return bulletLines ? `${header}\n\n${bulletLines}` : header;
  });

  replaceSectionInProfileMd('Experience', blocks.join('\n\n'));
}

/**
 * Updates the ## Skills section in profile.md so changes persist
 */
export function syncSkillsToProfileMd(skills) {
  if (!skills) return;
  let technical = [];
  let tools = [];
  let soft = [];

  if (Array.isArray(skills)) {
    skills.forEach(s => {
      const cat = (s.category || 'technical').toLowerCase();
      const val = (s.value || '').trim();
      if (!val) return;
      if (cat.includes('tool') || cat.includes('platform')) tools.push(val);
      else if (cat.includes('soft')) soft.push(val);
      else technical.push(val);
    });
  } else if (typeof skills === 'object') {
    technical = (skills.technical || []).map(s => (typeof s === 'string' ? s : s.value || '').trim()).filter(Boolean);
    tools = (skills.tools || []).map(s => (typeof s === 'string' ? s : s.value || '').trim()).filter(Boolean);
    soft = (skills.soft || []).map(s => (typeof s === 'string' ? s : s.value || '').trim()).filter(Boolean);
  }

  const lines = [
    `* Technical: ${technical.join(', ')}`,
    `* Tools & Platforms: ${tools.join(', ')}`,
    `* Soft Skills: ${soft.join(', ')}`
  ];

  replaceSectionInProfileMd('Skills', lines.join('\n'));
}

/**
 * Updates the ## FAQ section in profile.md so changes persist
 */
export function syncFaqToProfileMd(faqList) {
  if (!Array.isArray(faqList) || faqList.length === 0) return;
  const blocks = faqList.map(f => {
    const q = (f.question || '').trim();
    const a = (f.answer || '').trim();
    return `Q: ${q}\nA: ${a}`;
  });

  replaceSectionInProfileMd('FAQ', blocks.join('\n\n'));
}

export default {
  getRootDir,
  getRepoDataDir,
  getDataDir,
  saveJsonBackup,
  loadJsonBackup,
  syncPersonalInfoToProfileMd,
  syncProjectsToProfileMd,
  syncExperienceToProfileMd,
  syncSkillsToProfileMd,
  syncFaqToProfileMd
};
