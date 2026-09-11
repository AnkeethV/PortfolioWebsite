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

  // Category & Domain badges
  let badgesHtml = '';
  if (project.project_type || project.domain) {
    badgesHtml = `
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
        ${project.project_type ? `<span class="badge-pill" style="background: rgba(242, 183, 5, 0.15); color: #F2B705; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em;">${escapeHtml(project.project_type)}</span>` : ''}
        ${project.domain ? `<span class="badge-pill" style="background: rgba(255, 255, 255, 0.08); color: var(--color-text-secondary); font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 9999px;">${escapeHtml(project.domain)}</span>` : ''}
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

  // Screenshots Gallery
  let screenshotsHtml = '';
  const hasS1 = Boolean(project.screenshot1_url);
  const hasS2 = Boolean(project.screenshot2_url);

  if (hasS1 || hasS2) {
    screenshotsHtml = `
      <div style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
        <h4 class="modal-section-title">Project Screenshots</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-top: 10px;">
          ${hasS1 ? `
            <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden;">
              <a href="${escapeHtml(project.screenshot1_url)}" target="_blank" rel="noopener noreferrer" title="Click to view full image">
                <img src="${escapeHtml(project.screenshot1_url)}" alt="Screenshot 1" style="width: 100%; height: 160px; object-fit: cover; display: block; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
              </a>
              ${project.screenshot1_desc ? `<p style="padding: 10px 12px; font-size: 12px; color: var(--color-text-secondary); line-height: 1.4; margin: 0;">${escapeHtml(project.screenshot1_desc)}</p>` : ''}
            </div>
          ` : ''}
          ${hasS2 ? `
            <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden;">
              <a href="${escapeHtml(project.screenshot2_url)}" target="_blank" rel="noopener noreferrer" title="Click to view full image">
                <img src="${escapeHtml(project.screenshot2_url)}" alt="Screenshot 2" style="width: 100%; height: 160px; object-fit: cover; display: block; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
              </a>
              ${project.screenshot2_desc ? `<p style="padding: 10px 12px; font-size: 12px; color: var(--color-text-secondary); line-height: 1.4; margin: 0;">${escapeHtml(project.screenshot2_desc)}</p>` : ''}
            </div>
          ` : ''}
        </div>
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
    ${badgesHtml}
    <h2 class="modal-project-title">${escapeHtml(project.name)}</h2>
    
    ${project.short_info ? `<p style="font-size: 15px; line-height: 1.6; color: var(--color-text-primary); font-weight: 500; margin-bottom: 16px; border-left: 3px solid var(--color-accent); padding-left: 14px;">${escapeHtml(project.short_info)}</p>` : ''}
    
    <p class="modal-project-desc" style="white-space: pre-line;">${escapeHtml(project.description)}</p>

    ${screenshotsHtml}

    <div style="margin-bottom: 1.5rem;">
      <h4 class="modal-section-title">Technologies & Tools</h4>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        ${tagsHtml || '<span class="tag-chip">Analytics</span>'}
      </div>
    </div>

    ${videoHtml}

    <div class="modal-actions" style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px;">
      ${actionButtons.join('')}
      <button class="btn-pill btn-secondary" id="modal-cancel-btn">Close</button>
    </div>
  `;

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
