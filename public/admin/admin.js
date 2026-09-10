/**
 * Admin Console Controller: admin.js
 * Authentication, Tab Routing, Data Hydration & CRUD Handlers
 * ========================================================================== */

// State
let allExperiences = [];
let allProjects = [];
let allSkills = [];
let allFaqs = [];

/**
 * Toast Notification Utility
 */
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

/**
 * Modal Open / Close Helpers
 */
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('open');
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('open');
  }
}

/**
 * 1. Authentication Check & Session Management
 */
async function checkAuth() {
  try {
    const res = await fetch('/api/admin/me');
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated) {
        showDashboard();
        return;
      }
    }
  } catch (_) {}
  showLogin();
}

function showLogin() {
  document.getElementById('login-view').style.display = 'flex';
  document.getElementById('dashboard-view').style.display = 'none';
}

function showDashboard() {
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('dashboard-view').style.display = 'flex';
  loadDashboardData();
}

async function handleLogin(e) {
  e.preventDefault();
  const passwordInput = document.getElementById('admin-password');
  const errorBanner = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-btn');

  const password = passwordInput.value;
  errorBanner.style.display = 'none';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Verifying...';

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      passwordInput.value = '';
      showDashboard();
      showToast('Welcome to Admin Console!');
    } else {
      errorBanner.textContent = data.error || 'Invalid password. Access denied.';
      errorBanner.style.display = 'block';
    }
  } catch (err) {
    errorBanner.textContent = 'Connection error. Please try again.';
    errorBanner.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In';
  }
}

async function handleLogout() {
  try {
    await fetch('/api/admin/logout', { method: 'POST' });
  } catch (_) {}
  showLogin();
  showToast('Logged out successfully.');
}

/**
 * 2. Load and Hydrate All Admin Data
 */
async function loadDashboardData() {
  try {
    // 1. Personal Info
    const pRes = await fetch('/api/content');
    const pData = await pRes.json();
    if (pData.success && pData.data.personal_info) {
      hydratePersonalInfo(pData.data.personal_info);
    }

    // 2. Load Experience, Projects, Skills, FAQ from admin endpoints
    await Promise.all([
      loadExperience(),
      loadProjects(),
      loadSkills(),
      loadFaq()
    ]);
  } catch (err) {
    console.error('Error loading dashboard data:', err);
    showToast('Failed to load some dashboard sections.', 'error');
  }
}

/**
 * 3. Personal Info Form Handlers
 */
function hydratePersonalInfo(info) {
  document.getElementById('p-name').value = info.name || '';
  document.getElementById('p-title').value = info.title || '';
  document.getElementById('p-location').value = info.location || '';
  document.getElementById('p-email').value = info.email || '';
  document.getElementById('p-linkedin').value = info.linkedin_url || '';
  document.getElementById('p-github').value = info.github_url || '';
  document.getElementById('p-resume').value = info.resume_url || '';
  document.getElementById('p-photo').value = info.photo_url || '';
  document.getElementById('p-bio').value = info.bio || '';
}

async function handleSavePersonalInfo(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('p-name').value,
    title: document.getElementById('p-title').value,
    location: document.getElementById('p-location').value,
    email: document.getElementById('p-email').value,
    linkedin_url: document.getElementById('p-linkedin').value,
    github_url: document.getElementById('p-github').value,
    resume_url: document.getElementById('p-resume').value,
    photo_url: document.getElementById('p-photo').value,
    bio: document.getElementById('p-bio').value
  };

  try {
    const res = await fetch('/api/admin/personal-info', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Personal info updated successfully!');
    } else {
      showToast(data.error || 'Failed to update personal info', 'error');
    }
  } catch (err) {
    showToast('Error updating personal info', 'error');
  }
}

/**
 * 4. Experience CRUD
 */
async function loadExperience() {
  const res = await fetch('/api/admin/experience');
  const data = await res.json();
  if (data.success) {
    allExperiences = data.data || [];
    renderExperienceList();
  }
}

