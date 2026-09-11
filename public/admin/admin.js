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
 * Syncs administrative updates into client localStorage so live site reflects changes immediately
 */
export function syncLocalOverrides(partial = {}) {
  try {
    const existing = JSON.parse(localStorage.getItem('portfolio_live_overrides') || '{}');
    const updated = {
      ...existing,
      ...partial
    };
    localStorage.setItem('portfolio_live_overrides', JSON.stringify(updated));
  } catch (_) {}
}

export function getGroupedSkills(skillsList = allSkills) {
  const grouped = { technical: [], tools: [], soft: [] };
  (skillsList || []).forEach(s => {
    const cat = (s.category || 'technical').toLowerCase();
    if (grouped[cat]) grouped[cat].push({ id: s.id, value: s.value, sort_order: s.sort_order });
    else grouped.technical.push({ id: s.id, value: s.value, sort_order: s.sort_order });
  });
  return grouped;
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
    const pRes = await fetch(`/api/admin/personal-info?t=${Date.now()}`);
    const pData = await pRes.json();
    if (pData.success && pData.data) {
      syncLocalOverrides({ personal_info: pData.data });
      hydratePersonalInfo(pData.data);
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
 * 2.5 Media Upload Helpers & Manual Image Cropper
 */
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file from disk.'));
    reader.readAsDataURL(file);
  });
}

async function uploadMediaFile(file, category, customDataUrl = null) {
  const base64Data = customDataUrl || await readFileAsDataUrl(file);
  const res = await fetch('/api/admin/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      fileType: file.type || 'image/jpeg',
      base64Data,
      category
    })
  });
  const data = await res.json();
  if (res.ok && data.success) {
    return data;
  }
  throw new Error(data.error || 'Upload failed');
}

// Cropper State
const cropperState = {
  active: false,
  img: null,
  filename: '',
  category: 'photo',
  ratio: '1:1',
  zoom: 1.0,
  rotation: 0,
  panX: 0,
  panY: 0,
  boxW: 240,
  boxH: 240,
  stageW: 500,
  stageH: 340,
  onCropped: null
};

function initCropper() {
  const stageWrapper = document.querySelector('.cropper-stage-wrapper');
  const zoomSlider = document.getElementById('cropper-zoom-slider');
  const zoomInBtn = document.getElementById('btn-crop-zoom-in');
  const zoomOutBtn = document.getElementById('btn-crop-zoom-out');
  const rotateBtn = document.getElementById('btn-crop-rotate');
  const resetBtn = document.getElementById('btn-crop-reset');
  const applyBtn = document.getElementById('btn-crop-apply');
  const cancelBtn = document.getElementById('btn-crop-cancel');
  const closeBtn = document.getElementById('btn-cropper-close');
  const ratioChips = document.querySelectorAll('.btn-ratio-chip');

  if (!stageWrapper) return;

  // Pointer dragging
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startPanX = 0;
  let startPanY = 0;

  stageWrapper.addEventListener('pointerdown', (e) => {
    if (!cropperState.active || !cropperState.img) return;
    isDragging = true;
    stageWrapper.classList.add('dragging');
    startX = e.clientX;
    startY = e.clientY;
    startPanX = cropperState.panX;
    startPanY = cropperState.panY;
    stageWrapper.setPointerCapture(e.pointerId);
  });

  stageWrapper.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    cropperState.panX = startPanX + (e.clientX - startX);
    cropperState.panY = startPanY + (e.clientY - startY);
    drawCropper();
  });

  const stopDrag = (e) => {
    if (isDragging) {
      isDragging = false;
      stageWrapper.classList.remove('dragging');
      try { stageWrapper.releasePointerCapture(e.pointerId); } catch (_) {}
    }
  };

  stageWrapper.addEventListener('pointerup', stopDrag);
  stageWrapper.addEventListener('pointercancel', stopDrag);

  // Wheel zoom
  stageWrapper.addEventListener('wheel', (e) => {
    if (!cropperState.active || !cropperState.img) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setCropperZoom(cropperState.zoom + delta);
  }, { passive: false });

  // Zoom slider
  if (zoomSlider) {
    zoomSlider.addEventListener('input', (e) => {
      setCropperZoom(parseFloat(e.target.value));
    });
  }

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      setCropperZoom(cropperState.zoom + 0.15);
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      setCropperZoom(cropperState.zoom - 0.15);
    });
  }

  // Rotate
  if (rotateBtn) {
    rotateBtn.addEventListener('click', () => {
      cropperState.rotation = (cropperState.rotation + 90) % 360;
      drawCropper();
    });
  }

  // Reset
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetCropperView();
      drawCropper();
    });
  }

  // Aspect ratio chips
  ratioChips.forEach(chip => {
    chip.addEventListener('click', () => {
      ratioChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      setCropperRatio(chip.getAttribute('data-ratio'));
    });
  });

  // Close & Cancel
  const closeCropper = () => {
    closeModal('modal-image-cropper');
    cropperState.active = false;
    cropperState.img = null;
  };

  if (cancelBtn) cancelBtn.addEventListener('click', closeCropper);
  if (closeBtn) closeBtn.addEventListener('click', closeCropper);

  // Apply Crop
  if (applyBtn) {
    applyBtn.addEventListener('click', async () => {
      if (!cropperState.active || !cropperState.img || !cropperState.onCropped) return;
      applyBtn.disabled = true;
      applyBtn.textContent = 'Processing Crop...';

      try {
        const croppedDataUrl = exportCroppedImage();
        await cropperState.onCropped(croppedDataUrl, cropperState.filename);
        closeCropper();
      } catch (err) {
        showToast(err.message || 'Crop failed', 'error');
      } finally {
        applyBtn.disabled = false;
        applyBtn.textContent = 'Crop & Upload';
      }
    });
  }
}

