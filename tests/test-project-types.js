import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const PORT = process.env.TEST_PORT || '3005';
const BASE_URL = process.env.TEST_BASE_URL || `http://localhost:${PORT}`;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function isServerRunning(url) {
  try {
    const res = await fetch(`${url}/admin`);
    return res.status === 200;
  } catch (_) {
    return false;
  }
}

async function runTests() {
  console.log('\n================================================================');
  console.log('🧪 Testing "Available for Opportunities" Removal & Project Types CRUD');
  console.log('================================================================\n');

  // Test 1: Verify "Available for Opportunities" is removed from public/index.html
  console.log('Test 1: Verifying "Available for Opportunities" is absent from public/index.html...');
  const indexPath = path.join(rootDir, 'public', 'index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf-8');
  assert.ok(
    !indexHtml.toLowerCase().includes('available for opportunities'),
    'public/index.html should not contain "Available for Opportunities"'
  );
  assert.ok(
    !indexHtml.toLowerCase().includes('available for oppertunities'),
    'public/index.html should not contain "Available for Oppertunities"'
  );
  console.log('  ✔ "Available for Opportunities" badge successfully removed from public/index.html.');

  // Test 2: Verify Admin Console HTML contains Project Types elements
  console.log('\nTest 2: Verifying Admin Console HTML contains Project Types management elements...');
  const adminHtmlPath = path.join(rootDir, 'public', 'admin', 'index.html');
  const adminHtml = fs.readFileSync(adminHtmlPath, 'utf-8');
  assert.match(adminHtml, /id="project-types-section"/, 'admin index.html must contain project-types-section');
  assert.match(adminHtml, /id="form-add-project-type"/, 'admin index.html must contain form-add-project-type');
  assert.match(adminHtml, /id="new-project-type-input"/, 'admin index.html must contain new-project-type-input');
  assert.match(adminHtml, /id="project-types-admin-list"/, 'admin index.html must contain project-types-admin-list');
  assert.match(adminHtml, /id="modal-project-type"/, 'admin index.html must contain modal-project-type');
  assert.match(adminHtml, /id="form-project-type"/, 'admin index.html must contain form-project-type');
  assert.match(adminHtml, /id="btn-quick-add-type"/, 'admin index.html must contain btn-quick-add-type');
  console.log('  ✔ Admin Console UI markup for Project Types verified.');

  // Test 2.5: Verify admin.js contains handlers
  console.log('\nTest 2.5: Verifying admin.js exports project types functions...');
  const adminJsPath = path.join(rootDir, 'public', 'admin', 'admin.js');
  const adminJs = fs.readFileSync(adminJsPath, 'utf-8');
  assert.match(adminJs, /loadProjectTypes/, 'admin.js must have loadProjectTypes');
  assert.match(adminJs, /renderProjectTypesList/, 'admin.js must have renderProjectTypesList');
  assert.match(adminJs, /handleAddProjectType/, 'admin.js must have handleAddProjectType');
  assert.match(adminJs, /openEditProjectType/, 'admin.js must have openEditProjectType');
  assert.match(adminJs, /handleSaveProjectType/, 'admin.js must have handleSaveProjectType');
  assert.match(adminJs, /deleteProjectType/, 'admin.js must have deleteProjectType');
  console.log('  ✔ admin.js Project Types functions verified.');

  // Ensure dev server is running on TEST_PORT
  let devServerProcess = null;
  const running = await isServerRunning(BASE_URL);
  if (!running) {
    console.log(`\nStarting temporary test dev server on port ${PORT}...`);
    devServerProcess = spawn('node', ['scripts/dev-server.js'], {
      cwd: rootDir,
      env: { ...process.env, PORT },
      stdio: 'pipe'
    });

    // Wait for server to start
    let ready = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 400));
      if (await isServerRunning(BASE_URL)) {
        ready = true;
        break;
      }
    }
    assert.ok(ready, 'Test server failed to start within 12 seconds');
    console.log('  ✔ Test dev server is up and responding.');
  }

  try {
    // Test 3: Authenticate as Admin
    console.log('\nTest 3: Authenticating with Admin API...');
    const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: ADMIN_PASSWORD })
    });
    assert.equal(loginRes.status, 200, 'Admin login should succeed');
    const cookieHeader = loginRes.headers.get('set-cookie');
    assert.ok(cookieHeader, 'Login must set auth cookie');
    const cookie = cookieHeader.split(';')[0];
    console.log('  ✔ Authenticated successfully.');

    // Test 4: GET /api/admin/project-types
    console.log('\nTest 4: Testing GET /api/admin/project-types...');
    const getRes = await fetch(`${BASE_URL}/api/admin/project-types`, {
      headers: { Cookie: cookie }
    });
    assert.equal(getRes.status, 200, 'GET project-types should return HTTP 200');
    const getJson = await getRes.json();
    assert.equal(getJson.success, true);
    assert.ok(Array.isArray(getJson.data), 'data must be an array');
    assert.ok(getJson.data.length > 0, 'Should have initial project types');
    console.log(`  ✔ Retrieved ${getJson.data.length} project types (${getJson.data.map(t => t.name).slice(0, 5).join(', ')}...)`);

    // Test 5: POST /api/admin/project-types (Add new project type)
    console.log('\nTest 5: Testing POST /api/admin/project-types (Add new project type)...');
    const testTypeName = `Automation & AI ${Date.now()}`;
    const addRes = await fetch(`${BASE_URL}/api/admin/project-types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie
      },
      body: JSON.stringify({ name: testTypeName })
    });
    assert.equal(addRes.status, 201, 'POST project-types should return HTTP 201');
    const addJson = await addRes.json();
    assert.equal(addJson.success, true);
    assert.ok(addJson.data.id, 'Created type must have an id');
    assert.equal(addJson.data.name, testTypeName);
    const createdId = addJson.data.id;
    console.log(`  ✔ Successfully added project type ID ${createdId} ("${testTypeName}")`);

    // Test 6: POST duplicate prevention
    console.log('\nTest 6: Testing duplicate name rejection...');
    const dupRes = await fetch(`${BASE_URL}/api/admin/project-types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie
      },
      body: JSON.stringify({ name: testTypeName })
    });
    assert.equal(dupRes.status, 400, 'Adding duplicate project type should return HTTP 400');
    console.log('  ✔ Duplicate project type correctly rejected with 400.');

    // Test 7: PUT /api/admin/project-types (Edit / rename project type)
    console.log('\nTest 7: Testing PUT /api/admin/project-types (Edit/Rename project type)...');
    const updatedTypeName = `${testTypeName} (Updated)`;
    const editRes = await fetch(`${BASE_URL}/api/admin/project-types`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie
      },
      body: JSON.stringify({ id: createdId, name: updatedTypeName })
    });
    assert.equal(editRes.status, 200, 'PUT project-types should return HTTP 200');
    const editJson = await editRes.json();
    assert.equal(editJson.success, true);
    assert.equal(editJson.data.name, updatedTypeName);
    console.log(`  ✔ Successfully renamed project type to "${updatedTypeName}"`);

    // Test 8: DELETE /api/admin/project-types (Delete project type)
    console.log('\nTest 8: Testing DELETE /api/admin/project-types...');
    const delRes = await fetch(`${BASE_URL}/api/admin/project-types?id=${createdId}`, {
      method: 'DELETE',
      headers: { Cookie: cookie }
    });
    assert.equal(delRes.status, 200, 'DELETE project-types should return HTTP 200');
    const delJson = await delRes.json();
    assert.equal(delJson.success, true);
    console.log(`  ✔ Successfully deleted project type ID ${createdId}`);

    // Test 9: Verify deletion in GET
    console.log('\nTest 9: Verifying deleted type is gone from GET list...');
    const verifyRes = await fetch(`${BASE_URL}/api/admin/project-types`, {
      headers: { Cookie: cookie }
    });
    const verifyJson = await verifyRes.json();
    const exists = verifyJson.data.some(t => String(t.id) === String(createdId) || t.name === updatedTypeName);
    assert.equal(exists, false, 'Deleted project type should no longer appear in GET list');
    console.log('  ✔ Confirmed project type is completely removed.');

    console.log('\n================================================================');
    console.log('🎉 ALL PROJECT TYPES & "AVAILABLE FOR OPPORTUNITIES" TESTS PASSED!');
    console.log('================================================================\n');
  } finally {
    if (devServerProcess) {
      devServerProcess.kill();
    }
  }
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