function renderExperienceList() {
  const container = document.getElementById('experience-admin-list');
  if (!container) return;

  if (allExperiences.length === 0) {
    container.innerHTML = '<p class="text-muted" style="padding: 16px;">No experiences listed yet.</p>';
    return;
  }

  container.innerHTML = allExperiences.map((exp, idx) => `
    <div class="item-row" data-id="${exp.id}">
      <div class="item-info">
        <h4 class="item-main-title">${escapeHtml(exp.company)} — <span style="font-weight: 400; color: var(--color-text-secondary);">${escapeHtml(exp.title)}</span></h4>
        <div class="item-meta">${escapeHtml(exp.start_date)} – ${escapeHtml(exp.end_date)} • ${Array.isArray(exp.bullets) ? exp.bullets.length : 0} achievement bullets</div>
      </div>
      <div class="item-actions">
        <button type="button" class="btn-icon" title="Move Up" onclick="window.adminApp.reorderExperience(${idx}, -1)" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''}>↑</button>
        <button type="button" class="btn-icon" title="Move Down" onclick="window.adminApp.reorderExperience(${idx}, 1)" ${idx === allExperiences.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>↓</button>
        <button type="button" class="btn-icon" title="Edit" onclick="window.adminApp.openEditExperience(${exp.id})">✎</button>
        <button type="button" class="btn-icon btn-icon-danger" title="Delete" onclick="window.adminApp.deleteExperience(${exp.id})">✕</button>
      </div>
    </div>
  `).join('');
}

function openAddExperience() {
  document.getElementById('modal-experience-title').textContent = 'Add Experience';
  document.getElementById('form-experience').reset();
  document.getElementById('exp-id').value = '';
  document.getElementById('exp-bullets-container').innerHTML = '';
  addBulletInput('');
  openModal('modal-experience');
}

function openEditExperience(id) {
  const exp = allExperiences.find(item => item.id === id);
  if (!exp) return;

  document.getElementById('modal-experience-title').textContent = 'Edit Experience';
  document.getElementById('exp-id').value = exp.id;
  document.getElementById('exp-company').value = exp.company || '';
  document.getElementById('exp-title').value = exp.title || '';
  document.getElementById('exp-start').value = exp.start_date || '';
  document.getElementById('exp-end').value = exp.end_date || '';

  const bulletsContainer = document.getElementById('exp-bullets-container');
  bulletsContainer.innerHTML = '';
  const bullets = Array.isArray(exp.bullets) ? exp.bullets : [];
  if (bullets.length === 0) {
    addBulletInput('');
  } else {
    bullets.forEach(b => addBulletInput(b));
  }

  openModal('modal-experience');
}

function addBulletInput(value = '') {
  const container = document.getElementById('exp-bullets-container');
  const row = document.createElement('div');
  row.className = 'bullet-input-row';
  row.innerHTML = `
    <input type="text" class="form-input exp-bullet-field" value="${escapeHtml(value)}" placeholder="Key result or operational achievement" required>
    <button type="button" class="btn-icon btn-icon-danger btn-del-bullet" title="Remove bullet">✕</button>
  `;
  row.querySelector('.btn-del-bullet').addEventListener('click', () => {
    row.remove();
  });
  container.appendChild(row);
}

async function handleSaveExperience(e) {
  e.preventDefault();
  const id = document.getElementById('exp-id').value;
  const company = document.getElementById('exp-company').value;
  const title = document.getElementById('exp-title').value;
  const start_date = document.getElementById('exp-start').value;
  const end_date = document.getElementById('exp-end').value;

  const bulletInputs = document.querySelectorAll('.exp-bullet-field');
  const bullets = Array.from(bulletInputs).map(b => b.value.trim()).filter(Boolean);

  const payload = { company, title, start_date, end_date, bullets };
  if (id) payload.id = parseInt(id, 10);

  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch('/api/admin/experience', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      closeModal('modal-experience');
      showToast(id ? 'Experience updated!' : 'Experience added!');
      await loadExperience();
    } else {
      showToast(data.error || 'Failed to save experience', 'error');
    }
  } catch (err) {
    showToast('Error saving experience', 'error');
  }
}

