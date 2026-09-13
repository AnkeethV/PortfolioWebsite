/**
   Interactive Project Detail Modal Controller
   Focus trapping, Escape close, outside-click close, body scroll lock
   ========================================================================== */

let activeModal = null;
let lastFocusedElement = null;

export function openProjectModal(project) {
  const modal = document.getElementById('project-modal');
  const modalContent = document.getElementById('modal-content-root');

  if (!modal || !modalContent) return;

  lastFocusedElement = document.activeElement;
  activeModal = modal;

  // Category & Project type badge
  let badgesHtml = '';
  if (project.project_type) {
    badgesHtml = `
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">
        <span class="badge-pill" style="background: rgba(242, 183, 5, 0.15); color: #F2B705; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em;">${escapeHtml(project.project_type)}</span>
      </div>
    `;
  }

  // Domain/Function line
  let domainHtml = '';
  if (project.domain) {
    domainHtml = `
      <div style="font-size: 13.5px; margin-bottom: 14px; color: var(--color-text-secondary);">
        <strong style="color: var(--color-text-muted);">Domain/Function:</strong>
        <span style="color: #10b981; font-weight: 600; margin-left: 4px;">${escapeHtml(project.domain)}</span>
      </div>
    `;
  }

  // Format tech tags
  const tagsList = [...(Array.isArray(project.tech_tags) ? project.tech_tags : [])];
  if (project.other_tools) {
    const tools = project.other_tools.split(',').map(t => t.trim()).filter(Boolean);
    tools.forEach(t => {
      if (!tagsList.includes(t)) tagsList.push(t);
    });
  }

  const tagsHtml = tagsList
    .map(tag => `<span class="tag-chip">${escapeHtml(tag)}</span>`)
    .join('');

  // Collect Screenshots
  const screenshots = [];
  if (project.screenshot1_url) {
    screenshots.push({ url: project.screenshot1_url, desc: project.screenshot1_desc || '' });
  }
  if (project.screenshot2_url) {
    screenshots.push({ url: project.screenshot2_url, desc: project.screenshot2_desc || '' });
  }

  let screenshotColumnHtml = '';
  if (screenshots.length > 0) {
    screenshotColumnHtml = `
      <div class="modal-carousel-wrapper">
        <div class="modal-carousel-container">
          ${screenshots.length > 1 ? `
            <button type="button" class="modal-carousel-arrow prev" id="modal-carousel-prev" aria-label="Previous screenshot">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
          ` : ''}

          <div class="modal-carousel-slide">
            <a id="modal-screenshot-link" href="${escapeHtml(screenshots[0].url)}" target="_blank" rel="noopener noreferrer" title="Click to view full image">
              <img id="modal-screenshot-img" src="${escapeHtml(screenshots[0].url)}" alt="${escapeHtml(project.name)} Screenshot" class="modal-carousel-img">
            </a>
          </div>

          ${screenshots.length > 1 ? `
            <button type="button" class="modal-carousel-arrow next" id="modal-carousel-next" aria-label="Next screenshot">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          ` : ''}
        </div>
        <p id="modal-screenshot-caption" class="modal-screenshot-caption" style="${screenshots[0].desc ? '' : 'display: none;'}">
          ${escapeHtml(screenshots[0].desc)}
        </p>
      </div>
    `;
  }

  // Format video embed if provided
  let videoHtml = '';
  if (project.video_url && /\.(mp4|webm|ogg|mov|mkv)$/i.test(project.video_url)) {
    videoHtml = `
      <div style="margin-top: 1.5rem; border-radius: 12px; overflow: hidden; background: #000;">
        <video controls playsinline preload="metadata" style="width: 100%; max-height: 360px; display: block;" src="${escapeHtml(project.video_url)}">
          <source src="${escapeHtml(project.video_url)}">
          Your browser does not support HTML video playback.
        </video>
      </div>
    `;
  } else if (project.video_url && (project.video_url.includes('youtube.com') || project.video_url.includes('youtu.be') || project.video_url.includes('vimeo.com') || project.video_url.includes('loom.com'))) {
    videoHtml = `
      <div style="margin-top: 1.25rem;">
        <a href="${escapeHtml(project.video_url)}" target="_blank" rel="noopener noreferrer" class="btn-pill btn-secondary" style="display: inline-flex; gap: 8px; align-items: center;">
          <span>▶ Watch Video Demo</span>
        </a>
      </div>
    `;
  }

  // Build Action Links
  const actionButtons = [];
  const iconExt = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;

  if (project.powerbi_url && project.powerbi_url.toLowerCase() !== 'not applicable' && project.powerbi_url.startsWith('http')) {
    actionButtons.push(`
      <a href="${escapeHtml(project.powerbi_url)}" target="_blank" rel="noopener noreferrer" class="btn-pill btn-primary">
        <span>Live PowerBI Dashboard</span>
        ${iconExt}
      </a>
    `);
  }

  if (project.github_url && project.github_url.startsWith('http')) {
    actionButtons.push(`
      <a href="${escapeHtml(project.github_url)}" target="_blank" rel="noopener noreferrer" class="btn-pill btn-secondary">
        <span>GitHub Repo</span>
        ${iconExt}
      </a>
    `);
  } else if (project.external_link && project.external_link.includes('github.com')) {
    actionButtons.push(`
      <a href="${escapeHtml(project.external_link)}" target="_blank" rel="noopener noreferrer" class="btn-pill btn-secondary">
        <span>GitHub Repo</span>
        ${iconExt}
      </a>
    `);
  }

  if (project.linkedin_url && project.linkedin_url.startsWith('http')) {
    actionButtons.push(`
      <a href="${escapeHtml(project.linkedin_url)}" target="_blank" rel="noopener noreferrer" class="btn-pill btn-secondary">
        <span>LinkedIn Post</span>
        ${iconExt}
      </a>
    `);
  }

  if (project.external_link && !project.external_link.includes('github.com') && project.external_link.startsWith('http')) {
    const label = project.platform_name ? `${project.platform_name} Demo` : 'Project Link';
    actionButtons.push(`
      <a href="${escapeHtml(project.external_link)}" target="_blank" rel="noopener noreferrer" class="btn-pill btn-primary">
        <span>${escapeHtml(label)}</span>
        ${iconExt}
      </a>
    `);
  }

  modalContent.innerHTML = `
    <div class="modal-hero-grid ${screenshots.length === 0 ? 'single-col' : ''}">
      <div class="modal-hero-info">
        ${badgesHtml}
        <h2 class="modal-project-title">${escapeHtml(project.name)}</h2>
        ${domainHtml}
        
        ${project.short_info ? `<p style="font-size: 14.5px; line-height: 1.6; color: var(--color-text-secondary); margin-bottom: 20px;">${escapeHtml(project.short_info)}</p>` : ''}
        
        ${actionButtons.length > 0 ? `<div class="modal-actions" style="margin-top: 16px;">${actionButtons.join('')}</div>` : ''}
      </div>

      ${screenshotColumnHtml}
    </div>

    <div class="modal-details-section" style="margin-top: 32px; border-top: 1px solid var(--color-border); padding-top: 24px;">
      <h3 style="font-size: 1.35rem; font-weight: 700; color: var(--color-text-primary); margin-bottom: 12px; letter-spacing: -0.01em;">Project Details</h3>
      
      <p class="modal-project-desc" style="white-space: pre-line; margin-bottom: 24px;">${escapeHtml(project.description)}</p>

      <div style="margin-bottom: 1.5rem;">
        <h4 class="modal-section-title">Technologies & Tools</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${tagsHtml || '<span class="tag-chip">Analytics</span>'}
        </div>
      </div>

      ${videoHtml}

      <div style="display: flex; justify-content: flex-end; margin-top: 24px;">
        <button class="btn-pill btn-secondary" id="modal-cancel-btn">Close</button>
      </div>
    </div>
  `;

  // Bind carousel navigation
  let currentSlide = 0;
  if (screenshots.length > 1) {
    const prevBtn = document.getElementById('modal-carousel-prev');
    const nextBtn = document.getElementById('modal-carousel-next');
    const imgEl = document.getElementById('modal-screenshot-img');
    const linkEl = document.getElementById('modal-screenshot-link');
    const capEl = document.getElementById('modal-screenshot-caption');

    const updateSlide = (idx) => {
      currentSlide = (idx + screenshots.length) % screenshots.length;
      const s = screenshots[currentSlide];
      if (imgEl) imgEl.src = s.url;
      if (linkEl) linkEl.href = s.url;
      if (capEl) {
        capEl.textContent = s.desc;
        capEl.style.display = s.desc ? 'block' : 'none';
      }
    };

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        updateSlide(currentSlide - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        updateSlide(currentSlide + 1);
      });
    }
  }

  // Bind inner cancel button
  const cancelBtn = document.getElementById('modal-cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeProjectModal);
  }

  modal.style.display = 'flex';
  // Trigger animation next tick
  requestAnimationFrame(() => {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    const closeBtn = document.getElementById('modal-close-btn');
    if (closeBtn) closeBtn.focus();
  });
}

export function closeProjectModal() {
  const modal = document.getElementById('project-modal');
  if (!modal) return;

  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';

  setTimeout(() => {
    modal.style.display = 'none';
    if (lastFocusedElement) {
      lastFocusedElement.focus();
    }
    activeModal = null;
  }, 250);
}

export function initModal() {
  const modal = document.getElementById('project-modal');
  const closeBtn = document.getElementById('modal-close-btn');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeProjectModal);
  }

  // Close on backdrop click (click outside modal-card)
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeProjectModal();
      }
    });
  }

  // Close on Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeModal) {
      closeProjectModal();
    }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default {
  openProjectModal,
  closeProjectModal,
  initModal
};
