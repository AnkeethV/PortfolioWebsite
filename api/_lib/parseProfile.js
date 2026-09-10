import fs from 'fs';
import path from 'path';

/**
 * Clean markdown escape sequences (e.g. "\&" -> "&")
 */
function cleanText(str) {
  if (!str) return '';
  return str.replace(/\\&/g, '&').trim();
}

/**
 * Parses profile.md into structured JavaScript objects
 * matching the database schema.
 * @param {string} filePath - Absolute path to profile.md
 * @returns {object} { personalInfo, experience, projects, skills, faq }
 */
export function parseProfile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  let currentSection = '';
  const sections = {
    personalInfo: {},
    experience: [],
    projects: [],
    skills: [],
    faq: []
  };

  let currentExperience = null;
  let currentFaq = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) continue;

    // Detect section headers (## Personal Info, ## Experience, etc.)
    const sectionMatch = line.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      // Save pending experience item if switching sections
      if (currentExperience) {
        sections.experience.push(currentExperience);
        currentExperience = null;
      }
      if (currentFaq && currentFaq.question && currentFaq.answer) {
        sections.faq.push(currentFaq);
        currentFaq = null;
      }

      currentSection = sectionMatch[1].toLowerCase().trim();
      continue;
    }

    // 1. Personal Info Section
    if (currentSection.includes('personal info')) {
      const bulletMatch = line.match(/^\*\s+([^:]+):\s*(.*)$/);
      if (bulletMatch) {
        const key = bulletMatch[1].trim().toLowerCase();
        const val = cleanText(bulletMatch[2]);

        if (key === 'name') sections.personalInfo.name = val;
        else if (key.includes('title')) sections.personalInfo.title = val;
        else if (key === 'location') sections.personalInfo.location = val;
        else if (key === 'email') sections.personalInfo.email = val;
        else if (key === 'linkedin') sections.personalInfo.linkedin_url = val;
        else if (key === 'github') sections.personalInfo.github_url = val;
        else if (key === 'bio') sections.personalInfo.bio = val;
      }
    }

    // 2. Experience Section
    else if (currentSection.includes('experience')) {
      // Top-level experience header: * Company — Title — Dates
      const isTopLevel = rawLine.startsWith('* ') || rawLine.startsWith('- ');
      const isBullet = rawLine.match(/^\s+[\*\-]\s+(.+)$/);

      if (isTopLevel) {
        if (currentExperience) {
          sections.experience.push(currentExperience);
        }

        const rawExp = line.replace(/^[\*\-]\s+/, '');
        // Split by em dash '—' or en dash '–' or '--'
        const parts = rawExp.split(/\s+[—–]\s+|\s+--\s+/);

        const company = parts[0] ? cleanText(parts[0]) : '';
        const title = parts[1] ? cleanText(parts[1]) : '';
        const dates = parts[2] ? cleanText(parts[2]) : '';

        // Split dates into start_date and end_date (e.g. "May 2022–Present")
        let startDate = dates;
        let endDate = 'Present';
        if (dates.includes('–') || dates.includes('-') || dates.includes('—')) {
          const dateParts = dates.split(/[—–\-]/);
          startDate = dateParts[0].trim();
          endDate = dateParts[1] ? dateParts[1].trim() : 'Present';
        }

        currentExperience = {
          company,
          title,
          start_date: startDate,
          end_date: endDate,
          bullets: [],
          sort_order: sections.experience.length + 1
        };
      } else if (isBullet && currentExperience) {
        const bulletText = cleanText(isBullet[1]);
        currentExperience.bullets.push(bulletText);
      }
    }

    // 3. Projects Section
    else if (currentSection.includes('projects')) {
      if (line.startsWith('* ') || line.startsWith('- ')) {
        const rawProj = line.replace(/^[\*\-]\s+/, '');
        const parts = rawProj.split(/\s+[—–]\s+|\s+--\s+/);

        const name = parts[0] ? cleanText(parts[0]) : 'Project';
        const description = parts[1] ? cleanText(parts[1]) : '';

        let techTags = [];
        let externalLink = '';

        for (let p = 2; p < parts.length; p++) {
          const part = parts[p].trim();
          if (part.toLowerCase().startsWith('tech:')) {
            const rawTech = part.replace(/^tech:\s*/i, '');
            techTags = rawTech.split(',').map(t => cleanText(t)).filter(Boolean);
          } else if (part.toLowerCase().startsWith('link:')) {
            const rawLink = part.replace(/^link:\s*/i, '');
            // Extract URL if exists inside parentheses or markdown link
            const urlMatch = rawLink.match(/https?:\/\/[^\s\)]+/);
            externalLink = urlMatch ? urlMatch[0] : rawLink;
          }
        }

        sections.projects.push({
          name,
          description,
          tech_tags: techTags,
          thumbnail_url: '/assets/placeholder-avatar.svg',
          video_url: null,
          external_link: externalLink,
          sort_order: sections.projects.length + 1
        });
      }
    }

    // 4. Skills Section
    else if (currentSection.includes('skills')) {
      const skillMatch = line.match(/^[\*\-]\s*([^:]+):\s*(.*)$/);
      if (skillMatch) {
        const rawCat = skillMatch[1].toLowerCase().trim();
        const rawVals = skillMatch[2];

        let category = 'technical';
        if (rawCat.includes('tool') || rawCat.includes('platform')) {
          category = 'tools';
        } else if (rawCat.includes('soft')) {
          category = 'soft';
        }

        const items = rawVals.split(',').map(s => cleanText(s)).filter(Boolean);
        items.forEach((val, idx) => {
          sections.skills.push({
            category,
            value: val,
            sort_order: sections.skills.length + 1
          });
        });
      }
    }

    // 5. FAQ Section
    else if (currentSection.includes('faq')) {
      const qMatch = line.match(/^Q:\s*(.*)$/i);
      const aMatch = line.match(/^A:\s*(.*)$/i);

      if (qMatch) {
        if (currentFaq && currentFaq.question && currentFaq.answer) {
          sections.faq.push(currentFaq);
        }
        currentFaq = {
          question: cleanText(qMatch[1]),
          answer: '',
          sort_order: sections.faq.length + 1
        };
      } else if (aMatch && currentFaq) {
        currentFaq.answer = cleanText(aMatch[1]);
      } else if (currentFaq && currentFaq.answer && !line.startsWith('Q:')) {
        // Multi-line answer
        currentFaq.answer += ' ' + cleanText(line);
      }
    }
  }

  // Push final pending items
  if (currentExperience) {
    sections.experience.push(currentExperience);
  }
  if (currentFaq && currentFaq.question && currentFaq.answer) {
    sections.faq.push(currentFaq);
  }

  // Ensure default resume & photo URLs
  if (sections.personalInfo) {
    if (!sections.personalInfo.resume_url) sections.personalInfo.resume_url = '/resume.pdf';
    if (!sections.personalInfo.photo_url) sections.personalInfo.photo_url = '/assets/placeholder-avatar.svg';
  }

  return sections;
}

export default parseProfile;
