import assert from 'assert';
import loginHandler from '../api/admin/login.js';
import logoutHandler from '../api/admin/logout.js';
import meHandler from '../api/admin/me.js';
import personalInfoHandler from '../api/admin/personal-info.js';
import experienceHandler from '../api/admin/experience.js';
import projectsHandler from '../api/admin/projects.js';
import skillsHandler from '../api/admin/skills.js';
import faqHandler from '../api/admin/faq.js';
import contentHandler from '../api/content.js';
import { close } from '../api/_lib/db.js';

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

async function runPhase3Tests() {
  console.log('====================================================');
  console.log('          RUNNING PHASE 3 VERIFICATION TESTS        ');
  console.log('====================================================');

  const correctPassword = process.env.ADMIN_PASSWORD || 'admin123';
  let authCookie = '';

  // ----------------------------------------------------
  // Test 1: Invalid Login Rejection
  // ----------------------------------------------------
  console.log('\n[Test 1] Testing POST /api/admin/login with wrong password...');
  {
    const { req, res } = createMockHttp({
      method: 'POST',
      body: { password: 'wrong-password-999' }
    });
    await loginHandler(req, res);

    assert.strictEqual(res.statusCode, 401, 'Should return 401 for wrong password');
    assert.strictEqual(res.body.success, false);
    console.log('✅ Wrong password successfully rejected with 401.');
  }

  // ----------------------------------------------------
  // Test 2: Successful Login & Cookie Generation
  // ----------------------------------------------------
  console.log('\n[Test 2] Testing POST /api/admin/login with valid password...');
  {
    const { req, res } = createMockHttp({
      method: 'POST',
      body: { password: correctPassword }
    });
    await loginHandler(req, res);

    assert.strictEqual(res.statusCode, 200, 'Should return 200 for correct password');
    assert.strictEqual(res.body.success, true);
    assert.ok(res.getHeader('set-cookie'), 'Should set cookie header');

    authCookie = res.getHeader('set-cookie');
    assert.ok(authCookie.includes('admin_token='), 'Cookie should contain admin_token');
    assert.ok(authCookie.toLowerCase().includes('httponly'), 'Cookie must be HttpOnly');
    console.log('✅ Login succeeded and issued HTTP-only admin_token cookie.');
  }

  // ----------------------------------------------------
  // Test 3: Unauthorized Guard Check
  // ----------------------------------------------------
  console.log('\n[Test 3] Testing Unauthorized Access Guard...');
  {
    const { req, res } = createMockHttp({ method: 'GET' }); // No cookie
    await meHandler(req, res);
    assert.strictEqual(res.statusCode, 401, 'Unauthenticated request should return 401');

    const { req: pReq, res: pRes } = createMockHttp({ method: 'PUT', body: { name: 'Hacker' } });
    await personalInfoHandler(pReq, pRes);
    assert.strictEqual(pRes.statusCode, 401, 'Unauthenticated PUT should return 401');
    console.log('✅ Auth guard protected endpoints against unauthenticated requests.');
  }

  // ----------------------------------------------------
  // Test 4: Authenticated Session Check (/api/admin/me)
  // ----------------------------------------------------
  console.log('\n[Test 4] Testing GET /api/admin/me with auth cookie...');
  {
    const { req, res } = createMockHttp({
      method: 'GET',
      headers: { cookie: authCookie }
    });
    await meHandler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.authenticated, true);
    console.log('✅ Session confirmed valid via /api/admin/me.');
  }

  // ----------------------------------------------------
  // Test 5: Personal Info CRUD Update
  // ----------------------------------------------------
  console.log('\n[Test 5] Testing PUT /api/admin/personal-info...');
  {
    const { req, res } = createMockHttp({
      method: 'PUT',
      headers: { cookie: authCookie },
      body: {
        name: 'Ankeeth V',
        title: 'Senior Engineer & Lead Data Analyst',
        location: 'Bengaluru, Karnataka, India',
        email: 'ankeeth.v@gmail.com',
        bio: 'Updated bio testing admin capabilities.',
        linkedin_url: 'https://www.linkedin.com/in/ankeeth-v-',
        github_url: 'https://github.com/AnkeethV',
        resume_url: '/resume.pdf',
        photo_url: '/assets/placeholder-avatar.svg'
      }
    });
    await personalInfoHandler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.data.title, 'Senior Engineer & Lead Data Analyst');
    console.log('✅ Personal info successfully updated in DB.');
  }

  // ----------------------------------------------------
  // Test 6: Experience CRUD
  // ----------------------------------------------------
  console.log('\n[Test 6] Testing Experience CRUD lifecycle...');
  let createdExpId = null;
  {
    // Create
    const { req: cReq, res: cRes } = createMockHttp({
      method: 'POST',
      headers: { cookie: authCookie },
      body: {
        company: 'Innovative AI Labs',
        title: 'Lead AI Engineer',
        start_date: 'Jan 2026',
        end_date: 'Present',
        bullets: ['Deployed multi-agent systems with high throughput.']
      }
    });
    await experienceHandler(cReq, cRes);
    assert.strictEqual(cRes.statusCode, 201);
    createdExpId = cRes.body.data.id;
    assert.ok(createdExpId, 'Experience ID created');

    // Update
    const { req: uReq, res: uRes } = createMockHttp({
      method: 'PUT',
      headers: { cookie: authCookie },
      body: {
        id: createdExpId,
        title: 'Senior Staff AI Engineer'
      }
    });
    await experienceHandler(uReq, uRes);
    assert.strictEqual(uRes.statusCode, 200);
    assert.strictEqual(uRes.body.data.title, 'Senior Staff AI Engineer');

    // Delete
    const { req: dReq, res: dRes } = createMockHttp({
      method: 'DELETE',
      headers: { cookie: authCookie },
      query: { id: createdExpId }
    });
    await experienceHandler(dReq, dRes);
    assert.strictEqual(dRes.statusCode, 200);
    console.log('✅ Experience CRUD (Create, Update, Delete) passed.');
  }

  // ----------------------------------------------------
  // Test 7: Projects CRUD
  // ----------------------------------------------------
  console.log('\n[Test 7] Testing Projects CRUD lifecycle...');
  let createdProjId = null;
  {
    // Create
    const { req: cReq, res: cRes } = createMockHttp({
      method: 'POST',
      headers: { cookie: authCookie },
      body: {
        name: 'AI Agent Playground',
        description: 'Autonomous multi-agent orchestration framework',
        tech_tags: ['Node.js', 'Postgres', 'Groq'],
        external_link: 'https://github.com/AnkeethV/agent-playground'
      }
    });
    await projectsHandler(cReq, cRes);
    assert.strictEqual(cRes.statusCode, 201);
    createdProjId = cRes.body.data.id;

    // Delete
    const { req: dReq, res: dRes } = createMockHttp({
      method: 'DELETE',
      headers: { cookie: authCookie },
      query: { id: createdProjId }
    });
    await projectsHandler(dReq, dRes);
    assert.strictEqual(dRes.statusCode, 200);
    console.log('✅ Projects CRUD passed.');
  }

  // ----------------------------------------------------
  // Test 8: Skills & FAQ CRUD
  // ----------------------------------------------------
  console.log('\n[Test 8] Testing Skills and FAQ CRUD lifecycle...');
  {
    // Skill Create & Delete
    const { req: sReq, res: sRes } = createMockHttp({
      method: 'POST',
      headers: { cookie: authCookie },
      body: { category: 'technical', value: 'Vector Databases (pgvector)' }
    });
    await skillsHandler(sReq, sRes);
    assert.strictEqual(sRes.statusCode, 201);
    const skillId = sRes.body.data.id;

    const { req: sDelReq, res: sDelRes } = createMockHttp({
      method: 'DELETE',
      headers: { cookie: authCookie },
      query: { id: skillId }
    });
    await skillsHandler(sDelReq, sDelRes);
    assert.strictEqual(sDelRes.statusCode, 200);

    // FAQ Create & Delete
    const { req: fReq, res: fRes } = createMockHttp({
      method: 'POST',
      headers: { cookie: authCookie },
      body: { question: 'Do you work with Cloudinary?', answer: 'Yes, for image assets.' }
    });
    await faqHandler(fReq, fRes);
    assert.strictEqual(fRes.statusCode, 201);
    const faqId = fRes.body.data.id;

    const { req: fDelReq, res: fDelRes } = createMockHttp({
      method: 'DELETE',
      headers: { cookie: authCookie },
      query: { id: faqId }
    });
    await faqHandler(fDelReq, fDelRes);
    assert.strictEqual(fDelRes.statusCode, 200);

    console.log('✅ Skills and FAQ CRUD passed.');
  }

  // ----------------------------------------------------
  // Test 9: Public Content Live-Reflect Check
  // ----------------------------------------------------
  console.log('\n[Test 9] Confirming public GET /api/content reflects updated title...');
  {
    const { req, res } = createMockHttp({ method: 'GET' });
    await contentHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.data.personal_info.title, 'Senior Engineer & Lead Data Analyst');
    console.log('✅ Admin modification reflected immediately in public content endpoint without redeploy.');
  }

  // ----------------------------------------------------
  // Test 10: Logout
  // ----------------------------------------------------
  console.log('\n[Test 10] Testing POST /api/admin/logout...');
  {
    const { req, res } = createMockHttp({ method: 'POST' });
    await logoutHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    const clearedCookie = res.getHeader('set-cookie');
    assert.ok(clearedCookie.includes('Max-Age=0') || clearedCookie.includes('Expires='), 'Should clear cookie');
    console.log('✅ Logout successfully cleared session cookie.');
  }

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 3 TESTS PASSED SUCCESSFULLY!          ');
  console.log('====================================================');
}

runPhase3Tests()
  .catch(err => {
    console.error('❌ Phase 3 test failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await close();
  });
