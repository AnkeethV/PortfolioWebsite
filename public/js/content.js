/**
   Master Content Hydration Module
   Fetches live database content via GET /api/content and renders all sections
   ========================================================================== */

import { openProjectModal } from './modal.js';

/**
 * Safe HTML string escaper
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Opens a PDF URL safely in a new tab without being blocked by browser data: URL restrictions
 */
export function openPdfUrl(url) {
  if (!url) {
    url = '/resume.pdf';
  }
  if (url.startsWith('data:application/pdf') || url.startsWith('data:')) {
    try {
      const parts = url.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      const newWin = window.open(blobUrl, '_blank');
      if (!newWin) {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = 'Ankeeth_V_Resume.pdf';
        a.click();
      }
      return;
    } catch (e) {
      console.warn('Could not open PDF via blob URL:', e);
    }
  }
  window.open(url.startsWith('data:') ? '/resume.pdf' : url, '_blank');
}

/**
 * Fetch portfolio data from API
 */
export async function loadContent() {
  let attempts = 0;
  while (attempts < 2) {
    try {
      attempts++;
      const res = await fetch(`/api/content?t=${Date.now()}`);
      if (!res.ok) {
        throw new Error(`Failed to load content: ${res.status}`);
      }
      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error('Invalid content payload received');
      }

      let mergedData = { ...json.data };
      try {
        const rawOverrides = localStorage.getItem('portfolio_live_overrides');
        if (rawOverrides) {
          const overrides = JSON.parse(rawOverrides);
          if (overrides.personal_info) mergedData.personal_info = { ...mergedData.personal_info, ...overrides.personal_info };
          if (Array.isArray(overrides.experience) && overrides.experience.length > 0) mergedData.experience = overrides.experience;
          if (Array.isArray(overrides.projects) && overrides.projects.length > 0) mergedData.projects = overrides.projects;
          if (overrides.skills) mergedData.skills = overrides.skills;
          if (Array.isArray(overrides.faq) && overrides.faq.length > 0) mergedData.faq = overrides.faq;
        }
      } catch (_) {}

      const { personal_info, experience, projects, skills, faq } = mergedData;

      // Hydrate all sections
      renderPersonalInfo(personal_info);
      renderExperience(experience);
      renderProjects(projects);
      renderSkills(skills);
      renderFaq(faq);
      return; // Succeeded!
    } catch (err) {
      console.warn(`Attempt ${attempts} to load content failed:`, err);
      if (attempts < 2) {
        await new Promise(r => setTimeout(r, 500));
      } else {
        console.error('Error hydrating portfolio content:', err);
        const placeholders = document.querySelectorAll('.loading-placeholder');
        placeholders.forEach(el => {
          el.innerHTML = `
            <div style="padding: 18px 0; text-align: center;">
              <p style="color: var(--color-text-secondary); margin-bottom: 10px;">Content is temporarily unavailable. Please refresh or try again.</p>
              <button type="button" class="btn-pill btn-secondary btn-sm" onclick="window.location.reload()">Refresh Page</button>
            </div>
          `;
        });
      }
    }
  }
}

/**
 * 1. Hydrate Personal Info & Hero
 */
function renderPersonalInfo(info) {
  if (!info) return;

  const titleEl = document.getElementById('hero-title');
  const bioEl = document.getElementById('hero-bio');
  const locationEl = document.getElementById('hero-location');
  const photoEl = document.getElementById('hero-photo');
  const resumeBtn = document.getElementById('hero-resume-btn');
  const emailLink = document.getElementById('contact-email-link');
  const emailText = document.getElementById('contact-email-text');
  const linkedinLink = document.getElementById('contact-linkedin-link');
  const githubLink = document.getElementById('contact-github-link');

  if (titleEl && info.title) {
    titleEl.textContent = info.title;
  }
  if (bioEl && info.bio) {
    bioEl.textContent = info.bio;
  }
  if (locationEl && info.location) {
    locationEl.textContent = info.location;
  }
  if (photoEl && info.photo_url) {
    photoEl.src = info.photo_url;
    photoEl.alt = `Photo of ${info.name || 'Ankeeth V'}`;
  }
  if (resumeBtn) {
    const resumeUrl = info.resume_url || '/resume.pdf';
    resumeBtn.onclick = (e) => {
      e.preventDefault();
      openPdfUrl(resumeUrl);
    };
    resumeBtn.href = resumeUrl.startsWith('data:') ? '/resume.pdf' : resumeUrl;
  }

  // Also bind all other resume links (nav, footer)
  document.querySelectorAll('a[href="/resume.pdf"]').forEach(link => {
    link.onclick = (e) => {
      if (info.resume_url && info.resume_url.startsWith('data:')) {
        e.preventDefault();
        openPdfUrl(info.resume_url);
      }
    };
  });

  // Direct Contact links
  if (info.email) {
    if (emailLink) emailLink.href = `mailto:${info.email}`;
    if (emailText) emailText.textContent = info.email;
  }
  if (linkedinLink && info.linkedin_url) {
    linkedinLink.href = info.linkedin_url;
  }
  if (githubLink && info.github_url) {
    githubLink.href = info.github_url;
  }

  // Footer Tagline (Professional Title displayed below name)
  const footerTaglineEl = document.getElementById('footer-tagline') || document.querySelector('.footer-tagline');
  if (footerTaglineEl && info.title) {
    footerTaglineEl.textContent = info.title;
  }

  // Footer & Brand Name sync
  const footerNameEl = document.getElementById('footer-name') || document.querySelector('.footer-name');
  if (footerNameEl && info.name) {
    footerNameEl.textContent = info.name;
  }

  const brandNameEl = document.getElementById('brand-name') || document.querySelector('.brand-wordmark .wordmark-serif');
  if (brandNameEl && info.name) {
    brandNameEl.textContent = info.name;
  }

  const footerCopyEl = document.getElementById('footer-copy-text') || document.querySelector('.footer-copy-col p');
  if (footerCopyEl && info.name) {
    const year = new Date().getFullYear();
    footerCopyEl.textContent = `© ${year} ${info.name}. All rights reserved.`;
  }

  // Synchronize document title
  if (info.name && info.title) {
    document.title = `${info.name} — ${info.title}`;
  }
}

