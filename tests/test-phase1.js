import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Isolate test database from development server database
process.env.PG_DATA_DIR = path.resolve(__dirname, '../.data/pglite_test');

const { parseProfile } = await import('../api/_lib/parseProfile.js');
const { query, close, isUsingFallback } = await import('../api/_lib/db.js');
const { seedDatabase, isSeeded } = await import('../api/_lib/seed.js');

async function runTests() {
  console.log('====================================================');
  console.log('          RUNNING PHASE 1 VERIFICATION TESTS        ');
  console.log('====================================================');

  console.log(`DB Mode: ${isUsingFallback() ? 'PGlite WASM Local Fallback' : 'Configured Postgres Pool'}`);

  // Test 1: Parser Verification
  console.log('\n[Test 1] Validating profile.md Parser...');
  const profilePath = path.resolve(__dirname, '../profile.md');
  const parsed = parseProfile(profilePath);

  assert.strictEqual(parsed.personalInfo.name, 'Ankeeth V', 'Name should be Ankeeth V');
  assert.strictEqual(parsed.experience.length, 4, 'Should parse 4 experience items');
  assert.strictEqual(parsed.projects.length, 4, 'Should parse 4 project items');
  assert.strictEqual(parsed.skills.length, 26, 'Should parse 26 skill items');
  assert.strictEqual(parsed.faq.length, 6, 'Should parse 6 FAQ items');
  console.log('✅ Parser test passed with 100% field integrity.');

  // Test 2: Database Seeding
  console.log('\n[Test 2] Testing Database Seeding (force = true)...');
  const seedResult = await seedDatabase(true);
  assert.strictEqual(seedResult.seeded, true, 'Seeding should succeed');
  assert.strictEqual(seedResult.counts.personalInfo, 1);
  assert.strictEqual(seedResult.counts.experience, 4);
  assert.strictEqual(seedResult.counts.projects, 4);
  assert.strictEqual(seedResult.counts.skills, 26);
  assert.strictEqual(seedResult.counts.faq, 6);
  console.log('✅ Seeding executed cleanly with correct counts.');

  // Test 3: Table Record Verification
  console.log('\n[Test 3] Verifying Records in Database Tables...');
  const pRes = await query('SELECT * FROM personal_info');
  assert.strictEqual(pRes.rows.length, 1);
  assert.strictEqual(pRes.rows[0].name, 'Ankeeth V');
  assert.strictEqual(pRes.rows[0].email, 'ankeeth.v@gmail.com');
  console.log('  • personal_info verified:', pRes.rows[0].name, '-', pRes.rows[0].title);

  const eRes = await query('SELECT * FROM experience ORDER BY sort_order ASC');
  assert.strictEqual(eRes.rows.length, 4);
  // Parse bullets if stored as string/JSON
  const kaseyaBullets = typeof eRes.rows[0].bullets === 'string' ? JSON.parse(eRes.rows[0].bullets) : eRes.rows[0].bullets;
  assert.strictEqual(kaseyaBullets.length, 3);
  console.log('  • experience verified: 4 records, Kaseya bullets count =', kaseyaBullets.length);

  const projRes = await query('SELECT * FROM projects ORDER BY sort_order ASC');
  assert.strictEqual(projRes.rows.length, 4);
  console.log('  • projects verified: 4 records (', projRes.rows.map(r => r.name).join(', '), ')');

  const sRes = await query('SELECT category, count(*) FROM skills GROUP BY category ORDER BY category');
  console.log('  • skills categories verified:', sRes.rows);
  assert.strictEqual(sRes.rows.length, 3, 'Should have technical, tools, soft categories');

  const fRes = await query('SELECT question, answer FROM faq WHERE question ILIKE $1', ['%notice period%']);
  assert.strictEqual(fRes.rows.length, 1);
  assert.strictEqual(fRes.rows[0].answer, '60 Days');
  console.log('  • faq verified: notice period =', fRes.rows[0].answer);

  // Test 4: Idempotency (Must NOT duplicate or overwrite on re-run)
  console.log('\n[Test 4] Testing Seeding Idempotency (force = false)...');
  const secondRun = await seedDatabase(false);
  assert.strictEqual(secondRun.seeded, false, 'Second run should skip seeding');
  assert.ok(secondRun.reason.includes('Already seeded') || secondRun.reason.includes('already seeded'));

  // Confirm row counts are identical
  const countAfter = await query('SELECT COUNT(*) as count FROM experience');
  assert.strictEqual(parseInt(countAfter.rows[0].count, 10), 4, 'Experience count should still be exactly 4');
  console.log('✅ Idempotency test passed: Existing data preserved without duplicates.');

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 1 TESTS PASSED SUCCESSFULLY!          ');
  console.log('====================================================');
}

runTests()
  .catch(err => {
    console.error('❌ Test failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await close();
  });
