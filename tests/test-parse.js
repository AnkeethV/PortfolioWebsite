import path from 'path';
import { fileURLToPath } from 'url';
import { parseProfile } from '../api/_lib/parseProfile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const profilePath = path.resolve(__dirname, '../profile.md');
console.log('Testing parseProfile against:', profilePath);

const data = parseProfile(profilePath);

console.log('\n--- Personal Info ---');
console.log(data.personalInfo);

console.log(`\n--- Experience (${data.experience.length} entries) ---`);
data.experience.forEach((e, idx) => {
  console.log(`[${idx + 1}] ${e.company} | ${e.title} | ${e.start_date} -> ${e.end_date} (${e.bullets.length} bullets)`);
});

console.log(`\n--- Projects (${data.projects.length} entries) ---`);
data.projects.forEach((p, idx) => {
  console.log(`[${idx + 1}] ${p.name} | Tags: [${p.tech_tags.join(', ')}] | Link: ${p.external_link || 'N/A'}`);
});

console.log(`\n--- Skills (${data.skills.length} total) ---`);
const byCategory = {};
data.skills.forEach(s => {
  byCategory[s.category] = (byCategory[s.category] || 0) + 1;
});
console.log('Skills by category:', byCategory);

console.log(`\n--- FAQ (${data.faq.length} entries) ---`);
data.faq.forEach((f, idx) => {
  console.log(`[${idx + 1}] Q: ${f.question}`);
  console.log(`    A: ${f.answer.slice(0, 70)}...`);
});

// Basic assertion check
if (
  data.personalInfo.name &&
  data.experience.length >= 4 &&
  data.projects.length >= 4 &&
  data.skills.length >= 20 &&
  data.faq.length >= 6
) {
  console.log('\n>>> SUCCESS: Profile parsed accurately with all required sections! <<<');
} else {
  console.error('\n>>> ERROR: Parsing did not extract expected counts! <<<');
  process.exit(1);
}
