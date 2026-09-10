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

  // Format tech tags
  const tagsHtml = (project.tech_tags || [])
    .map(tag => `<span class="tag-chip">${escapeHtml(tag)}</span>`)
    .join('');

  // Format external link CTA
  let linkHtml = '';
  if (project.external_link && project.external_link !== 'N/A') {
    const isLive = project.external_link.toLowerCase().includes('dashboard') || project.external_link.toLowerCase().includes('live');
    const label = isLive ? 'View Live Dashboard' : 'View on GitHub';
    const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;

    linkHtml = `
      <a href="${escapeHtml(project.external_link)}" target="_blank" rel="noopener noreferrer" class="btn-pill btn-primary">
        <span>${label}</span>
        ${iconSvg}
      </a>
    `;
  }

  // Format video embed if provided
  let videoHtml = '';
  if (project.video_url) {
    videoHtml = `
      <div style="margin-top: 1.5rem; border-radius: 12px; overflow: hidden; background: #000;">
        <video controls style="width: 100%; max-height: 320px; display: block;">
          <source src="${escapeHtml(project.video_url)}" type="video/mp4">
          Your browser does not support HTML video.
        </video>
      </div>
    `;
  }

  modalContent.innerHTML = `
    <h2 class="modal-project-title">${escapeHtml(project.name)}</h2>
    <p class="modal-project-desc">${escapeHtml(project.description)}</p>

    <div style="margin-bottom: 1.5rem;">
      <h4 class="modal-section-title">Technologies & Stack</h4>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        ${tagsHtml || '<span class="tag-chip">Data & Analytics</span>'}
      </div>
    </div>

    ${videoHtml}

    <div class="modal-actions">
      ${linkHtml}
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
