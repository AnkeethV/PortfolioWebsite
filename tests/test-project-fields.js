import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function run() {
  console.log('\n======================================================');
  console.log('🧪 Testing Project Full Fields (18 Fields & Visibility)');
  console.log('======================================================\n');

  // 1. Authenticate
  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD })
  });
  assert.equal(loginRes.status, 200, 'Login should succeed');
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];
  console.log('  ✔ Authenticated successfully.');

  // 2. Create project with all new fields
  console.log('Step 2: Creating project with all 18 fields...');
  const newProjPayload = {
    project_type: 'Excel',
    domain: 'FMCG/Sales & Finance',
    other_tools: 'Excel, Power Query, DAX',
    name: 'Sales and Finance Analytics Test',
    short_info: 'Developed insights with comprehensive customer and market performance reports. Analyze market performance against sales targets.',
    description: 'In this project, created sales report for AtliQ Hardware using pivot tables to provide insights on customer performance.',
    thumbnail_url: '/uploads/thumbnails/test-thumb.png',
    screenshot1_url: '/uploads/screenshots/test-screen-1.png',
    screenshot1_desc: 'Customer Performance Report: Net Sales Performance for the Customers',
    screenshot2_url: '/uploads/screenshots/test-screen-2.png',
    screenshot2_desc: 'Market Performance V/S Target',
    video_url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
    powerbi_url: 'https://app.powerbi.com/view?r=testreport123',
    tech_tags: ['Excel', 'DAX', 'Pivot Tables'],
    linkedin_url: 'https://www.linkedin.com/feed/update/urn:li:activity:7167564304236396544/',
    github_url: 'https://github.com/AnkeethV/Excel-Sales-Finance-Analytics',
    platform_name: 'Power BI Service',
    external_link: 'https://github.com/AnkeethV/Excel-Sales-Finance-Analytics',
    is_visible: true
  };

  const createRes = await fetch(`${BASE_URL}/api/admin/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify(newProjPayload)
  });
  assert.equal(createRes.status, 201, 'Create project should return 201');
  const createdJson = await createRes.json();
  assert.equal(createdJson.success, true);
  const createdProj = createdJson.data;
  assert.ok(createdProj.id, 'Created project must have an id');
  assert.equal(createdProj.project_type, 'Excel');
  assert.equal(createdProj.domain, 'FMCG/Sales & Finance');
  assert.equal(createdProj.other_tools, 'Excel, Power Query, DAX');
  assert.equal(createdProj.short_info, newProjPayload.short_info);
  assert.equal(createdProj.screenshot1_url, newProjPayload.screenshot1_url);
  assert.equal(createdProj.screenshot1_desc, newProjPayload.screenshot1_desc);
  assert.equal(createdProj.screenshot2_url, newProjPayload.screenshot2_url);
  assert.equal(createdProj.screenshot2_desc, newProjPayload.screenshot2_desc);
  assert.equal(createdProj.powerbi_url, newProjPayload.powerbi_url);
  assert.equal(createdProj.linkedin_url, newProjPayload.linkedin_url);
  assert.equal(createdProj.github_url, newProjPayload.github_url);
  assert.equal(createdProj.platform_name, newProjPayload.platform_name);
  assert.equal(createdProj.is_visible, true);
  console.log(`  ✔ Project created successfully (ID: ${createdProj.id}).`);

  // 3. Update project fields & toggle visibility
  console.log('Step 3: Updating project fields & toggling visibility...');
  const updateRes = await fetch(`${BASE_URL}/api/admin/projects`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      id: createdProj.id,
      domain: 'Retail & E-commerce',
      is_visible: false
    })
  });
  assert.equal(updateRes.status, 200, 'Update should return 200');
  const updateJson = await updateRes.json();
  assert.equal(updateJson.data.domain, 'Retail & E-commerce');
  assert.equal(updateJson.data.is_visible, false);
  console.log('  ✔ Project updated and visibility toggled to false.');

  // 4. Verify public content endpoint does not show hidden project
  console.log('Step 4: Verifying public content hides hidden project...');
  const publicRes = await fetch(`${BASE_URL}/api/content`);
  assert.equal(publicRes.status, 200);
  const publicData = await publicRes.json();
  const hiddenInPublic = publicData.data.projects.find(p => p.id === createdProj.id);
  assert.equal(hiddenInPublic, undefined, 'Hidden project must NOT be returned in public content');
  console.log('  ✔ Public API properly excluded hidden project.');

  // 5. Toggle visibility back to true
  console.log('Step 5: Toggling visibility back to true...');
  await fetch(`${BASE_URL}/api/admin/projects`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({
      id: createdProj.id,
      is_visible: true
    })
  });

  const publicRes2 = await fetch(`${BASE_URL}/api/content`);
  const publicData2 = await publicRes2.json();
  const visibleInPublic = publicData2.data.projects.find(p => p.id === createdProj.id);
  assert.ok(visibleInPublic, 'Visible project must appear in public content');
  assert.equal(visibleInPublic.screenshot1_url, newProjPayload.screenshot1_url);
  assert.equal(visibleInPublic.domain, 'Retail & E-commerce');
  console.log('  ✔ Public API returns all project fields when visible.');

  // 6. Clean up: delete test project
  console.log('Step 6: Cleaning up test project...');
  const delRes = await fetch(`${BASE_URL}/api/admin/projects?id=${createdProj.id}`, {
    method: 'DELETE',
    headers: { 'Cookie': cookie }
  });
  assert.equal(delRes.status, 200, 'Delete should return 200');
  console.log('  ✔ Test project deleted cleanly.');

  console.log('\n======================================================');
  console.log('🎉 ALL PROJECT FIELDS & VISIBILITY TESTS PASSED!');
  console.log('======================================================\n');
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
