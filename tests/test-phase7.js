/**
 * Phase 7 Verification Test Suite
 * Tests Chatbot Widget UI, Markdown Parser, SSE Streaming Integration & Voice Support
 * ================================================================================= */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMarkdown } from '../public/js/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function runTests() {
  console.log('\n========================================');
  console.log('🧪 Running Phase 7 Test Suite (Chatbot & Voice UI)');
  console.log('========================================\n');

  // Test 1: File Existence
  console.log('Test 1: Verifying Phase 7 file assets...');
  const chatCssPath = path.join(rootDir, 'public', 'css', 'chat.css');
  const chatJsPath = path.join(rootDir, 'public', 'js', 'chat.js');
  assert.ok(fs.existsSync(chatCssPath), 'public/css/chat.css must exist');
  assert.ok(fs.existsSync(chatJsPath), 'public/js/chat.js must exist');
  console.log('  ✔ All required source files exist.');

  // Test 2: CSS Architecture and Animations
  console.log('\nTest 2: Verifying Chat CSS tokens and animations...');
  const cssContent = fs.readFileSync(chatCssPath, 'utf8');
  assert.match(cssContent, /\.chat-launcher/, 'CSS must style floating chat launcher');
  assert.match(cssContent, /\.chat-window/, 'CSS must style chat drawer window');
  assert.match(cssContent, /\.chat-chip/, 'CSS must style suggested prompt chips');
  assert.match(cssContent, /\.chat-msg-row/, 'CSS must style message rows');
  assert.match(cssContent, /\.chat-mic-btn/, 'CSS must style microphone voice button');
  assert.match(cssContent, /@keyframes mic-pulse/, 'CSS must define mic-pulse animation for active speech recording');
  assert.match(cssContent, /@keyframes dot-bounce/, 'CSS must define dot-bounce animation for typing indicator');
  assert.match(cssContent, /@media\s*\(max-width:\s*480px\)/, 'CSS must provide responsive mobile drawer overrides');
  console.log('  ✔ CSS rules, keyframe animations, and mobile styles verified.');

  // Test 3: Markdown Parser Unit Tests
  console.log('\nTest 3: Testing Markdown & XSS Parser...');
  
  // Link conversion
  const linkParsed = parseMarkdown('Check my [GitHub Profile](https://github.com/AnkeethV) for details.');
  assert.ok(linkParsed.includes('<a href="https://github.com/AnkeethV" target="_blank" rel="noopener noreferrer">GitHub Profile</a>'), 'Markdown links must be transformed to secure clickable anchors');

  // Mailto conversion
  const mailParsed = parseMarkdown('Contact me at [ankeeth.v@gmail.com](mailto:ankeeth.v@gmail.com).');
  assert.ok(mailParsed.includes('<a href="mailto:ankeeth.v@gmail.com">ankeeth.v@gmail.com</a>'), 'Mailto links must be parsed into functional mailto anchors without target="_blank"');

  // XSS protection
  const xssAttempt = parseMarkdown('Hello <script>alert("hacked")</script> **world**!');
  assert.ok(!xssAttempt.includes('<script>'), 'Raw HTML tags must be sanitized/escaped');
  assert.ok(xssAttempt.includes('&lt;script&gt;alert(&quot;hacked&quot;)&lt;/script&gt;'), 'HTML entities must be properly escaped');
  assert.ok(xssAttempt.includes('<strong>world</strong>'), 'Bold markdown must be parsed');

  // Javascript: URL scheme rejection
  const jsSchemeAttempt = parseMarkdown('[Malicious](javascript:alert(1))');
  assert.ok(!jsSchemeAttempt.includes('href="javascript:'), 'Dangerous URI schemes like javascript: must NOT be converted to executable links');

  console.log('  ✔ Markdown parser correctly converts links, formats text, and sanitizes dangerous payloads.');

  // Test 4: App.js Integration
  console.log('\nTest 4: Verifying app.js integrates chat widget...');
  const appJsContent = fs.readFileSync(path.join(rootDir, 'public', 'js', 'app.js'), 'utf8');
  assert.match(appJsContent, /import\s*\{\s*initChat\s*\}\s*from\s*['"]\.\/chat\.js['"]/, 'app.js must import initChat');
  assert.match(appJsContent, /initChat\(\)/, 'app.js must invoke initChat() on DOMContentLoaded');
  console.log('  ✔ app.js properly mounts and initializes chat widget.');

  // Test 5: Live Dev Server Static Assets & Streaming API
  console.log(`\nTest 5: Live Dev Server integration checks (${BASE_URL})...`);
  try {
    // Check static CSS
    const cssRes = await fetch(`${BASE_URL}/css/chat.css`);
    assert.equal(cssRes.status, 200, '/css/chat.css should return HTTP 200');
    console.log('  ✔ /css/chat.css successfully served.');

    // Check static JS
    const jsRes = await fetch(`${BASE_URL}/js/chat.js`);
    assert.equal(jsRes.status, 200, '/js/chat.js should return HTTP 200');
    console.log('  ✔ /js/chat.js successfully served.');

    // Check streaming chat endpoint
    const chatRes = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '192.168.7.1'
      },
      body: JSON.stringify({ message: 'What is your notice period?' })
    });
    assert.equal(chatRes.status, 200, '/api/chat should return HTTP 200');
    assert.match(chatRes.headers.get('content-type') || '', /text\/event-stream/, 'Response must be SSE text/event-stream');

    const streamBody = await chatRes.text();
    // Reassemble SSE stream content tokens
    let assembledChatText = '';
    for (const line of streamBody.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data:') && !trimmed.includes('[DONE]')) {
        try {
          const parsed = JSON.parse(trimmed.replace(/^data:\s*/, ''));
          if (parsed.content) assembledChatText += parsed.content;
        } catch (_) {}
      }
    }

    assert.match(assembledChatText, /60 Days/i, 'Stream response must contain grounded notice period answer');
    assert.match(streamBody, /data:\s*\[DONE\]/, 'Stream must terminate with [DONE] signal');
    console.log(`  ✔ /api/chat SSE token streaming verified with grounded prompt answer: "${assembledChatText.trim()}"`);

  } catch (err) {
    console.error('  ✖ Dev server test failed:', err.message);
    throw err;
  }

  console.log('\n========================================');
  console.log('🎉 Phase 7 test suite PASSED successfully!');
  console.log('========================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Phase 7 test suite FAILED:', err);
  process.exit(1);
});
