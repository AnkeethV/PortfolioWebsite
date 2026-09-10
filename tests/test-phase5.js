import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

async function runPhase5Tests() {
  console.log('====================================================');
  console.log('          RUNNING PHASE 5 VERIFICATION TESTS        ');
  console.log('====================================================');

  // ----------------------------------------------------
  // Test 1: Validate variables.css Tokens
  // ----------------------------------------------------
  console.log('\n[Test 1] Validating public/css/variables.css tokens...');
  const varPath = path.join(publicDir, 'css/variables.css');
  assert.ok(fs.existsSync(varPath), 'variables.css must exist');
  const varContent = fs.readFileSync(varPath, 'utf-8');

  // Typography tokens
  assert.ok(varContent.includes('Playfair Display'), 'Must include Playfair Display font');
  assert.ok(varContent.includes('Plus Jakarta Sans') || varContent.includes('Inter'), 'Must include clean sans-serif');

  // Light theme tokens
  assert.ok(varContent.includes('#F4F3EF'), 'Light background must be warm cream #F4F3EF');
  assert.ok(varContent.includes('#1A1A1A'), 'Primary text must be near-black #1A1A1A');
  assert.ok(varContent.includes('#F2B705'), 'Accent color must be golden-yellow #F2B705');
  assert.ok(varContent.includes('#2E2E2E'), 'Contrast surface must be dark charcoal #2E2E2E');

  // Dark theme tokens
  assert.ok(varContent.includes('[data-theme="dark"]'), 'Must define dark theme selector');
  assert.ok(varContent.includes('--radius-pill'), 'Must define pill radius');
  assert.ok(varContent.includes('9999px'), 'Pill radius must be 9999px');
  console.log('✅ variables.css design tokens validated for both light and dark themes.');

  // ----------------------------------------------------
  // Test 2: Validate base.css Styles
  // ----------------------------------------------------
  console.log('\n[Test 2] Validating public/css/base.css utilities & typography...');
  const basePath = path.join(publicDir, 'css/base.css');
  assert.ok(fs.existsSync(basePath), 'base.css must exist');
  const baseContent = fs.readFileSync(basePath, 'utf-8');

  assert.ok(baseContent.includes('.skip-link'), 'Must include skip-link accessibility style');
  assert.ok(baseContent.includes('.btn-pill'), 'Must include .btn-pill stadium button class');
  assert.ok(baseContent.includes('.btn-primary'), 'Must include .btn-primary class');
  assert.ok(baseContent.includes('.btn-secondary'), 'Must include .btn-secondary class');
  assert.ok(baseContent.includes('.folded-corner-section'), 'Must include decorative folded-corner motif');
  assert.ok(baseContent.includes('.container'), 'Must include responsive container class');
  console.log('✅ base.css verified with typography, pill buttons, and responsive rules.');

  // ----------------------------------------------------
  // Test 3: Validate theme.js Controller
  // ----------------------------------------------------
  console.log('\n[Test 3] Validating public/js/theme.js module...');
  const themePath = path.join(publicDir, 'js/theme.js');
  assert.ok(fs.existsSync(themePath), 'theme.js must exist');
  const themeContent = fs.readFileSync(themePath, 'utf-8');

  assert.ok(themeContent.includes('ankeeth_portfolio_theme'), 'Must use localStorage key');
  assert.ok(themeContent.includes('data-theme'), 'Must manipulate data-theme attribute');
  assert.ok(themeContent.includes('prefers-color-scheme'), 'Must support OS prefers-color-scheme fallback');
  console.log('✅ theme.js controller validated with persistence and OS preference handling.');

  // ----------------------------------------------------
  // Test 4: Validate Semantic HTML Structure & SEO in index.html
  // ----------------------------------------------------
  console.log('\n[Test 4] Validating public/index.html landmarks & SEO...');
  const indexPath = path.join(publicDir, 'index.html');
  assert.ok(fs.existsSync(indexPath), 'index.html must exist');
  const indexContent = fs.readFileSync(indexPath, 'utf-8');

  // SEO & Head
  assert.ok(indexContent.includes('<title>Ankeeth V'), 'Must include descriptive title');
  assert.ok(indexContent.includes('<meta name="description"'), 'Must include meta description');
  assert.ok(indexContent.includes('property="og:title"'), 'Must include Open Graph title');
  assert.ok(indexContent.includes('<a href="#main-content" class="skip-link"'), 'Must include skip link');

  // All 7 Core Semantic Sections
  const requiredLandmarks = [
    'id="navbar"',
    'id="main-content"',
    'id="hero"',
    'id="highlights"',
    'id="experience"',
    'id="projects"',
    'id="skills"',
    'id="faq"',
    'id="contact"',
    'id="footer"',
    'id="project-modal"',
    'id="chat-widget-root"'
  ];

  for (const landmark of requiredLandmarks) {
    assert.ok(indexContent.includes(landmark), `index.html must contain landmark: ${landmark}`);
  }
  console.log('✅ index.html verified with 100% semantic landmarks, SEO tags, and modal root.');

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 5 TESTS PASSED SUCCESSFULLY!          ');
  console.log('====================================================');
}

runPhase5Tests().catch(err => {
  console.error('❌ Phase 5 test failed:', err);
  process.exitCode = 1;
});
