import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function run() {
  console.log('\n======================================================');
  console.log('🧪 Testing Admin Master Password Reset & Media Uploads');
  console.log('======================================================\n');

  // 1. Initial Login
  console.log('Step 1: Logging in with initial master password...');
  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: DEFAULT_PASSWORD })
  });
  assert.equal(loginRes.status, 200, 'Initial login should succeed');
  const cookieHeader = loginRes.headers.get('set-cookie');
  assert.ok(cookieHeader, 'Login should set auth cookie');
  const authCookie = cookieHeader.split(';')[0];
  console.log('  ✔ Authenticated successfully.');

  // 2. Master Password Reset Validation
  console.log('\nStep 2: Testing Reset Master Password API validation...');

  // 2a. Unauthorized
  const unauthReset = await fetch(`${BASE_URL}/api/admin/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword: DEFAULT_PASSWORD, newPassword: 'newpassword123', confirmPassword: 'newpassword123' })
  });
  assert.equal(unauthReset.status, 401, 'Unauthorized request must return 401');

  // 2b. Wrong current password
  const wrongCurrent = await fetch(`${BASE_URL}/api/admin/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
    body: JSON.stringify({ currentPassword: 'completely-wrong-password', newPassword: 'newpassword123', confirmPassword: 'newpassword123' })
  });
  assert.equal(wrongCurrent.status, 400, 'Wrong current password must return 400');
  const wrongCurrentData = await wrongCurrent.json();
  assert.match(wrongCurrentData.error, /Current master password is incorrect/i);

  // 2c. Mismatched confirmation
  const mismatch = await fetch(`${BASE_URL}/api/admin/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
    body: JSON.stringify({ currentPassword: DEFAULT_PASSWORD, newPassword: 'newpassword123', confirmPassword: 'different123' })
  });
  assert.equal(mismatch.status, 400, 'Mismatched passwords must return 400');

  // 2d. Password too short
  const tooShort = await fetch(`${BASE_URL}/api/admin/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
    body: JSON.stringify({ currentPassword: DEFAULT_PASSWORD, newPassword: '123', confirmPassword: '123' })
  });
  assert.equal(tooShort.status, 400, 'Short password must return 400');

  // 2e. Valid Reset to new password
  const NEW_PASSWORD = 'updatedMasterKey2026!';
  const validReset = await fetch(`${BASE_URL}/api/admin/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
    body: JSON.stringify({ currentPassword: DEFAULT_PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD })
  });
  assert.equal(validReset.status, 200, 'Valid reset must return 200');
  const validResetData = await validReset.json();
  assert.equal(validResetData.success, true);
  console.log('  ✔ Password reset API successfully updated the master password.');

  // 2f. Verify old password fails to log in
  const oldLoginFail = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: DEFAULT_PASSWORD })
  });
  assert.equal(oldLoginFail.status, 401, 'Old master password must now fail to log in');

  // 2g. Verify new password succeeds
  const newLoginSuccess = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: NEW_PASSWORD })
  });
  assert.equal(newLoginSuccess.status, 200, 'New master password must successfully log in');
  const newCookieHeader = newLoginSuccess.headers.get('set-cookie');
  const newAuthCookie = newCookieHeader.split(';')[0];
  console.log('  ✔ Verified: Old password rejected, new password authenticated.');

  // 2h. Reset back to original DEFAULT_PASSWORD so dev environment and test-phase8 remain consistent
  const resetBack = await fetch(`${BASE_URL}/api/admin/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': newAuthCookie },
    body: JSON.stringify({ currentPassword: NEW_PASSWORD, newPassword: DEFAULT_PASSWORD, confirmPassword: DEFAULT_PASSWORD })
  });
  assert.equal(resetBack.status, 200, 'Reset back to default must succeed');
  console.log('  ✔ Master password reset cycle complete.');

  // 3. Media Upload API Validation
  console.log('\nStep 3: Testing Media File Upload API...');

  // 1x1 transparent PNG base64
  const samplePngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  // Small dummy MP4 video bytes
  const dummyMp4Buffer = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00]);
  const dummyMp4Base64 = `data:video/mp4;base64,${dummyMp4Buffer.toString('base64')}`;

  // 3a. Unauthorized upload
  const unauthUpload = await fetch(`${BASE_URL}/api/admin/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: 'test.png',
      fileType: 'image/png',
      base64Data: samplePngBase64,
      category: 'photo'
    })
  });
  assert.equal(unauthUpload.status, 401, 'Unauthorized upload must return 401');

  // 3b. Invalid file extension for photo (e.g. .exe or .txt)
  const invalidExtUpload = await fetch(`${BASE_URL}/api/admin/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
    body: JSON.stringify({
      filename: 'malicious.exe',
      fileType: 'application/octet-stream',
      base64Data: samplePngBase64,
      category: 'photo'
    })
  });
  assert.equal(invalidExtUpload.status, 400, 'Invalid extension must return 400');
  console.log('  ✔ File extension & auth security checks verified.');

  // 3c. Upload Photo (PNG)
  const photoUpload = await fetch(`${BASE_URL}/api/admin/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
    body: JSON.stringify({
      filename: 'my-avatar.png',
      fileType: 'image/png',
      base64Data: samplePngBase64,
      category: 'photo'
    })
  });
  assert.equal(photoUpload.status, 200, 'Photo upload should return 200');
  const photoData = await photoUpload.json();
  assert.equal(photoData.success, true);
  assert.ok(photoData.url.startsWith('/uploads/photos/'));
  assert.ok(fs.existsSync(path.join(rootDir, 'public', photoData.url.replace(/^\//, ''))), 'Uploaded photo file must exist on disk');
  console.log(`  ✔ Photo uploaded to: ${photoData.url}`);

  // 3d. Upload Resume (PDF only check)
  // Rejection of non-PDF
  const nonPdfResume = await fetch(`${BASE_URL}/api/admin/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
    body: JSON.stringify({
      filename: 'my-resume.jpg',
      fileType: 'image/jpeg',
      base64Data: samplePngBase64,
      category: 'resume'
    })
  });
  assert.equal(nonPdfResume.status, 400, 'Non-PDF resume upload must be rejected with 400');
  console.log('  ✔ Non-PDF resume upload rejected as expected.');

  // Valid PDF upload
  const dummyPdfBuffer = Buffer.from('%PDF-1.4\n%EOF');
  const dummyPdfBase64 = `data:application/pdf;base64,${dummyPdfBuffer.toString('base64')}`;
  const resumeUpload = await fetch(`${BASE_URL}/api/admin/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
    body: JSON.stringify({
      filename: 'Ankeeth-Resume.pdf',
      fileType: 'application/pdf',
      base64Data: dummyPdfBase64,
      category: 'resume'
    })
  });
  assert.equal(resumeUpload.status, 200, 'PDF resume upload should return 200');
  const resumeData = await resumeUpload.json();
  assert.equal(resumeData.success, true);
  assert.ok(resumeData.url.startsWith('/uploads/resumes/'));
  assert.ok(resumeData.url.endsWith('.pdf'));
  assert.ok(fs.existsSync(path.join(rootDir, 'public', resumeData.url.replace(/^\//, ''))), 'Uploaded resume PDF must exist on disk');
  console.log(`  ✔ Resume PDF uploaded to: ${resumeData.url}`);

  // 3e. Upload Project Thumbnail (WebP or PNG)
  const thumbUpload = await fetch(`${BASE_URL}/api/admin/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
    body: JSON.stringify({
      filename: 'project-dashboard-thumb.png',
      fileType: 'image/png',
      base64Data: samplePngBase64,
      category: 'thumbnail'
    })
  });
  assert.equal(thumbUpload.status, 200, 'Thumbnail upload should return 200');
  const thumbData = await thumbUpload.json();
  assert.equal(thumbData.success, true);
  assert.ok(thumbData.url.startsWith('/uploads/thumbnails/'));
  assert.ok(fs.existsSync(path.join(rootDir, 'public', thumbData.url.replace(/^\//, ''))), 'Uploaded thumbnail file must exist on disk');
  console.log(`  ✔ Project thumbnail uploaded to: ${thumbData.url}`);

  // 3f. Upload Project Video Demo (MP4)
  const videoUpload = await fetch(`${BASE_URL}/api/admin/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
    body: JSON.stringify({
      filename: 'project-walkthrough.mp4',
      fileType: 'video/mp4',
      base64Data: dummyMp4Base64,
      category: 'video'
    })
  });
  assert.equal(videoUpload.status, 200, 'Video upload should return 200');
  const videoData = await videoUpload.json();
  assert.equal(videoData.success, true);
  assert.ok(videoData.url.startsWith('/uploads/videos/'));
  assert.ok(fs.existsSync(path.join(rootDir, 'public', videoData.url.replace(/^\//, ''))), 'Uploaded video file must exist on disk');
  console.log(`  ✔ Project video uploaded to: ${videoData.url}`);

  // 3g. Verify static retrieval of uploaded video via HTTP with proper MIME type
  const videoGetRes = await fetch(`${BASE_URL}${videoData.url}`);
  assert.equal(videoGetRes.status, 200, 'Dev server should statically serve uploaded video');
  assert.equal(videoGetRes.headers.get('content-type'), 'video/mp4', 'MIME type must be video/mp4');
  console.log('  ✔ Static video streaming & MIME type delivery verified.');

  console.log('\n======================================================');
  console.log('🎉 ALL MASTER PASSWORD & MEDIA UPLOAD TESTS PASSED!');
  console.log('======================================================\n');
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
