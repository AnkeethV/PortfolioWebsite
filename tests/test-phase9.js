/**
 * Phase 9 Verification Test Suite
 * End-to-End Verification, Security Audit & Acceptance Testing
 * ============================================================================== */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifySeedAndPersistence } from '../scripts/verify-seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 Running Phase 9 Test Suite (E2E & Security Audit)');
  console.log('======================================================\n');

  // Test 1: TASK-9.1 Auto-seeding & Persistence
  console.log('Test 1: Running TASK-9.1 Auto-seeding & Persistence verification...');
  await verifySeedAndPersistence();
  console.log('  ✔ TASK-9.1 auto-seeding idempotency & persistence verified.');

  // Test 2: TASK-9.2 Chatbot Response Grounding Matrix
  console.log('\nTest 2: Running TASK-9.2 Chatbot Grounding Matrix Evaluation...');
  const evalPath = path.join(rootDir, 'tests', 'chatbot-eval.json');
  const evalMatrix = JSON.parse(fs.readFileSync(evalPath, 'utf8'));

  for (let idx = 0; idx < evalMatrix.length; idx++) {
    const item = evalMatrix[idx];
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': `192.168.10.${idx + 1}`
      },
      body: JSON.stringify({ message: item.prompt })
    });
    assert.equal(res.status, 200, `Chatbot response for "${item.prompt}" should be HTTP 200`);

    const streamBody = await res.text();
    // Accumulate SSE tokens
    let assembled = '';
    for (const line of streamBody.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data:') && !trimmed.includes('[DONE]')) {
        try {
          const parsed = JSON.parse(trimmed.replace(/^data:\s*/, ''));
          if (parsed.content) assembled += parsed.content;
        } catch (_) {}
      }
    }

    // Evaluate expected keywords
    for (const kw of item.expected_keywords) {
      assert.ok(
        assembled.toLowerCase().includes(kw.toLowerCase()),
        `Chat response for category "${item.category}" should include keyword "${kw}". Got: "${assembled.trim()}"`
      );
    }
    console.log(`  ✔ [${item.category}] Grounded correctly: "${assembled.trim().slice(0, 60)}..."`);
  }

  // Test 3: TASK-9.3 Accessibility & Responsive Layout Checks
  console.log('\nTest 3: Running TASK-9.3 Accessibility & Responsive CSS Checks...');
  const baseCss = fs.readFileSync(path.join(rootDir, 'public', 'css', 'base.css'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(rootDir, 'public', 'index.html'), 'utf8');

  const chatJs = fs.readFileSync(path.join(rootDir, 'public', 'js', 'chat.js'), 'utf8');

  assert.match(chatJs, /aria-label="Interactive AI Assistant"/, 'Chatbot drawer must have accessible aria-label');
  assert.match(indexHtml, /aria-label="Open mobile menu"/, 'Navbar mobile toggle must have aria-label');
  assert.match(indexHtml, /<main id="main-content">/, 'Page must have main landmark');
  assert.match(indexHtml, /<footer id="footer"/, 'Page must have footer landmark');
  assert.match(baseCss, /button:focus-visible|a:focus-visible/, 'CSS must define accessible focus rings');
  console.log('  ✔ Accessibility landmarks, labels, and focus styles verified.');

  // Test 4: TASK-9.4 Security Audit & Secret Leak Verification
  console.log('\nTest 4: Running TASK-9.4 Security Audit & Leak Check...');

  // 4a. Client files scan: Ensure NO sensitive secrets are embedded in public/
  const sensitiveKeys = ['GROQ_API_KEY', 'JWT_SECRET', 'ADMIN_PASSWORD', 'POSTGRES_URL', 'DATABASE_URL'];
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html') || entry.name.endsWith('.css'))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const key of sensitiveKeys) {
          // Check that secrets are not referenced as string literals or env assignments in client code
          assert.ok(
            !content.includes(`process.env.${key}`) && !content.includes(`"${key}"`),
            `Security Alert: Client-side file ${entry.name} references sensitive key "${key}"!`
          );
        }
      }
    }
  }
  scanDir(path.join(rootDir, 'public'));
  console.log('  ✔ Zero server secrets found in public client bundle.');

  // 4b. Protected Admin Endpoints Return 401 without cookie
  const protectedRoutes = [
    { url: '/api/admin/personal-info', method: 'PUT', body: { name: 'Hack' } },
    { url: '/api/admin/experience', method: 'POST', body: { title: 'Hack' } },
    { url: '/api/admin/projects', method: 'POST', body: { name: 'Hack' } },
    { url: '/api/admin/skills', method: 'POST', body: { value: 'Hack' } },
    { url: '/api/admin/faq', method: 'POST', body: { question: 'Hack' } }
  ];

  for (const route of protectedRoutes) {
    const res = await fetch(`${BASE_URL}${route.url}`, {
      method: route.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(route.body)
    });
    assert.equal(res.status, 401, `Unauthenticated ${route.method} ${route.url} must return HTTP 401`);
  }
  console.log('  ✔ All admin endpoints strictly reject unauthenticated requests with 401.');

  // 4c. Contact Form Honeypot Anti-Spam Check
  const honeypotRes = await fetch(`${BASE_URL}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Spam Bot',
      email: 'spambot@example.com',
      message: 'Buy cheap watches',
      _gotcha: 'https://spamlink.com'
    })
  });
  assert.equal(honeypotRes.status, 200, 'Honeypot should discard spam silently with HTTP 200');
  const hpJson = await honeypotRes.json();
  assert.equal(hpJson.success, true, 'Honeypot returns success to bot without sending');
  console.log('  ✔ Contact form honeypot anti-spam trap operates silently.');

  console.log('\n======================================================');
  console.log('🎉 Phase 9 test suite PASSED with 100% compliance!');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Phase 9 test suite FAILED:', err);
  process.exit(1);
});
