import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

async function runPhase6Tests() {
  console.log('====================================================');
  console.log('          RUNNING PHASE 6 VERIFICATION TESTS        ');
  console.log('====================================================');

  // ----------------------------------------------------
  // Test 1: Verify all 9 Section CSS Files Exist & Have Content
  // ----------------------------------------------------
  console.log('\n[Test 1] Verifying all section stylesheets...');
  const expectedCss = [
    'nav.css',
    'hero.css',
    'highlights.css',
    'experience.css',
    'projects.css',
    'skills.css',
    'faq.css',
    'contact.css',
    'footer.css'
  ];

  for (const file of expectedCss) {
    const filePath = path.join(publicDir, 'css/sections', file);
    assert.ok(fs.existsSync(filePath), `Stylesheet public/css/sections/${file} must exist`);
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.length > 100, `Stylesheet ${file} should contain rules`);
  }
  console.log('✅ All 9 section stylesheets verified with comprehensive CSS styling.');

  // ----------------------------------------------------
  // Test 2: Verify Interactive JavaScript Modules
  // ----------------------------------------------------
  console.log('\n[Test 2] Verifying client JavaScript modules...');
  const expectedJs = [
    'nav.js',
    'modal.js',
    'faq.js',
    'contact.js',
    'content.js',
    'app.js'
  ];

  for (const file of expectedJs) {
    const filePath = path.join(publicDir, 'js', file);
    assert.ok(fs.existsSync(filePath), `Script public/js/${file} must exist`);
  }

  const modalJs = fs.readFileSync(path.join(publicDir, 'js/modal.js'), 'utf-8');
  assert.ok(modalJs.includes('openProjectModal'), 'modal.js must export openProjectModal');
  assert.ok(modalJs.includes('closeProjectModal'), 'modal.js must export closeProjectModal');

  const contentJs = fs.readFileSync(path.join(publicDir, 'js/content.js'), 'utf-8');
  assert.ok(contentJs.includes('/api/content'), 'content.js must query /api/content');
  assert.ok(contentJs.includes('renderExperience'), 'content.js must render experience');
  assert.ok(contentJs.includes('renderProjects'), 'content.js must render projects');
  assert.ok(contentJs.includes('renderSkills'), 'content.js must render skills');
  assert.ok(contentJs.includes('renderFaq'), 'content.js must render FAQ');
  console.log('✅ All client JavaScript controllers verified with required methods.');

  // ----------------------------------------------------
  // Test 3: Verify index.html Links & Assets
  // ----------------------------------------------------
  console.log('\n[Test 3] Verifying public/index.html links and module loading...');
  const indexHtml = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf-8');

  for (const file of expectedCss) {
    assert.ok(indexHtml.includes(`/css/sections/${file}`), `index.html must include link to ${file}`);
  }

  assert.ok(indexHtml.includes('src="/js/app.js"'), 'index.html must load /js/app.js');
  assert.ok(indexHtml.includes('id="modal-close-btn"'), 'index.html must contain modal close button');
  assert.ok(indexHtml.includes('id="contact-form"'), 'index.html must contain contact form');
  assert.ok(indexHtml.includes('name="_gotcha"'), 'index.html must contain honeypot field');
  console.log('✅ index.html properly linked to all stylesheets, app module, and interactive modal.');

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 6 TESTS PASSED SUCCESSFULLY!          ');
  console.log('====================================================');
}

runPhase6Tests().catch(err => {
  console.error('❌ Phase 6 test failed:', err);
  process.exitCode = 1;
});
