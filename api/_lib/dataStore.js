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
 * Returns the unified .data directory (or /tmp on Vercel)
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
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

/**
 * Save JSON data to the unified data store
 */
export function saveJsonBackup(filename, data) {
  try {
    const dir = getDataDir();
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.warn(`Could not save backup ${filename}:`, err.message);
    return false;
  }
}

/**
 * Load JSON data from the unified data store
 */
export function loadJsonBackup(filename) {
  try {
    const dir = getDataDir();
    const filePath = path.join(dir, filename);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn(`Could not read backup ${filename}:`, err.message);
  }
  return null;
}

/**
 * Updates the ## Personal Info section in profile.md so changes persist
 * even across cold boots and database reseeds.
 */
export function syncPersonalInfoToProfileMd(info) {
  try {
    const root = getRootDir();
    const profilePath = path.join(root, 'profile.md');
    if (!fs.existsSync(profilePath)) return;

    const content = fs.readFileSync(profilePath, 'utf-8');
    const personalInfoRegex = /(## Personal Info\s*\n)([\s\S]*?)(?=\n## |\n#[^#]|$)/;

    const newSection = `## Personal Info\n\n` +
      `* Name: ${info.name || 'Ankeeth V'}\n` +
      `* Current Title: ${info.title || ''}\n` +
      `* Location: ${info.location || ''}\n` +
      `* Email: ${info.email || ''}\n` +
      `* LinkedIn: ${info.linkedin_url || ''}\n` +
      `* GitHub: ${info.github_url || ''}\n` +
      `* Bio: ${info.bio || ''}\n`;

    if (personalInfoRegex.test(content)) {
      const updated = content.replace(personalInfoRegex, newSection.trimEnd() + '\n');
      fs.writeFileSync(profilePath, updated, 'utf-8');
    }
  } catch (err) {
    // Read-only filesystem on Vercel or permission error
    console.warn('Could not sync personal info to profile.md:', err.message);
  }
}

export default {
  getRootDir,
  getDataDir,
  saveJsonBackup,
  loadJsonBackup,
  syncPersonalInfoToProfileMd
};
