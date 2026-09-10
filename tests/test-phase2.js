import assert from 'assert';
import contentHandler from '../api/content.js';
import contactHandler from '../api/contact.js';
import { close } from '../api/_lib/db.js';

/**
 * Creates mock req and res objects to test Vercel serverless handlers
 */
function createMockHttp({ method = 'GET', body = {}, query = {}, headers = {} }) {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
      return this;
    },
    getHeader(key) {
      return this.headers[key.toLowerCase()];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end(data) {
      this.ended = true;
      return this;
    }
  };

  const req = {
    method,
    body,
    query,
    headers
  };

  return { req, res };
}

async function runPhase2Tests() {
  console.log('====================================================');
  console.log('          RUNNING PHASE 2 VERIFICATION TESTS        ');
  console.log('====================================================');

  // ----------------------------------------------------
  // Test 1: GET /api/content
  // ----------------------------------------------------
  console.log('\n[Test 1] Testing GET /api/content...');
  {
    const { req, res } = createMockHttp({ method: 'GET' });
    await contentHandler(req, res);

    assert.strictEqual(res.statusCode, 200, 'Content endpoint should return 200');
    assert.strictEqual(res.body.success, true, 'Content body should have success: true');
    assert.ok(res.body.data, 'Content should have data object');

    const data = res.body.data;
    assert.strictEqual(data.personal_info.name, 'Ankeeth V', 'Personal info name should match');
    assert.strictEqual(data.experience.length, 4, 'Should return 4 experience items');
    assert.strictEqual(data.projects.length, 4, 'Should return 4 projects');
    assert.ok(Array.isArray(data.skills.technical), 'Skills should contain technical category');
    assert.ok(Array.isArray(data.skills.tools), 'Skills should contain tools category');
    assert.ok(Array.isArray(data.skills.soft), 'Skills should contain soft category');
    assert.strictEqual(data.faq.length, 6, 'Should return 6 FAQ items');

    assert.ok(res.getHeader('cache-control'), 'Should have Cache-Control header');
    console.log('✅ GET /api/content passed with complete, valid portfolio structure.');
  }

  // ----------------------------------------------------
  // Test 2: Invalid method on /api/content
  // ----------------------------------------------------
  console.log('\n[Test 2] Testing POST /api/content (Method Not Allowed)...');
  {
    const { req, res } = createMockHttp({ method: 'POST' });
    await contentHandler(req, res);
    assert.strictEqual(res.statusCode, 405, 'Should reject POST with 405');
    console.log('✅ 405 Method Not Allowed verified for POST /api/content.');
  }

  // ----------------------------------------------------
  // Test 3: POST /api/contact - Valid Submission
  // ----------------------------------------------------
  console.log('\n[Test 3] Testing POST /api/contact with valid payload...');
  {
    const { req, res } = createMockHttp({
      method: 'POST',
      body: {
        name: 'Sarah Connor',
        email: 'sarah.connor@example.com',
        message: 'Hello Ankeeth, I am interested in discussing a senior data role.'
      }
    });
    await contactHandler(req, res);

    assert.strictEqual(res.statusCode, 200, 'Valid contact form should return 200');
    assert.strictEqual(res.body.success, true, 'Should return success: true');
    console.log('✅ Valid contact submission processed successfully.');
  }

  // ----------------------------------------------------
  // Test 4: POST /api/contact - Invalid Email
  // ----------------------------------------------------
  console.log('\n[Test 4] Testing POST /api/contact with invalid email...');
  {
    const { req, res } = createMockHttp({
      method: 'POST',
      body: {
        name: 'Invalid User',
        email: 'not-an-email',
        message: 'Hello'
      }
    });
    await contactHandler(req, res);

    assert.strictEqual(res.statusCode, 400, 'Should reject invalid email with 400');
    assert.strictEqual(res.body.success, false);
    console.log('✅ Email validation caught invalid format:', res.body.error);
  }

  // ----------------------------------------------------
  // Test 5: POST /api/contact - Honeypot Trap
  // ----------------------------------------------------
  console.log('\n[Test 5] Testing POST /api/contact honeypot anti-spam trap...');
  {
    const { req, res } = createMockHttp({
      method: 'POST',
      body: {
        name: 'Spam Bot 3000',
        email: 'bot@spamnetwork.com',
        message: 'Buy our fake products now!',
        _gotcha: 'http://malicious-spam-url.com' // Hidden trap field
      }
    });
    await contactHandler(req, res);

    assert.strictEqual(res.statusCode, 200, 'Honeypot trap should return synthetic 200');
    assert.strictEqual(res.body.success, true);
    console.log('✅ Honeypot successfully trapped spam bot silently.');
  }

  // ----------------------------------------------------
  // Test 6: GET /api/contact (Method Not Allowed)
  // ----------------------------------------------------
  console.log('\n[Test 6] Testing GET /api/contact (Method Not Allowed)...');
  {
    const { req, res } = createMockHttp({ method: 'GET' });
    await contactHandler(req, res);
    assert.strictEqual(res.statusCode, 405, 'Should reject GET with 405');
    console.log('✅ 405 Method Not Allowed verified for GET /api/contact.');
  }

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 2 TESTS PASSED SUCCESSFULLY!          ');
  console.log('====================================================');
}

runPhase2Tests()
  .catch(err => {
    console.error('❌ Phase 2 test failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await close();
  });
