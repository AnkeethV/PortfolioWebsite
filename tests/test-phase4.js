import assert from 'assert';
import chatHandler from '../api/chat.js';
import { buildSystemPrompt } from '../api/_lib/promptBuilder.js';
import { checkRateLimit, resetLimitsForTesting } from '../api/_lib/rateLimiter.js';
import { close } from '../api/_lib/db.js';

/**
 * Mock HTTP response capable of capturing streamed SSE chunks
 */
function createMockStreamResponse() {
  const chunks = [];
  const headers = {};
  let statusCode = 200;
  let ended = false;

  return {
    statusCode,
    headers,
    setHeader(k, v) {
      headers[k.toLowerCase()] = v;
      return this;
    },
    getHeader(k) {
      return headers[k.toLowerCase()];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      this.ended = true;
      return this;
    },
    write(chunk) {
      chunks.push(chunk);
      return true;
    },
    end() {
      this.ended = true;
    },
    getRawOutput() {
      return chunks.join('');
    },
    getAccumulatedText() {
      const raw = chunks.join('');
      const lines = raw.split('\n');
      let text = '';
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const parsed = JSON.parse(line.replace('data: ', ''));
            if (parsed.content) text += parsed.content;
          } catch (e) {}
        }
      }
      return text;
    }
  };
}

async function runPhase4Tests() {
  console.log('====================================================');
  console.log('          RUNNING PHASE 4 VERIFICATION TESTS        ');
  console.log('====================================================');

  // ----------------------------------------------------
  // Test 1: Dynamic System Prompt Construction
  // ----------------------------------------------------
  console.log('\n[Test 1] Testing buildSystemPrompt() dynamic DB grounding...');
  const prompt = await buildSystemPrompt();
  assert.ok(prompt.includes('Ankeeth V'), 'Prompt must identify Ankeeth V');
  assert.ok(prompt.includes('60 Days'), 'Prompt must contain 60 Days notice period');
  assert.ok(prompt.includes('mailto:'), 'Prompt must contain mailto link instruction');
  assert.ok(prompt.includes('Kaseya'), 'Prompt must include experience data from DB');
  assert.ok(prompt.includes('Business360'), 'Prompt must include projects from DB');
  console.log('✅ System prompt builder produced complete grounded context with PRD rules.');

  // ----------------------------------------------------
  // Test 2: Rate Limiting Module
  // ----------------------------------------------------
  console.log('\n[Test 2] Testing Rate Limiter (15 requests/10 min window)...');
  resetLimitsForTesting();
  const testIp = '192.168.1.100';

  for (let i = 1; i <= 15; i++) {
    const res = checkRateLimit(testIp);
    assert.strictEqual(res.allowed, true, `Request ${i} should be permitted`);
  }

  // 16th request must be blocked
  const blockedRes = checkRateLimit(testIp);
  assert.strictEqual(blockedRes.allowed, false, '16th request must be blocked');
  assert.ok(blockedRes.retryAfter > 0, 'Retry-after seconds must be positive');
  console.log('✅ Rate limiter strictly enforces 15 requests limit.');

  // ----------------------------------------------------
  // Test 3: POST /api/chat Streaming - Notice Period Question
  // ----------------------------------------------------
  console.log('\n[Test 3] Testing POST /api/chat streaming (Notice Period)...');
  resetLimitsForTesting();
  {
    const req = {
      method: 'POST',
      body: { message: 'What is your notice period?' },
      headers: { 'x-forwarded-for': '10.0.0.1' }
    };
    const res = createMockStreamResponse();

    await chatHandler(req, res);

    assert.strictEqual(res.getHeader('content-type'), 'text/event-stream; charset=utf-8');
    const answer = res.getAccumulatedText();
    assert.ok(answer.includes('60 Days'), 'Chatbot answer must specify 60 Days');
    console.log(`✅ Notice period response streamed: "${answer.slice(0, 60)}..."`);
  }

  // ----------------------------------------------------
  // Test 4: POST /api/chat Streaming - Relocation Question
  // ----------------------------------------------------
  console.log('\n[Test 4] Testing POST /api/chat streaming (Relocation)...');
  {
    const req = {
      method: 'POST',
      body: { message: 'Are you open to relocation?' },
      headers: { 'x-forwarded-for': '10.0.0.2' }
    };
    const res = createMockStreamResponse();

    await chatHandler(req, res);

    const answer = res.getAccumulatedText();
    assert.ok(answer.includes('Bengaluru') || answer.includes('not open to physical relocation'), 'Chatbot answer must reference Bengaluru/no physical relocation');
    console.log(`✅ Relocation response streamed: "${answer.slice(0, 60)}..."`);
  }

  // ----------------------------------------------------
  // Test 5: POST /api/chat Streaming - Salary / Compensation & Links
  // ----------------------------------------------------
  console.log('\n[Test 5] Testing POST /api/chat streaming (Salary & Link formatting)...');
  {
    const req = {
      method: 'POST',
      body: { message: 'What is your current salary expectation?' },
      headers: { 'x-forwarded-for': '10.0.0.3' }
    };
    const res = createMockStreamResponse();

    await chatHandler(req, res);

    const answer = res.getAccumulatedText();
    assert.ok(answer.includes('mailto:ankeeth.v@gmail.com'), 'Chatbot must provide clickable mailto link for salary inquiries');
    console.log(`✅ Salary response streamed with clickable mailto link.`);
  }

  // ----------------------------------------------------
  // Test 6: POST /api/chat Streaming - Off-topic Decline
  // ----------------------------------------------------
  console.log('\n[Test 6] Testing POST /api/chat streaming (Off-topic question)...');
  {
    const req = {
      method: 'POST',
      body: { message: 'What is the weather in Paris today?' },
      headers: { 'x-forwarded-for': '10.0.0.4' }
    };
    const res = createMockStreamResponse();

    await chatHandler(req, res);

    const answer = res.getAccumulatedText();
    assert.ok(answer.includes('focused') || answer.includes('professional') || answer.includes('data'), 'Chatbot must politely decline off-topic question');
    console.log(`✅ Off-topic question politely declined and redirected to data background.`);
  }

  // ----------------------------------------------------
  // Test 7: Rate Limit Rejection (HTTP 429)
  // ----------------------------------------------------
  console.log('\n[Test 7] Testing POST /api/chat rate limit 429 response...');
  {
    const spammerIp = '10.0.0.99';
    // Consume 15 requests
    for (let i = 0; i < 15; i++) {
      checkRateLimit(spammerIp);
    }

    const req = {
      method: 'POST',
      body: { message: 'Spamming message' },
      headers: { 'x-forwarded-for': spammerIp }
    };
    const res = createMockStreamResponse();

    await chatHandler(req, res);

    assert.strictEqual(res.statusCode, 429, 'Excessive chat request must return 429');
    assert.ok(res.body.error.includes('Rate limit reached'), 'Error message must state rate limit');
    console.log('✅ Chat endpoint correctly returned 429 Rate Limit Reached.');
  }

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 4 TESTS PASSED SUCCESSFULLY!          ');
  console.log('====================================================');
}

runPhase4Tests()
  .catch(err => {
    console.error('❌ Phase 4 test failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await close();
  });