async function deleteExperience(id) {
  if (!confirm('Are you sure you want to delete this experience entry?')) return;

  try {
    const res = await fetch(`/api/admin/experience?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Experience deleted.');
      await loadExperience();
    } else {
      showToast(data.error || 'Failed to delete experience', 'error');
    }
  } catch (err) {
    showToast('Error deleting experience', 'error');
  }
}

async function reorderExperience(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= allExperiences.length) return;

  const temp = allExperiences[index];
  allExperiences[index] = allExperiences[newIndex];
  allExperiences[newIndex] = temp;

  const reorderPayload = allExperiences.map((exp, idx) => ({
    id: exp.id,
    sort_order: idx + 1
  }));

  try {
    await fetch('/api/admin/experience', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: reorderPayload })
    });
    renderExperienceList();
    showToast('Order updated');
  } catch (_) {
    showToast('Failed to update order', 'error');
  }
}

/**
 * 5. Projects CRUD
 */
async function loadProjects() {
  const res = await fetch('/api/admin/projects');
  const data = await res.json();
  if (data.success) {
    allProjects = data.data || [];
    renderProjectsList();
  }
}

function renderProjectsList() {
  const container = document.getElementById('projects-admin-list');
  if (!container) return;

  if (allProjects.length === 0) {
    container.innerHTML = '<p class="text-muted" style="padding: 16px;">No projects listed yet.</p>';
    return;
  }

  container.innerHTML = allProjects.map((proj, idx) => `
    <div class="item-row" data-id="${proj.id}">
      <div class="item-info">
        <h4 class="item-main-title">${escapeHtml(proj.name)}</h4>
        <div class="item-meta">${escapeHtml(proj.description).slice(0, 80)}... • Tags: ${(proj.tech_tags || []).join(', ')}</div>
      </div>
      <div class="item-actions">
        <button type="button" class="btn-icon" title="Move Up" onclick="window.adminApp.reorderProjects(${idx}, -1)" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''}>↑</button>
        <button type="button" class="btn-icon" title="Move Down" onclick="window.adminApp.reorderProjects(${idx}, 1)" ${idx === allProjects.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>↓</button>
        <button type="button" class="btn-icon" title="Edit" onclick="window.adminApp.openEditProject(${proj.id})">✎</button>
        <button type="button" class="btn-icon btn-icon-danger" title="Delete" onclick="window.adminApp.deleteProject(${proj.id})">✕</button>
      </div>
    </div>
  `).join('');
}

function openAddProject() {
  document.getElementById('modal-project-title').textContent = 'Add Project';
  document.getElementById('form-project').reset();
  document.getElementById('proj-id').value = '';
  openModal('modal-project');
}

function openEditProject(id) {
  const proj = allProjects.find(item => item.id === id);
  if (!proj) return;

  document.getElementById('modal-project-title').textContent = 'Edit Project';
  document.getElementById('proj-id').value = proj.id;
  document.getElementById('proj-name').value = proj.name || '';
  document.getElementById('proj-desc').value = proj.description || '';
  document.getElementById('proj-tags').value = (proj.tech_tags || []).join(', ');
  document.getElementById('proj-thumb').value = proj.thumbnail_url || '';
  document.getElementById('proj-link').value = proj.external_link || '';
  document.getElementById('proj-video').value = proj.video_url || '';

  openModal('modal-project');
}

async function handleSaveProject(e) {
  e.preventDefault();
  const id = document.getElementById('proj-id').value;
  const name = document.getElementById('proj-name').value;
  const description = document.getElementById('proj-desc').value;
  const tagsStr = document.getElementById('proj-tags').value;
  const tech_tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
  const thumbnail_url = document.getElementById('proj-thumb').value;
  const external_link = document.getElementById('proj-link').value;
  const video_url = document.getElementById('proj-video').value;

  const payload = { name, description, tech_tags, thumbnail_url, external_link, video_url };
  if (id) payload.id = parseInt(id, 10);

  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch('/api/admin/projects', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      closeModal('modal-project');
      showToast(id ? 'Project updated!' : 'Project added!');
      await loadProjects();
    } else {
      showToast(data.error || 'Failed to save project', 'error');
    }
  } catch (err) {
    showToast('Error saving project', 'error');
  }
}

async function deleteProject(id) {
  if (!confirm('Are you sure you want to delete this project?')) return;

  try {
    const res = await fetch(`/api/admin/projects?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Project deleted.');
      await loadProjects();
    } else {
      showToast(data.error || 'Failed to delete project', 'error');
    }
  } catch (err) {
    showToast('Error deleting project', 'error');
  }
}

