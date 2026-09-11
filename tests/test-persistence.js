import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function run() {
  console.log('\n======================================================');
  console.log('🧪 Testing Data Persistence (Photo, Resume, Password)');
  console.log('======================================================\n');

  // Step 1: Login
  console.log('Step 1: Logging in...');
  let loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin123' })
  });

  let currentPass = 'admin123';
  if (loginRes.status === 401) {
    // Check if a previous test set it to 'persistentPass2026!'
    loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'persistentPass2026!' })
    });
    if (loginRes.status === 200) {
      currentPass = 'persistentPass2026!';
    }
  }

  assert.equal(loginRes.status, 200, 'Login must succeed');
  let authCookie = loginRes.headers.get('set-cookie').split(';')[0];
  console.log('  ✔ Authenticated successfully.');

  // Step 2: Set custom photo and resume
  console.log('\nStep 2: Saving custom photo and resume URL...');
  const customPhoto = '/uploads/photos/my_custom_avatar_test.png';
  const customResume = '/uploads/resumes/my_custom_resume_test.pdf';

  const putRes = await fetch(`${BASE_URL}/api/admin/personal-info`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
    body: JSON.stringify({
      photo_url: customPhoto,
      resume_url: customResume
    })
  });
  assert.equal(putRes.status, 200);
  const putData = await putRes.json();
  assert.equal(putData.data.photo_url, customPhoto);
  assert.equal(putData.data.resume_url, customResume);
  console.log('  ✔ Custom photo and resume saved.');

  // Step 3: Perform partial update WITHOUT photo or resume
  console.log('\nStep 3: Performing partial update without photo/resume fields...');
  const partialRes = await fetch(`${BASE_URL}/api/admin/personal-info`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
    body: JSON.stringify({
      title: 'Principal Analytics Architect'
    })
  });
  assert.equal(partialRes.status, 200);
  const partialData = await partialRes.json();
  assert.equal(partialData.data.photo_url, customPhoto, 'photo_url must NOT revert to placeholder on partial update');
  assert.equal(partialData.data.resume_url, customResume, 'resume_url must NOT revert to default on partial update');
  console.log('  ✔ Verified: Custom photo and resume preserved during partial update.');

  // Step 4: Verify public /api/content reflects the custom photo and resume
  console.log('\nStep 4: Checking public content API...');
  const contentRes = await fetch(`${BASE_URL}/api/content`);
  assert.equal(contentRes.status, 200);
  const contentData = await contentRes.json();
  assert.equal(contentData.data.personal_info.photo_url, customPhoto);
  assert.equal(contentData.data.personal_info.resume_url, customResume);
  console.log('  ✔ Public API served custom photo and resume.');

  // Step 5: Test Master Password Reset & Persistence
  console.log('\nStep 5: Testing Master Password change and persistence...');
  const newPass = 'myPermanentKey2026!';
  const resetRes = await fetch(`${BASE_URL}/api/admin/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
    body: JSON.stringify({
      currentPassword: currentPass,
      newPassword: newPass,
      confirmPassword: newPass
    })
  });
  assert.equal(resetRes.status, 200, 'Password reset should succeed');
  console.log('  ✔ Master password reset succeeded.');

  // Verify old password fails
  const oldLogin = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: currentPass })
  });
  assert.equal(oldLogin.status, 401, 'Old password must fail');

  // Verify new password succeeds
  const newLogin = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: newPass })
  });
  assert.equal(newLogin.status, 200, 'New password must authenticate');
  authCookie = newLogin.headers.get('set-cookie').split(';')[0];
  console.log('  ✔ New password verified.');

  // Verify settings file exists on disk
  const settingsFile = path.resolve(rootDir, '.data', 'admin_settings.json');
  assert.ok(fs.existsSync(settingsFile), '.data/admin_settings.json must exist');
  console.log('  ✔ Verified .data/admin_settings.json persisted to disk.');

  // Clean up: Reset password back to admin123
  await fetch(`${BASE_URL}/api/admin/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
    body: JSON.stringify({
      currentPassword: newPass,
      newPassword: 'admin123',
      confirmPassword: 'admin123'
    })
  });
  console.log('  ✔ Master password reset back to admin123 for test environment.');

  console.log('\n======================================================');
  console.log('🎉 ALL DATA PERSISTENCE TESTS PASSED!');
  console.log('======================================================\n');
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
