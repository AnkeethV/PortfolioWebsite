/**
 * TASK-9.1: Database Auto-seeding & Live-Sync Verification Script
 * ============================================================= */

import assert from 'node:assert/strict';
import { query } from '../api/_lib/db.js';
import { seedDatabase, isSeeded } from '../api/_lib/seed.js';

export async function verifySeedAndPersistence() {
  console.log('--- Verifying Auto-Seeding & Persistence ---');

  // 1. Check seeded state
  const seeded = await isSeeded();
  assert.equal(seeded, true, 'Database must already be seeded');
  console.log('  ✔ Database is currently seeded.');

  // 2. Test second boot idempotency
  const secondBoot = await seedDatabase(false);
  assert.equal(secondBoot.seeded, false, 'Second boot should not reseed database');
  assert.match(secondBoot.reason, /already seeded/i, 'Reason should state already seeded');
  console.log('  ✔ Second boot idempotency confirmed: live records preserved.');

  // 3. Test persistence across simulated admin edit
  const original = await query('SELECT bio FROM personal_info LIMIT 1');
  const originalBio = original.rows[0].bio;
  const testBio = `Custom admin updated bio at ${Date.now()}`;

  await query('UPDATE personal_info SET bio = $1, updated_at = NOW()', [testBio]);

  // Attempt to re-seed with force=false
  await seedDatabase(false);

  const check = await query('SELECT bio FROM personal_info LIMIT 1');
  assert.equal(check.rows[0].bio, testBio, 'Live edit must persist and not be overwritten by seedDatabase');
  console.log('  ✔ Live edit persisted across subsequent cold-boot checks.');

  // Restore original
  await query('UPDATE personal_info SET bio = $1, updated_at = NOW()', [originalBio]);
  console.log('  ✔ Original bio restored cleanly.');

  return true;
}

if (process.argv[1] && process.argv[1].includes('verify-seed.js')) {
  verifySeedAndPersistence().then(() => {
    console.log('🎉 Seed & persistence verification completed successfully.');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  });
}
