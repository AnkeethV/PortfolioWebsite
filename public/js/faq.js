/**
   FAQ Accordion Controller
   Handles click toggling, ARIA attributes, and smooth expand/collapse
   ========================================================================== */

export function initFaq() {
  const container = document.getElementById('faq-accordion');
  if (!container) return;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.faq-question-btn');
    if (!btn) return;

    const item = btn.closest('.faq-item');
    if (!item) return;

    const wasOpen = item.classList.contains('open');

    // Close any other open items
    const allItems = container.querySelectorAll('.faq-item');
    allItems.forEach(other => {
      if (other !== item) {
        other.classList.remove('open');
        const otherBtn = other.querySelector('.faq-question-btn');
        if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
      }
    });

    // Toggle target item
    if (wasOpen) {
      item.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    } else {
      item.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
}

export default initFaq;
