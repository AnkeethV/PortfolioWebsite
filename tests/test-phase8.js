/**
 * Phase 8 Verification Test Suite
 * Tests Admin Portal UI Assets, Routing, Auth Session & Protected CRUD Operations
 * ============================================================================== */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function runTests() {
  console.log('\n========================================');
  console.log('🧪 Running Phase 8 Test Suite (Admin Portal)');
  console.log('========================================\n');

  // Test 1: File Existence & Integrity
  console.log('Test 1: Verifying Phase 8 file assets...');
  const htmlPath = path.join(rootDir, 'public', 'admin', 'index.html');
  const cssPath = path.join(rootDir, 'public', 'admin', 'admin.css');
  const jsPath = path.join(rootDir, 'public', 'admin', 'admin.js');

  assert.ok(fs.existsSync(htmlPath), 'public/admin/index.html must exist');
  assert.ok(fs.existsSync(cssPath), 'public/admin/admin.css must exist');
  assert.ok(fs.existsSync(jsPath), 'public/admin/admin.js must exist');

  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.match(html, /id="login-view"/, 'index.html must contain login view');
  assert.match(html, /id="dashboard-view"/, 'index.html must contain dashboard view');
  assert.match(html, /data-tab="personal-info"/, 'index.html must contain Personal Info tab');
  assert.match(html, /data-tab="experience"/, 'index.html must contain Experience tab');
  assert.match(html, /data-tab="projects"/, 'index.html must contain Projects tab');
  assert.match(html, /data-tab="skills"/, 'index.html must contain Skills tab');
  assert.match(html, /data-tab="faq"/, 'index.html must contain FAQ tab');
  assert.match(html, /id="modal-experience"/, 'index.html must contain Experience modal');
  assert.match(html, /id="modal-project"/, 'index.html must contain Project modal');
  assert.match(html, /id="modal-faq"/, 'index.html must contain FAQ modal');
  console.log('  ✔ Admin HTML structure and modals verified.');

  // Test 2: Live Dev Server Static Routing for Admin
  console.log(`\nTest 2: Verifying /admin static routing on dev server (${BASE_URL})...`);
  const adminRes = await fetch(`${BASE_URL}/admin`);
  assert.equal(adminRes.status, 200, '/admin should return HTTP 200');
  const adminHtml = await adminRes.text();
  assert.match(adminHtml, /Admin Console — Ankeeth V/, '/admin must return Admin Console HTML');

  const cssRes = await fetch(`${BASE_URL}/admin/admin.css`);
  assert.equal(cssRes.status, 200, '/admin/admin.css should return HTTP 200');

  const jsRes = await fetch(`${BASE_URL}/admin/admin.js`);
  assert.equal(jsRes.status, 200, '/admin/admin.js should return HTTP 200');
  console.log('  ✔ /admin routes, styles, and scripts successfully served.');

  // Test 3: Authentication & Session Verification
  console.log('\nTest 3: Testing Admin Auth Flow...');
  // 3a. Unauthenticated /api/admin/me
  const meUnauth = await fetch(`${BASE_URL}/api/admin/me`);
  assert.equal(meUnauth.status, 401, 'Unauthenticated /api/admin/me should return 401');

  // 3b. Wrong password
  const loginWrong = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'wrong-password-xyz' })
  });
  assert.equal(loginWrong.status, 401, 'Wrong password must return 401');

  // 3c. Valid password
  const loginValid = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD })
  });
  assert.equal(loginValid.status, 200, 'Valid password must return 200');
  const cookieHeader = loginValid.headers.get('set-cookie');
  assert.ok(cookieHeader, 'Login must issue set-cookie header');
  assert.match(cookieHeader, /admin_token=/, 'Cookie must contain admin_token');

  // Extract auth cookie value
  const authCookie = cookieHeader.split(';')[0];

  // 3d. Authenticated /api/admin/me
  const meAuth = await fetch(`${BASE_URL}/api/admin/me`, {
    headers: { 'Cookie': authCookie }
  });
  assert.equal(meAuth.status, 200, 'Authenticated /api/admin/me must return 200');
  const meJson = await meAuth.json();
  assert.equal(meJson.authenticated, true);
  console.log('  ✔ Admin authentication and cookie lifecycle verified.');

  // Test 4: Protected Admin CRUD Endpoints
  console.log('\nTest 4: Testing CRUD Endpoints with authenticated session...');

  // 4a. Personal Info Update
  const putInfo = await fetch(`${BASE_URL}/api/admin/personal-info`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
    body: JSON.stringify({
      name: 'Ankeeth V',
      title: 'Senior Engineer & Data/AI Specialist',
      bio: 'Grounded analytical specialist with deep experience in systems engineering.',
      location: 'Bengaluru, Karnataka, India',
      email: 'ankeeth.v@gmail.com'
    })
  });
  assert.equal(putInfo.status, 200, 'PUT /api/admin/personal-info must succeed');
  console.log('  ✔ Personal info updated.');

  // 4b. Experience CRUD
  const createExp = await fetch(`${BASE_URL}/api/admin/experience`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
    body: JSON.stringify({
      company: 'Test Company Alpha',
      title: 'Senior Analyst',
      start_date: 'Jan 2024',
      end_date: 'Present',
      bullets: ['Automated analytics pipeline', 'Enhanced reporting speed by 40%']
    })
  });
  assert.equal(createExp.status, 201, 'POST /api/admin/experience should create entry');
  const expData = await createExp.json();
  const expId = expData.data.id;

  const deleteExp = await fetch(`${BASE_URL}/api/admin/experience?id=${expId}`, {
    method: 'DELETE',
    headers: { 'Cookie': authCookie }
  });
  assert.equal(deleteExp.status, 200, 'DELETE /api/admin/experience should remove entry');
  console.log('  ✔ Experience CRUD passed.');

  // 4c. Projects CRUD
  const createProj = await fetch(`${BASE_URL}/api/admin/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
    body: JSON.stringify({
      name: 'Test Project Beta',
      description: 'Analytics dashboard implementation',
      tech_tags: ['SQL', 'Power BI'],
      thumbnail_url: '/assets/placeholder-avatar.svg'
    })
  });
  assert.equal(createProj.status, 201, 'POST /api/admin/projects should create project');
  const projData = await createProj.json();
  const projId = projData.data.id;

  const deleteProj = await fetch(`${BASE_URL}/api/admin/projects?id=${projId}`, {
    method: 'DELETE',
    headers: { 'Cookie': authCookie }
  });
  assert.equal(deleteProj.status, 200, 'DELETE /api/admin/projects should remove project');
  console.log('  ✔ Projects CRUD passed.');

  // 4d. Skills CRUD
  const createSkill = await fetch(`${BASE_URL}/api/admin/skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
    body: JSON.stringify({ category: 'technical', value: 'Apache Spark' })
  });
  assert.equal(createSkill.status, 201, 'POST /api/admin/skills should create skill');
  const skillData = await createSkill.json();
  const skillId = skillData.data.id;

  const deleteSkill = await fetch(`${BASE_URL}/api/admin/skills?id=${skillId}`, {
    method: 'DELETE',
    headers: { 'Cookie': authCookie }
  });
  assert.equal(deleteSkill.status, 200, 'DELETE /api/admin/skills should remove skill');
  console.log('  ✔ Skills CRUD passed.');

  // 4e. FAQ CRUD
  const createFaq = await fetch(`${BASE_URL}/api/admin/faq`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
    body: JSON.stringify({
      question: 'What is your preferred communication channel?',
      answer: 'Email at ankeeth.v@gmail.com or LinkedIn messaging.'
    })
  });
  assert.equal(createFaq.status, 201, 'POST /api/admin/faq should create FAQ');
  const faqData = await createFaq.json();
  const faqId = faqData.data.id;

  const deleteFaq = await fetch(`${BASE_URL}/api/admin/faq?id=${faqId}`, {
    method: 'DELETE',
    headers: { 'Cookie': authCookie }
  });
  assert.equal(deleteFaq.status, 200, 'DELETE /api/admin/faq should remove FAQ');
  console.log('  ✔ FAQ CRUD passed.');

  // 4f. Logout
  const logoutRes = await fetch(`${BASE_URL}/api/admin/logout`, {
    method: 'POST',
    headers: { 'Cookie': authCookie }
  });
  assert.equal(logoutRes.status, 200, 'POST /api/admin/logout should return 200');
  console.log('  ✔ Logout cleared session.');

  console.log('\n========================================');
  console.log('🎉 Phase 8 test suite PASSED successfully!');
  console.log('========================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Phase 8 test suite FAILED:', err);
  process.exit(1);
});