/**
 * 2. Hydrate Career Experience Timeline
 */
function renderExperience(experiences) {
  const container = document.getElementById('experience-list');
  if (!container) return;

  if (!experiences || experiences.length === 0) {
    container.innerHTML = '<p class="text-muted">No experience entries found.</p>';
    return;
  }

  container.innerHTML = experiences.map(exp => {
    const bullets = Array.isArray(exp.bullets) ? exp.bullets : [];
    const bulletsHtml = bullets
      .map(b => `<li class="experience-bullet-item">${escapeHtml(b)}</li>`)
      .join('');

    return `
      <div class="experience-card">
        <div class="experience-header">
          <div class="company-title-group">
            <h3 class="experience-company">${escapeHtml(exp.company)}</h3>
            <span class="experience-role">${escapeHtml(exp.title)}</span>
          </div>
          <span class="experience-date-badge">${escapeHtml(exp.start_date)} – ${escapeHtml(exp.end_date)}</span>
        </div>
        <ul class="experience-bullets">
          ${bulletsHtml}
        </ul>
      </div>
    `;
  }).join('');
}

/**
 * 3. Hydrate Projects Grid & Bind Modal Triggers
 */
function renderProjects(projects) {
  const grid = document.getElementById('projects-grid');
  if (!grid) return;

  if (!projects || projects.length === 0) {
    grid.innerHTML = '<p class="text-muted">No projects found.</p>';
    return;
  }

  grid.innerHTML = projects.map((proj, idx) => {
    const tags = Array.isArray(proj.tech_tags) ? proj.tech_tags : [];
    const tagsHtml = tags.slice(0, 3).map(t => `<span class="tag-chip">${escapeHtml(t)}</span>`).join('');
    const extraCount = tags.length > 3 ? `<span class="tag-chip">+${tags.length - 3}</span>` : '';

    const typeBadge = proj.project_type || proj.domain
      ? `<span style="font-size: 11px; font-weight: 700; color: var(--color-accent); text-transform: uppercase; letter-spacing: 0.05em; display: inline-block; margin-bottom: 6px;">${escapeHtml(proj.project_type || proj.domain)}</span>`
      : '';
    const summaryText = proj.short_info || proj.description;

    return `
      <div class="project-card" data-project-index="${idx}" tabindex="0" role="button" aria-label="View details for ${escapeHtml(proj.name)}">
        <div class="project-thumbnail-wrapper">
          <img class="project-thumbnail-img" src="${proj.thumbnail_url || '/assets/placeholder-avatar.svg'}" alt="${escapeHtml(proj.name)}" loading="lazy">
        </div>
        <div class="project-card-body">
          ${typeBadge}
          <h3 class="project-title">${escapeHtml(proj.name)}</h3>
          <p class="project-desc-short">${escapeHtml(summaryText)}</p>
          <div class="project-tags-list">
            ${tagsHtml} ${extraCount}
          </div>
          <div class="project-footer-action">
            <span class="project-view-link">
              <span>View Details</span>
              <span>→</span>
            </span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Bind click & Enter key event to open modal
  const cards = grid.querySelectorAll('.project-card');
  cards.forEach(card => {
    const index = parseInt(card.getAttribute('data-project-index'), 10);
    const projData = projects[index];

    card.addEventListener('click', () => {
      openProjectModal(projData);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openProjectModal(projData);
      }
    });
  });
}

/**
 * 4. Hydrate Categorized Skills
 */
function renderSkills(skills) {
  const container = document.getElementById('skills-container');
  if (!container) return;

  const categories = [
    { key: 'technical', title: 'Technical', icon: '⚙️' },
    { key: 'tools', title: 'Tools & Platforms', icon: '🛠️' },
    { key: 'soft', title: 'Soft Skills', icon: '💡' }
  ];

  container.innerHTML = categories.map(cat => {
    const items = (skills && skills[cat.key]) ? skills[cat.key] : [];
    const chipsHtml = items
      .map(item => `<span class="skill-chip">${escapeHtml(typeof item === 'string' ? item : item.value)}</span>`)
      .join('');

    return `
      <div class="skill-category-card">
        <div class="skill-category-header">
          <div class="skill-category-icon">${cat.icon}</div>
          <h3 class="skill-category-title">${cat.title}</h3>
        </div>
        <div class="skill-chips-wrap">
          ${chipsHtml || '<span class="text-muted">No skills listed.</span>'}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 5. Hydrate FAQ Accordion
 */
function renderFaq(faqs) {
  const container = document.getElementById('faq-accordion');
  if (!container) return;

  if (!faqs || faqs.length === 0) {
    container.innerHTML = '<p class="text-muted">No FAQ items found.</p>';
    return;
  }

  container.innerHTML = faqs.map((item, idx) => {
    // Open first item by default
    const isOpen = idx === 0;
    return `
      <div class="faq-item ${isOpen ? 'open' : ''}">
        <button class="faq-question-btn" aria-expanded="${isOpen}">
          <span>${escapeHtml(item.question)}</span>
          <span class="faq-toggle-icon">+</span>
        </button>
        <div class="faq-answer-panel">
          <div class="faq-answer-content">
            <p>${escapeHtml(item.answer)}</p>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

export default loadContent;
