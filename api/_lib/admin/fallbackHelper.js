import fs from 'fs';
import path from 'path';
import { parseProfile } from '../parseProfile.js';
import { loadJsonBackup, getRootDir } from '../dataStore.js';

export function getProfileData() {
  const root = getRootDir();
  const profilePath = path.join(root, 'profile.md');
  if (!fs.existsSync(profilePath)) {
    return { personalInfo: {}, experience: [], projects: [], skills: [], faq: [] };
  }
  return parseProfile(profilePath);
}

export function getFallbackProjects() {
  const saved = loadJsonBackup('projects_backup.json');
  if (Array.isArray(saved) && saved.length > 0) {
    return saved.map(row => ({
      ...row,
      tech_tags: typeof row.tech_tags === 'string' ? JSON.parse(row.tech_tags) : (row.tech_tags || []),
      is_visible: row.is_visible !== false
    }));
  }

  const data = getProfileData();
  return (data.projects || []).map((proj, idx) => ({
    id: idx + 1,
    name: proj.name,
    description: proj.description,
    project_type: proj.project_type || 'Analytics',
    domain: proj.domain || '',
    other_tools: proj.other_tools || '',
    short_info: proj.short_info || '',
    tech_tags: Array.isArray(proj.tech_tags) ? proj.tech_tags : [],
    thumbnail_url: proj.thumbnail_url || '/assets/placeholder-avatar.svg',
    video_url: proj.video_url || null,
    powerbi_url: proj.powerbi_url || '',
    linkedin_url: proj.linkedin_url || '',
    github_url: proj.github_url || '',
    external_link: proj.external_link || '',
    is_visible: proj.is_visible !== false,
    sort_order: proj.sort_order || idx + 1
  }));
}

export function getFallbackExperience() {
  const saved = loadJsonBackup('experience_backup.json');
  if (Array.isArray(saved) && saved.length > 0) {
    return saved.map(row => ({
      ...row,
      bullets: typeof row.bullets === 'string' ? JSON.parse(row.bullets) : (row.bullets || [])
    }));
  }

  const data = getProfileData();
  return (data.experience || []).map((exp, idx) => ({
    id: idx + 1,
    company: exp.company,
    title: exp.title,
    start_date: exp.start_date,
    end_date: exp.end_date,
    bullets: Array.isArray(exp.bullets) ? exp.bullets : [],
    sort_order: exp.sort_order || idx + 1
  }));
}

export function getFallbackSkills() {
  const saved = loadJsonBackup('skills_backup.json');
  if (Array.isArray(saved) && saved.length > 0) {
    return saved;
  }

  const data = getProfileData();
  return (data.skills || []).map((skill, idx) => ({
    id: idx + 1,
    category: skill.category || 'technical',
    value: skill.value,
    sort_order: skill.sort_order || idx + 1
  }));
}

export function getFallbackFaq() {
  const saved = loadJsonBackup('faq_backup.json');
  if (Array.isArray(saved) && saved.length > 0) {
    return saved;
  }

  const data = getProfileData();
  return (data.faq || []).map((f, idx) => ({
    id: idx + 1,
    question: f.question,
    answer: f.answer,
    sort_order: f.sort_order || idx + 1
  }));
}

export function getFallbackPersonalInfo() {
  const saved = loadJsonBackup('personal_info_backup.json');
  if (saved && saved.name) {
    return saved;
  }

  const data = getProfileData();
  return {
    id: 1,
    name: data.personalInfo?.name || 'Ankeeth V',
    title: data.personalInfo?.title || 'Senior Engineer',
    location: data.personalInfo?.location || 'Bengaluru, India',
    email: data.personalInfo?.email || 'ankeeth.v@gmail.com',
    linkedin_url: data.personalInfo?.linkedin_url || 'https://www.linkedin.com/in/ankeeth-v-',
    github_url: data.personalInfo?.github_url || 'https://github.com/AnkeethV',
    bio: data.personalInfo?.bio || '',
    resume_url: data.personalInfo?.resume_url || '/resume.pdf',
    photo_url: data.personalInfo?.photo_url || '/assets/placeholder-avatar.svg'
  };
}