function setCropperZoom(newZoom) {
  const clamped = Math.max(1, Math.min(3, newZoom));
  cropperState.zoom = clamped;
  const slider = document.getElementById('cropper-zoom-slider');
  if (slider) slider.value = clamped;
  drawCropper();
}

function setCropperRatio(ratio) {
  cropperState.ratio = ratio;
  updateGuideBoxDimensions();
  resetCropperView();
  drawCropper();
}

function updateGuideBoxDimensions() {
  const guideBox = document.getElementById('cropper-guide-box');
  const stageWrapper = document.querySelector('.cropper-stage-wrapper');
  if (!guideBox || !stageWrapper) return;

  const stageW = stageWrapper.clientWidth || 540;
  const stageH = stageWrapper.clientHeight || 360;
  cropperState.stageW = stageW;
  cropperState.stageH = stageH;

  let boxW, boxH;
  if (cropperState.ratio === '16:9') {
    boxW = Math.min(stageW - 40, 420);
    boxH = Math.round(boxW * (9 / 16));
    if (boxH > stageH - 40) {
      boxH = stageH - 40;
      boxW = Math.round(boxH * (16 / 9));
    }
    guideBox.classList.remove('circle');
  } else if (cropperState.ratio === '4:3') {
    boxH = Math.min(stageH - 40, 270);
    boxW = Math.round(boxH * (4 / 3));
    if (boxW > stageW - 40) {
      boxW = stageW - 40;
      boxH = Math.round(boxW * (3 / 4));
    }
    guideBox.classList.remove('circle');
  } else {
    // 1:1 Square
    const size = Math.min(stageW - 40, stageH - 40, 260);
    boxW = size;
    boxH = size;
    if (cropperState.category === 'photo') {
      guideBox.classList.add('circle');
    } else {
      guideBox.classList.remove('circle');
    }
  }

  cropperState.boxW = boxW;
  cropperState.boxH = boxH;

  guideBox.style.width = `${boxW}px`;
  guideBox.style.height = `${boxH}px`;
  guideBox.style.left = `${Math.round((stageW - boxW) / 2)}px`;
  guideBox.style.top = `${Math.round((stageH - boxH) / 2)}px`;
}

function resetCropperView() {
  cropperState.panX = 0;
  cropperState.panY = 0;
  cropperState.rotation = 0;
  setCropperZoom(1.0);
}

function drawCropper() {
  if (!cropperState.active || !cropperState.img) return;

  const canvas = document.getElementById('cropper-canvas');
  if (!canvas) return;

  const stageWrapper = document.querySelector('.cropper-stage-wrapper');
  const stageW = stageWrapper.clientWidth || 540;
  const stageH = stageWrapper.clientHeight || 360;

  if (canvas.width !== stageW || canvas.height !== stageH) {
    canvas.width = stageW;
    canvas.height = stageH;
  }

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, stageW, stageH);

  const img = cropperState.img;
  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;

  const isRotated90 = (cropperState.rotation === 90 || cropperState.rotation === 270);
  const effImgW = isRotated90 ? imgH : imgW;
  const effImgH = isRotated90 ? imgW : imgH;

  const baseScale = Math.max(cropperState.boxW / effImgW, cropperState.boxH / effImgH);
  const currentScale = baseScale * cropperState.zoom;

  ctx.save();
  ctx.translate(stageW / 2 + cropperState.panX, stageH / 2 + cropperState.panY);
  ctx.rotate((cropperState.rotation * Math.PI) / 180);
  ctx.scale(currentScale, currentScale);
  ctx.drawImage(img, -imgW / 2, -imgH / 2);
  ctx.restore();
}

