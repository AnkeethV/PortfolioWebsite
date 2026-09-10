import { seedDatabase, initSchema } from '../api/_lib/seed.js';
import { isUsingFallback, close, query } from '../api/_lib/db.js';

async function main() {
  console.log('====================================================');
  console.log('      ANKEETH V PORTFOLIO — DATABASE SEEDER         ');
  console.log('====================================================');

  const fallback = isUsingFallback();
  if (fallback) {
    console.log('ℹ️  No DATABASE_URL found. Using embedded PGlite WASM Postgres.');
  } else {
    console.log('✅ Connected to configured Postgres database (DATABASE_URL).');
  }

  const force = process.argv.includes('--force');
  if (force) {
    console.log('⚠️  --force flag supplied: Truncating existing tables and re-seeding...');
  }

  try {
    const result = await seedDatabase(force);

    if (result.seeded) {
      console.log('\n✨ Database seeding completed successfully!');
      console.log('----------------------------------------------------');
      console.log(`• Personal Info : ${result.counts.personalInfo} record`);
      console.log(`• Experiences   : ${result.counts.experience} records`);
      console.log(`• Projects      : ${result.counts.projects} records`);
      console.log(`• Skills        : ${result.counts.skills} records`);
      console.log(`• FAQ Items     : ${result.counts.faq} records`);
      console.log('----------------------------------------------------');
    } else {
      console.log(`\nℹ️  ${result.reason}`);
    }

    // Print quick verification preview
    const p = await query('SELECT name, title, email, location FROM personal_info LIMIT 1');
    if (p.rows.length > 0) {
      console.log('\nCurrent Profile in DB:');
      console.log(`  Name:     ${p.rows[0].name}`);
      console.log(`  Title:    ${p.rows[0].title}`);
      console.log(`  Location: ${p.rows[0].location}`);
      console.log(`  Email:    ${p.rows[0].email}`);
    }

  } catch (err) {
    console.error('\n❌ Seeding failed with error:', err);
    process.exitCode = 1;
  } finally {
    await close();
    console.log('\nDone.');
  }
}

main();