async function reorderProjects(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= allProjects.length) return;

  const temp = allProjects[index];
  allProjects[index] = allProjects[newIndex];
  allProjects[newIndex] = temp;

  const reorderPayload = allProjects.map((proj, idx) => ({
    id: proj.id,
    sort_order: idx + 1
  }));

  try {
    await fetch('/api/admin/projects', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: reorderPayload })
    });
    renderProjectsList();
    showToast('Order updated');
  } catch (_) {
    showToast('Failed to update order', 'error');
  }
}

/**
 * 6. Skills CRUD
 */
async function loadSkills() {
  const res = await fetch('/api/admin/skills');
  const data = await res.json();
  if (data.success) {
    allSkills = data.data || [];
    renderSkillsList();
  }
}

function renderSkillsList() {
  const categories = ['technical', 'tools', 'soft'];
  categories.forEach(cat => {
    const listEl = document.getElementById(`skills-list-${cat}`);
    if (!listEl) return;

    const catSkills = allSkills.filter(s => (s.category || '').toLowerCase() === cat);
    if (catSkills.length === 0) {
      listEl.innerHTML = '<span class="text-muted" style="font-size: 12px;">No skills added yet.</span>';
      return;
    }

    listEl.innerHTML = catSkills.map(s => `
      <span class="skill-tag-chip">
        <span>${escapeHtml(s.value)}</span>
        <span class="skill-tag-del" title="Remove" onclick="window.adminApp.deleteSkill(${s.id})">×</span>
      </span>
    `).join('');
  });
}

async function handleAddSkill(cat, valueInput) {
  const value = valueInput.value.trim();
  if (!value) return;

  try {
    const res = await fetch('/api/admin/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: cat, value })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      valueInput.value = '';
      showToast(`Skill added to ${cat}`);
      await loadSkills();
    } else {
      showToast(data.error || 'Failed to add skill', 'error');
    }
  } catch (err) {
    showToast('Error adding skill', 'error');
  }
}

async function deleteSkill(id) {
  try {
    const res = await fetch(`/api/admin/skills?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Skill removed.');
      await loadSkills();
    } else {
      showToast(data.error || 'Failed to delete skill', 'error');
    }
  } catch (err) {
    showToast('Error deleting skill', 'error');
  }
}

/**
 * 7. FAQ CRUD
 */
async function loadFaq() {
  const res = await fetch('/api/admin/faq');
  const data = await res.json();
  if (data.success) {
    allFaqs = data.data || [];
    renderFaqList();
  }
}

function renderFaqList() {
  const container = document.getElementById('faq-admin-list');
  if (!container) return;

  if (allFaqs.length === 0) {
    container.innerHTML = '<p class="text-muted" style="padding: 16px;">No FAQ questions added yet.</p>';
    return;
  }

  container.innerHTML = allFaqs.map((item, idx) => `
    <div class="item-row" data-id="${item.id}">
      <div class="item-info">
        <h4 class="item-main-title">${escapeHtml(item.question)}</h4>
        <div class="item-meta">${escapeHtml(item.answer).slice(0, 80)}...</div>
      </div>
      <div class="item-actions">
        <button type="button" class="btn-icon" title="Move Up" onclick="window.adminApp.reorderFaq(${idx}, -1)" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''}>↑</button>
        <button type="button" class="btn-icon" title="Move Down" onclick="window.adminApp.reorderFaq(${idx}, 1)" ${idx === allFaqs.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>↓</button>
        <button type="button" class="btn-icon" title="Edit" onclick="window.adminApp.openEditFaq(${item.id})">✎</button>
        <button type="button" class="btn-icon btn-icon-danger" title="Delete" onclick="window.adminApp.deleteFaq(${item.id})">✕</button>
      </div>
    </div>
  `).join('');
}

function openAddFaq() {
  document.getElementById('modal-faq-title').textContent = 'Add FAQ Question';
  document.getElementById('form-faq').reset();
  document.getElementById('faq-id').value = '';
  openModal('modal-faq');
}

function openEditFaq(id) {
  const faq = allFaqs.find(item => item.id === id);
  if (!faq) return;

  document.getElementById('modal-faq-title').textContent = 'Edit FAQ Question';
  document.getElementById('faq-id').value = faq.id;
  document.getElementById('faq-question').value = faq.question || '';
  document.getElementById('faq-answer').value = faq.answer || '';
  openModal('modal-faq');
}

async function handleSaveFaq(e) {
  e.preventDefault();
  const id = document.getElementById('faq-id').value;
  const question = document.getElementById('faq-question').value;
  const answer = document.getElementById('faq-answer').value;

  const payload = { question, answer };
  if (id) payload.id = parseInt(id, 10);

  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch('/api/admin/faq', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      closeModal('modal-faq');
      showToast(id ? 'FAQ updated!' : 'FAQ added!');
      await loadFaq();
    } else {
      showToast(data.error || 'Failed to save FAQ', 'error');
    }
  } catch (err) {
    showToast('Error saving FAQ', 'error');
  }
}

async function deleteFaq(id) {
  if (!confirm('Are you sure you want to delete this FAQ?')) return;

  try {
    const res = await fetch(`/api/admin/faq?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('FAQ deleted.');
      await loadFaq();
    } else {
      showToast(data.error || 'Failed to delete FAQ', 'error');
    }
  } catch (err) {
    showToast('Error deleting FAQ', 'error');
  }
}