function exportCroppedImage() {
  const img = cropperState.img;
  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;

  let outW = 600;
  let outH = 600;
  if (cropperState.ratio === '16:9') {
    outW = 960;
    outH = 540;
  } else if (cropperState.ratio === '4:3') {
    outW = 800;
    outH = 600;
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const ctx = outCanvas.getContext('2d');

  const exportScale = outW / cropperState.boxW;

  const isRotated90 = (cropperState.rotation === 90 || cropperState.rotation === 270);
  const effImgW = isRotated90 ? imgH : imgW;
  const effImgH = isRotated90 ? imgW : imgH;

  const baseScale = Math.max(cropperState.boxW / effImgW, cropperState.boxH / effImgH);
  const currentScale = baseScale * cropperState.zoom;

  ctx.save();
  ctx.translate(outW / 2 + (cropperState.panX * exportScale), outH / 2 + (cropperState.panY * exportScale));
  ctx.rotate((cropperState.rotation * Math.PI) / 180);
  ctx.scale(currentScale * exportScale, currentScale * exportScale);
  ctx.drawImage(img, -imgW / 2, -imgH / 2);
  ctx.restore();

  return outCanvas.toDataURL('image/jpeg', 0.92);
}

function openImageCropper({ file, category, ratio, onCropped }) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      cropperState.active = true;
      cropperState.img = img;
      cropperState.filename = file.name;
      cropperState.category = category;
      cropperState.onCropped = onCropped;

      const defaultRatio = ratio || (category === 'photo' ? '1:1' : '16:9');
      cropperState.ratio = defaultRatio;

      document.querySelectorAll('.btn-ratio-chip').forEach(chip => {
        if (chip.getAttribute('data-ratio') === defaultRatio) {
          chip.classList.add('active');
        } else {
          chip.classList.remove('active');
        }
      });

      const titleEl = document.getElementById('modal-cropper-title');
      if (titleEl) {
        titleEl.textContent = category === 'photo'
          ? 'Crop Profile Photo'
          : (category === 'screenshot' ? 'Crop Project Screenshot' : 'Crop Project Thumbnail');
      }

      openModal('modal-image-cropper');

      requestAnimationFrame(() => {
        updateGuideBoxDimensions();
        resetCropperView();
        drawCropper();
      });
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function setPhoto(url, name) {
  const photoInput = document.getElementById('p-photo');
  const dropzone = document.getElementById('photo-dropzone');
  const previewWrap = document.getElementById('photo-preview-wrap');
  const previewImg = document.getElementById('photo-preview-img');
  const previewName = document.getElementById('photo-preview-name');

  if (photoInput) photoInput.value = url;
  if (dropzone) dropzone.style.display = 'none';
  if (previewWrap) previewWrap.style.display = 'flex';
  if (previewImg) previewImg.src = url;
  if (previewName) previewName.textContent = name || url.split('/').pop() || 'photo.jpg';
}

function clearPhoto() {
  const photoInput = document.getElementById('p-photo');
  const dropzone = document.getElementById('photo-dropzone');
  const previewWrap = document.getElementById('photo-preview-wrap');
  const previewImg = document.getElementById('photo-preview-img');
  const fileInput = document.getElementById('photo-file-input');

  if (photoInput) photoInput.value = '';
  if (dropzone) dropzone.style.display = 'flex';
  if (previewWrap) previewWrap.style.display = 'none';
  if (previewImg) previewImg.src = '';
  if (fileInput) fileInput.value = '';
}

function setResume(url, name) {
  const resumeInput = document.getElementById('p-resume');
  const dropzone = document.getElementById('resume-dropzone');
  const previewWrap = document.getElementById('resume-preview-wrap');
  const previewName = document.getElementById('resume-preview-name');
  const viewLink = document.getElementById('resume-view-link');

  if (resumeInput) resumeInput.value = url;
  if (dropzone) dropzone.style.display = 'none';
  if (previewWrap) previewWrap.style.display = 'flex';
  if (previewName) previewName.textContent = name || url.split('/').pop() || 'resume.pdf';
  if (viewLink) {
    viewLink.onclick = (e) => {
      e.preventDefault();
      openPdfUrl(url);
    };
    viewLink.href = url.startsWith('data:') ? '/resume.pdf' : url;
  }
}

function clearResume() {
  const resumeInput = document.getElementById('p-resume');
  const dropzone = document.getElementById('resume-dropzone');
  const previewWrap = document.getElementById('resume-preview-wrap');
  const viewLink = document.getElementById('resume-view-link');
  const fileInput = document.getElementById('resume-file-input');

  if (resumeInput) resumeInput.value = '';
  if (dropzone) dropzone.style.display = 'flex';
  if (previewWrap) previewWrap.style.display = 'none';
  if (viewLink) viewLink.href = '#';
  if (fileInput) fileInput.value = '';
}

function setProjThumb(url, name) {
  const thumbInput = document.getElementById('proj-thumb');
  const dropzone = document.getElementById('proj-thumb-dropzone');
  const previewWrap = document.getElementById('proj-thumb-preview-wrap');
  const previewImg = document.getElementById('proj-thumb-preview-img');
  const previewName = document.getElementById('proj-thumb-preview-name');
  const uploadedRow = document.getElementById('proj-thumb-uploaded-row');
  const eyeLink = document.getElementById('proj-thumb-eye-link');
  const filenameLabel = document.getElementById('proj-thumb-filename-label');

  if (thumbInput) thumbInput.value = url;
  if (dropzone) dropzone.style.display = 'none';
  if (previewWrap) previewWrap.style.display = 'flex';
  if (previewImg) previewImg.src = url;
  const displayName = name || url.split('/').pop() || 'thumbnail.jpg';
  if (previewName) previewName.textContent = displayName;
  if (filenameLabel) filenameLabel.textContent = displayName;
  if (uploadedRow) uploadedRow.style.display = 'flex';
  if (eyeLink) eyeLink.href = url;
}

function clearProjThumb() {
  const thumbInput = document.getElementById('proj-thumb');
  const dropzone = document.getElementById('proj-thumb-dropzone');
  const previewWrap = document.getElementById('proj-thumb-preview-wrap');
  const previewImg = document.getElementById('proj-thumb-preview-img');
  const fileInput = document.getElementById('proj-thumb-file-input');
  const uploadedRow = document.getElementById('proj-thumb-uploaded-row');
  const eyeLink = document.getElementById('proj-thumb-eye-link');
  const filenameLabel = document.getElementById('proj-thumb-filename-label');

  if (thumbInput) thumbInput.value = '/assets/placeholder-avatar.svg';
  if (dropzone) dropzone.style.display = 'flex';
  if (previewWrap) previewWrap.style.display = 'none';
  if (previewImg) previewImg.src = '';
  if (fileInput) fileInput.value = '';
  if (uploadedRow) uploadedRow.style.display = 'none';
  if (eyeLink) eyeLink.href = '#';
  if (filenameLabel) filenameLabel.textContent = 'No file chosen';
}

function setProjScreenshot1(url, name) {
  const sInput = document.getElementById('proj-screenshot1');
  const dropzone = document.getElementById('proj-s1-dropzone');
  const previewWrap = document.getElementById('proj-s1-preview-wrap');
  const previewImg = document.getElementById('proj-s1-preview-img');
  const previewName = document.getElementById('proj-s1-preview-name');
  const uploadedRow = document.getElementById('proj-s1-uploaded-row');
  const eyeLink = document.getElementById('proj-s1-eye-link');
  const filenameLabel = document.getElementById('proj-s1-filename-label');

  if (sInput) sInput.value = url;
  if (dropzone) dropzone.style.display = 'none';
  if (previewWrap) previewWrap.style.display = 'flex';
  if (previewImg) previewImg.src = url;
  const displayName = name || url.split('/').pop() || 'screenshot1.jpg';
  if (previewName) previewName.textContent = displayName;
  if (filenameLabel) filenameLabel.textContent = displayName;
  if (uploadedRow) uploadedRow.style.display = 'flex';
  if (eyeLink) eyeLink.href = url;
}

function clearProjScreenshot1() {
  const sInput = document.getElementById('proj-screenshot1');
  const dropzone = document.getElementById('proj-s1-dropzone');
  const previewWrap = document.getElementById('proj-s1-preview-wrap');
  const previewImg = document.getElementById('proj-s1-preview-img');
  const fileInput = document.getElementById('proj-s1-file-input');
  const uploadedRow = document.getElementById('proj-s1-uploaded-row');
  const eyeLink = document.getElementById('proj-s1-eye-link');
  const filenameLabel = document.getElementById('proj-s1-filename-label');

  if (sInput) sInput.value = '';
  if (dropzone) dropzone.style.display = 'flex';
  if (previewWrap) previewWrap.style.display = 'none';
  if (previewImg) previewImg.src = '';
  if (fileInput) fileInput.value = '';
  if (uploadedRow) uploadedRow.style.display = 'none';
  if (eyeLink) eyeLink.href = '#';
  if (filenameLabel) filenameLabel.textContent = 'No file chosen';
}

function setProjScreenshot2(url, name) {
  const sInput = document.getElementById('proj-screenshot2');
  const dropzone = document.getElementById('proj-s2-dropzone');
  const previewWrap = document.getElementById('proj-s2-preview-wrap');
  const previewImg = document.getElementById('proj-s2-preview-img');
  const previewName = document.getElementById('proj-s2-preview-name');
  const uploadedRow = document.getElementById('proj-s2-uploaded-row');
  const eyeLink = document.getElementById('proj-s2-eye-link');
  const filenameLabel = document.getElementById('proj-s2-filename-label');

  if (sInput) sInput.value = url;
  if (dropzone) dropzone.style.display = 'none';
  if (previewWrap) previewWrap.style.display = 'flex';
  if (previewImg) previewImg.src = url;
  const displayName = name || url.split('/').pop() || 'screenshot2.jpg';
  if (previewName) previewName.textContent = displayName;
  if (filenameLabel) filenameLabel.textContent = displayName;
  if (uploadedRow) uploadedRow.style.display = 'flex';
  if (eyeLink) eyeLink.href = url;
}

function clearProjScreenshot2() {
  const sInput = document.getElementById('proj-screenshot2');
  const dropzone = document.getElementById('proj-s2-dropzone');
  const previewWrap = document.getElementById('proj-s2-preview-wrap');
  const previewImg = document.getElementById('proj-s2-preview-img');
  const fileInput = document.getElementById('proj-s2-file-input');
  const uploadedRow = document.getElementById('proj-s2-uploaded-row');
  const eyeLink = document.getElementById('proj-s2-eye-link');
  const filenameLabel = document.getElementById('proj-s2-filename-label');

  if (sInput) sInput.value = '';
  if (dropzone) dropzone.style.display = 'flex';
  if (previewWrap) previewWrap.style.display = 'none';
  if (previewImg) previewImg.src = '';
  if (fileInput) fileInput.value = '';
  if (uploadedRow) uploadedRow.style.display = 'none';
  if (eyeLink) eyeLink.href = '#';
  if (filenameLabel) filenameLabel.textContent = 'No file chosen';
}

function setProjVideo(url, name) {
  const videoInput = document.getElementById('proj-video');
  const dropzone = document.getElementById('proj-video-dropzone');
  const previewWrap = document.getElementById('proj-video-preview-wrap');
  const player = document.getElementById('proj-video-preview-player');
  const previewName = document.getElementById('proj-video-preview-name');

  if (videoInput) videoInput.value = url;
  if (dropzone) dropzone.style.display = 'none';
  if (previewWrap) previewWrap.style.display = 'flex';
  if (player) player.src = url;
  if (previewName) previewName.textContent = name || url.split('/').pop() || 'demo.mp4';
}

function clearProjVideo() {
  const videoInput = document.getElementById('proj-video');
  const dropzone = document.getElementById('proj-video-dropzone');
  const previewWrap = document.getElementById('proj-video-preview-wrap');
  const player = document.getElementById('proj-video-preview-player');
  const fileInput = document.getElementById('proj-video-file-input');

  if (videoInput) videoInput.value = '';
  if (dropzone) dropzone.style.display = 'flex';
  if (previewWrap) previewWrap.style.display = 'none';
  if (player) player.src = '';
  if (fileInput) fileInput.value = '';
}

function bindDropzone(dropzoneId, fileInputId, onFile) {
  const dropzone = document.getElementById(dropzoneId);
  const fileInput = document.getElementById(fileInputId);
  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      fileInput.value = '';
      onFile(file);
    }
  });
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
  document.getElementById('p-bio').value = info.bio || '';

  if (info.photo_url) {
    setPhoto(info.photo_url, info.photo_url.split('/').pop());
  } else {
    clearPhoto();
  }

  if (info.resume_url) {
    setResume(info.resume_url, info.resume_url.split('/').pop());
  } else {
    clearResume();
  }
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
      syncLocalOverrides({ personal_info: data.data || payload });
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
  const res = await fetch(`/api/admin/experience?t=${Date.now()}`);
  const data = await res.json();
  if (data.success) {
    allExperiences = data.data || [];
    syncLocalOverrides({ experience: allExperiences });
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
  const res = await fetch(`/api/admin/projects?t=${Date.now()}`);
  const data = await res.json();
  if (data.success) {
    allProjects = data.data || [];
    syncLocalOverrides({ projects: allProjects });
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

function updateCharCounters() {
  const shortInfo = document.getElementById('proj-short-info');
  const shortCount = document.getElementById('proj-short-info-count');
  if (shortInfo && shortCount) {
    shortCount.textContent = `${shortInfo.value.length} / 300`;
  }

  const desc = document.getElementById('proj-desc');
  const descCount = document.getElementById('proj-desc-count');
  if (desc && descCount) {
    descCount.textContent = `${desc.value.length} / 1000`;
  }

  const s1Desc = document.getElementById('proj-s1-desc');
  const s1Count = document.getElementById('proj-s1-desc-count');
  if (s1Desc && s1Count) {
    s1Count.textContent = `${s1Desc.value.length} / 255`;
  }

  const s2Desc = document.getElementById('proj-s2-desc');
  const s2Count = document.getElementById('proj-s2-desc-count');
  if (s2Desc && s2Count) {
    s2Count.textContent = `${s2Desc.value.length} / 255`;
  }
}

function openAddProject() {
  document.getElementById('modal-project-title').textContent = 'Add Project';
  document.getElementById('form-project').reset();
  document.getElementById('proj-id').value = '';
  document.getElementById('proj-type').value = 'Excel';
  document.getElementById('proj-visible-yes').checked = true;
  clearProjThumb();
  clearProjScreenshot1();
  clearProjScreenshot2();
  clearProjVideo();
  updateCharCounters();
  openModal('modal-project');
}

function openEditProject(id) {
  const proj = allProjects.find(item => item.id === id);
  if (!proj) return;

  document.getElementById('modal-project-title').textContent = 'Edit Project';
  document.getElementById('proj-id').value = proj.id;
  document.getElementById('proj-type').value = proj.project_type || 'Excel';
  document.getElementById('proj-domain').value = proj.domain || '';
  document.getElementById('proj-other-tools').value = proj.other_tools || '';
  document.getElementById('proj-name').value = proj.name || '';
  document.getElementById('proj-short-info').value = proj.short_info || '';
  document.getElementById('proj-desc').value = proj.description || '';
  document.getElementById('proj-s1-desc').value = proj.screenshot1_desc || '';
  document.getElementById('proj-s2-desc').value = proj.screenshot2_desc || '';
  document.getElementById('proj-video-link').value = proj.video_url || '';
  document.getElementById('proj-powerbi').value = proj.powerbi_url || '';
  document.getElementById('proj-tags').value = (proj.tech_tags || []).join(', ');
  document.getElementById('proj-linkedin').value = proj.linkedin_url || '';
  document.getElementById('proj-github').value = proj.github_url || '';
  document.getElementById('proj-platform').value = proj.platform_name || '';
  document.getElementById('proj-link').value = proj.external_link || '';

  if (proj.is_visible === false) {
    document.getElementById('proj-visible-no').checked = true;
  } else {
    document.getElementById('proj-visible-yes').checked = true;
  }

  if (proj.thumbnail_url && proj.thumbnail_url !== '/assets/placeholder-avatar.svg') {
    setProjThumb(proj.thumbnail_url, proj.thumbnail_url.split('/').pop());
  } else {
    clearProjThumb();
  }

  if (proj.screenshot1_url) {
    setProjScreenshot1(proj.screenshot1_url, proj.screenshot1_url.split('/').pop());
  } else {
    clearProjScreenshot1();
  }

  if (proj.screenshot2_url) {
    setProjScreenshot2(proj.screenshot2_url, proj.screenshot2_url.split('/').pop());
  } else {
    clearProjScreenshot2();
  }

  if (proj.video_url && /\.(mp4|webm|ogg|mov|mkv)$/i.test(proj.video_url)) {
    setProjVideo(proj.video_url, proj.video_url.split('/').pop());
  } else {
    clearProjVideo();
  }

  updateCharCounters();
  openModal('modal-project');
}

async function handleSaveProject(e) {
  e.preventDefault();
  const id = document.getElementById('proj-id').value;
  const project_type = document.getElementById('proj-type').value;
  const domain = document.getElementById('proj-domain').value.trim();
  const other_tools = document.getElementById('proj-other-tools').value.trim();
  const name = document.getElementById('proj-name').value.trim() || 'Untitled Project';
  const short_info = document.getElementById('proj-short-info').value.trim();
  const description = document.getElementById('proj-desc').value.trim();
  const tagsStr = document.getElementById('proj-tags').value;
  const tech_tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
  const thumbnail_url = document.getElementById('proj-thumb').value || '/assets/placeholder-avatar.svg';
  const screenshot1_url = document.getElementById('proj-screenshot1').value || null;
  const screenshot1_desc = document.getElementById('proj-s1-desc').value.trim() || null;
  const screenshot2_url = document.getElementById('proj-screenshot2').value || null;
  const screenshot2_desc = document.getElementById('proj-s2-desc').value.trim() || null;

  const videoInputUrl = document.getElementById('proj-video-link').value.trim();
  const uploadedVideoUrl = document.getElementById('proj-video').value;
  const video_url = videoInputUrl || uploadedVideoUrl || null;

  const powerbi_url = document.getElementById('proj-powerbi').value.trim() || null;
  const linkedin_url = document.getElementById('proj-linkedin').value.trim() || null;
  const github_url = document.getElementById('proj-github').value.trim() || null;
  const platform_name = document.getElementById('proj-platform').value.trim() || null;
  const external_link = document.getElementById('proj-link').value.trim() || null;
  const is_visible = document.getElementById('proj-visible-yes').checked;

  const payload = {
    project_type,
    domain,
    other_tools,
    name,
    short_info,
    description,
    tech_tags,
    thumbnail_url,
    screenshot1_url,
    screenshot1_desc,
    screenshot2_url,
    screenshot2_desc,
    video_url,
    powerbi_url,
    linkedin_url,
    github_url,
    platform_name,
    external_link,
    is_visible
  };

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
  const res = await fetch(`/api/admin/skills?t=${Date.now()}`);
  const data = await res.json();
  if (data.success) {
    allSkills = data.data || [];
    syncLocalOverrides({ skills: getGroupedSkills(allSkills) });
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
  const res = await fetch(`/api/admin/faq?t=${Date.now()}`);
  const data = await res.json();
  if (data.success) {
    allFaqs = data.data || [];
    syncLocalOverrides({ faq: allFaqs });
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

  // Security & Password Reset Form
  const formResetPassword = document.getElementById('form-reset-password');
  if (formResetPassword) formResetPassword.addEventListener('submit', handleResetPassword);
  setupPasswordToggles();

  // Initialize Cropper Controls
  initCropper();

  // Media Upload Dropzones & Controls
  // 1. Photo Upload (JPEG, PNG with manual cropper)
  bindDropzone('photo-dropzone', 'photo-file-input', async (file) => {
    const validExts = ['.jpg', '.jpeg', '.png'];
    const name = file.name.toLowerCase();
    const isValid = validExts.some(ext => name.endsWith(ext)) || file.type.startsWith('image/jpeg') || file.type.startsWith('image/png');
    if (!isValid) {
      showToast('Only JPEG and PNG formats are allowed for profile photo.', 'error');
      return;
    }

    openImageCropper({
      file,
      category: 'photo',
      onCropped: async (croppedDataUrl, originalName) => {
        showToast('Uploading cropped photo...', 'success');
        const res = await uploadMediaFile({
          name: originalName.replace(/\.[^.]+$/, '') + '-cropped.jpg',
          type: 'image/jpeg'
        }, 'photo', croppedDataUrl);
        setPhoto(res.url, res.filename);
        try {
          await fetch('/api/admin/personal-info', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photo_url: res.url })
          });
        } catch (_) {}
        showToast('Profile photo cropped & saved!');
      }
    });
  });

  const btnChangePhoto = document.getElementById('btn-change-photo');
  if (btnChangePhoto) {
    btnChangePhoto.addEventListener('click', () => {
      document.getElementById('photo-file-input').click();
    });
  }

  const btnRemovePhoto = document.getElementById('btn-remove-photo');
  if (btnRemovePhoto) {
    btnRemovePhoto.addEventListener('click', async () => {
      clearPhoto();
      try {
        await fetch('/api/admin/personal-info', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo_url: '/assets/placeholder-avatar.svg' })
        });
      } catch (_) {}
    });
  }

  // 2. Resume Upload (PDF only)
  bindDropzone('resume-dropzone', 'resume-file-input', async (file) => {
    const name = file.name.toLowerCase();
    const isPdf = name.endsWith('.pdf') || file.type === 'application/pdf';
    if (!isPdf) {
      showToast('Only PDF format (.pdf) is allowed for resume.', 'error');
      return;
    }
    try {
      showToast('Uploading resume PDF...', 'success');
      const res = await uploadMediaFile(file, 'resume');
      setResume(res.url, res.filename);
      try {
        await fetch('/api/admin/personal-info', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resume_url: res.url })
        });
      } catch (_) {}
      showToast('Resume PDF uploaded & saved!');
    } catch (err) {
      showToast(err.message || 'Failed to upload resume', 'error');
    }
  });

  const btnChangeResume = document.getElementById('btn-change-resume');
  if (btnChangeResume) {
    btnChangeResume.addEventListener('click', () => {
      document.getElementById('resume-file-input').click();
    });
  }

  const btnRemoveResume = document.getElementById('btn-remove-resume');
  if (btnRemoveResume) {
    btnRemoveResume.addEventListener('click', async () => {
      clearResume();
      try {
        await fetch('/api/admin/personal-info', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resume_url: '/resume.pdf' })
        });
      } catch (_) {}
    });
  }

  // 3. Project Thumbnail Upload (with manual cropper)
  bindDropzone('proj-thumb-dropzone', 'proj-thumb-file-input', async (file) => {
    const validExts = ['.jpg', '.jpeg', '.png'];
    const name = file.name.toLowerCase();
    const isValid = validExts.some(ext => name.endsWith(ext)) || file.type.startsWith('image/jpeg') || file.type.startsWith('image/png');
    if (!isValid) {
      showToast('Please select a JPG or PNG image for project thumbnail.', 'error');
      return;
    }

    openImageCropper({
      file,
      category: 'thumbnail',
      ratio: '16:9',
      onCropped: async (croppedDataUrl, originalName) => {
        showToast('Uploading cropped thumbnail...', 'success');
        const res = await uploadMediaFile({
          name: originalName.replace(/\.[^.]+$/, '') + '-cropped.jpg',
          type: 'image/jpeg'
        }, 'thumbnail', croppedDataUrl);
        setProjThumb(res.url, res.filename);
        showToast('Project thumbnail cropped & uploaded!');
      }
    });
  });

  const btnChangeThumb = document.getElementById('btn-change-proj-thumb');
  if (btnChangeThumb) {
    btnChangeThumb.addEventListener('click', () => {
      document.getElementById('proj-thumb-file-input').click();
    });
  }

  const btnRemoveThumb = document.getElementById('btn-remove-proj-thumb');
  if (btnRemoveThumb) {
    btnRemoveThumb.addEventListener('click', clearProjThumb);
  }

  // 4. Project Video Upload (MP4, WebM, OGG, MOV)
  bindDropzone('proj-video-dropzone', 'proj-video-file-input', async (file) => {
    const validExts = ['.mp4', '.webm', '.ogg', '.mov', '.mkv'];
    const name = file.name.toLowerCase();
    const isValid = validExts.some(ext => name.endsWith(ext)) || file.type.startsWith('video/');
    if (!isValid) {
      showToast('Please upload an MP4, WebM, OGG, or MOV video file.', 'error');
      return;
    }

    const statusEl = document.getElementById('proj-video-upload-status');
    const statusText = document.getElementById('proj-video-upload-text');
    if (statusEl) {
      statusEl.style.display = 'flex';
      if (statusText) statusText.textContent = `Uploading ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)}MB)...`;
    }

    try {
      const res = await uploadMediaFile(file, 'video');
      setProjVideo(res.url, res.filename);
      showToast('Video demo uploaded successfully!');
    } catch (err) {
      showToast(err.message || 'Failed to upload video', 'error');
    } finally {
      if (statusEl) statusEl.style.display = 'none';
    }
  });

  const btnChangeVideo = document.getElementById('btn-change-proj-video');
  if (btnChangeVideo) {
    btnChangeVideo.addEventListener('click', () => {
      document.getElementById('proj-video-file-input').click();
    });
  }

  const btnRemoveVideo = document.getElementById('btn-remove-proj-video');
  if (btnRemoveVideo) {
    btnRemoveVideo.addEventListener('click', clearProjVideo);
  }

  // 5. Project Screenshot 1 (JPG/PNG with manual cropper)
  bindDropzone('proj-s1-dropzone', 'proj-s1-file-input', async (file) => {
    const validExts = ['.jpg', '.jpeg', '.png'];
    const name = file.name.toLowerCase();
    const isValid = validExts.some(ext => name.endsWith(ext)) || file.type.startsWith('image/jpeg') || file.type.startsWith('image/png');
    if (!isValid) {
      showToast('Only JPG and PNG formats are allowed for Screenshot 1.', 'error');
      return;
    }

    openImageCropper({
      file,
      category: 'screenshot',
      ratio: '16:9',
      onCropped: async (croppedDataUrl, originalName) => {
        showToast('Uploading cropped screenshot 1...', 'success');
        const res = await uploadMediaFile({
          name: originalName.replace(/\.[^.]+$/, '') + '-s1.jpg',
          type: 'image/jpeg'
        }, 'screenshot', croppedDataUrl);
        setProjScreenshot1(res.url, res.filename);
        showToast('Screenshot 1 cropped & uploaded!');
      }
    });
  });

  const btnChangeS1 = document.getElementById('btn-change-proj-s1');
  if (btnChangeS1) {
    btnChangeS1.addEventListener('click', () => {
      document.getElementById('proj-s1-file-input').click();
    });
  }

  const btnRemoveS1 = document.getElementById('btn-remove-proj-s1');
  if (btnRemoveS1) {
    btnRemoveS1.addEventListener('click', clearProjScreenshot1);
  }

  // 6. Project Screenshot 2 (JPG/PNG with manual cropper)
  bindDropzone('proj-s2-dropzone', 'proj-s2-file-input', async (file) => {
    const validExts = ['.jpg', '.jpeg', '.png'];
    const name = file.name.toLowerCase();
    const isValid = validExts.some(ext => name.endsWith(ext)) || file.type.startsWith('image/jpeg') || file.type.startsWith('image/png');
    if (!isValid) {
      showToast('Only JPG and PNG formats are allowed for Screenshot 2.', 'error');
      return;
    }

    openImageCropper({
      file,
      category: 'screenshot',
      ratio: '16:9',
      onCropped: async (croppedDataUrl, originalName) => {
        showToast('Uploading cropped screenshot 2...', 'success');
        const res = await uploadMediaFile({
          name: originalName.replace(/\.[^.]+$/, '') + '-s2.jpg',
          type: 'image/jpeg'
        }, 'screenshot', croppedDataUrl);
        setProjScreenshot2(res.url, res.filename);
        showToast('Screenshot 2 cropped & uploaded!');
      }
    });
  });

  const btnChangeS2 = document.getElementById('btn-change-proj-s2');
  if (btnChangeS2) {
    btnChangeS2.addEventListener('click', () => {
      document.getElementById('proj-s2-file-input').click();
    });
  }

  const btnRemoveS2 = document.getElementById('btn-remove-proj-s2');
  if (btnRemoveS2) {
    btnRemoveS2.addEventListener('click', clearProjScreenshot2);
  }

  // Character counter listeners
  ['proj-short-info', 'proj-desc', 'proj-s1-desc', 'proj-s2-desc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateCharCounters);
  });

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

