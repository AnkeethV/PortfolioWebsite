/**
   Client Entry Point: app.js
   Initializes Theme, Navigation, Modals, FAQ Accordion, Contact Form & Content
   ========================================================================== */

import { initTheme } from './theme.js';
import { initNav } from './nav.js';
import { initModal } from './modal.js';
import { initFaq } from './faq.js';
import { initContactForm } from './contact.js';
import { loadContent } from './content.js';
import { initChat } from './chat.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Interactive UI Components
  initTheme();
  initNav();
  initModal();
  initFaq();
  initContactForm();
  initChat();

  // 2. Hydrate dynamic content from API
  loadContent();
});