async function reorderFaq(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= allFaqs.length) return;

  const temp = allFaqs[index];
  allFaqs[index] = allFaqs[newIndex];
  allFaqs[newIndex] = temp;

  const reorderPayload = allFaqs.map((faq, idx) => ({
    id: faq.id,
    sort_order: idx + 1
  }));

  try {
    await fetch('/api/admin/faq', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: reorderPayload })
    });
    renderFaqList();
    showToast('Order updated');
  } catch (_) {
    showToast('Failed to update order', 'error');
  }
}

/**
 * Safe HTML Escaper
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
 * Expose window.adminApp for inline onclick helpers
 */
window.adminApp = {
  openEditExperience,
  deleteExperience,
  reorderExperience,
  openEditProject,
  deleteProject,
  reorderProjects,
  deleteSkill,
  openEditFaq,
  deleteFaq,
  reorderFaq
};

/**
 * Application Bootstrap
 */
document.addEventListener('DOMContentLoaded', () => {
  // Check auth session
  checkAuth();

  // Login & Logout
  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  // Tab Switching
  const tabBtns = document.querySelectorAll('.admin-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetTab = btn.getAttribute('data-tab');
      const panels = document.querySelectorAll('.tab-panel');
      panels.forEach(p => p.classList.remove('active'));

      const targetPanel = document.getElementById(`panel-${targetTab}`);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });

  // Personal Info Form
  const pForm = document.getElementById('personal-info-form');
  if (pForm) pForm.addEventListener('submit', handleSavePersonalInfo);

  // Experience Buttons & Form
  const btnAddExp = document.getElementById('btn-add-experience');
  if (btnAddExp) btnAddExp.addEventListener('click', openAddExperience);

  const btnExpAddBullet = document.getElementById('btn-exp-add-bullet');
  if (btnExpAddBullet) btnExpAddBullet.addEventListener('click', () => addBulletInput(''));

  const formExp = document.getElementById('form-experience');
  if (formExp) formExp.addEventListener('submit', handleSaveExperience);

  // Project Buttons & Form
  const btnAddProj = document.getElementById('btn-add-project');
  if (btnAddProj) btnAddProj.addEventListener('click', openAddProject);

  const formProj = document.getElementById('form-project');
  if (formProj) formProj.addEventListener('submit', handleSaveProject);

  // Skills Add Forms
  ['technical', 'tools', 'soft'].forEach(cat => {
    const f = document.getElementById(`form-add-skill-${cat}`);
    if (f) {
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = f.querySelector('input');
        handleAddSkill(cat, input);
      });
    }
  });

  // FAQ Buttons & Form
  const btnAddFaq = document.getElementById('btn-add-faq');
  if (btnAddFaq) btnAddFaq.addEventListener('click', openAddFaq);

  const formFaq = document.getElementById('form-faq');
  if (formFaq) formFaq.addEventListener('submit', handleSaveFaq);

  // Close modals
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-modal-backdrop').forEach(m => m.classList.remove('open'));
    });
  });

  document.querySelectorAll('.admin-modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove('open');
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.admin-modal-backdrop').forEach(m => m.classList.remove('open'));
    }
  });
});