/**
 * 8. Security & Master Password Reset
 */
function setupPasswordToggles() {
  document.querySelectorAll('.btn-pwd-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🔒';
      } else {
        input.type = 'password';
        btn.textContent = '👁️';
      }
    });
  });
}

async function handleResetPassword(e) {
  e.preventDefault();
  const alertEl = document.getElementById('password-alert');
  const currentPassword = document.getElementById('pwd-current').value;
  const newPassword = document.getElementById('pwd-new').value;
  const confirmPassword = document.getElementById('pwd-confirm').value;
  const submitBtn = document.getElementById('btn-save-password');

  if (alertEl) alertEl.style.display = 'none';

  if (newPassword.length < 6) {
    if (alertEl) {
      alertEl.className = 'alert-banner alert-danger';
      alertEl.textContent = 'New password must be at least 6 characters long.';
      alertEl.style.display = 'block';
    }
    return;
  }

  if (newPassword !== confirmPassword) {
    if (alertEl) {
      alertEl.className = 'alert-banner alert-danger';
      alertEl.textContent = 'New password and confirmation do not match.';
      alertEl.style.display = 'block';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Updating...';
  }

  try {
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      document.getElementById('form-reset-password').reset();
      showToast('Master password successfully updated!');
      if (alertEl) {
        alertEl.className = 'alert-banner';
        alertEl.style.backgroundColor = '#D1FAE5';
        alertEl.style.color = '#065F46';
        alertEl.style.border = '1px solid #34D399';
        alertEl.textContent = 'Master password was successfully reset. You remain logged in.';
        alertEl.style.display = 'block';
      }
    } else {
      if (alertEl) {
        alertEl.className = 'alert-banner alert-danger';
        alertEl.textContent = data.error || 'Failed to reset password.';
        alertEl.style.display = 'block';
      }
    }
  } catch (err) {
    if (alertEl) {
      alertEl.className = 'alert-banner alert-danger';
      alertEl.textContent = 'Network or server error updating password.';
      alertEl.style.display = 'block';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Reset Master Password';
    }
  }
}

