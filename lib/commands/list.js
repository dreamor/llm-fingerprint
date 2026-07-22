import { inferFamily } from '../db.js';

export function run({ db, flags }) {
  const familyFilter = flags.family;
  const models = db.listModels();
  if (familyFilter) {
    const filtered = models.filter((m) => inferFamily(m) === familyFilter);
    console.log(`\n${familyFilter} (${filtered.length} models):`);
    for (const m of filtered) console.log(`  ${m}`);
    return;
  }
  const families = db.listFamilies();
  console.log(`\nReference library: ${db.n} models`);
  for (const f of families) {
    const members = db.getFamily(f);
    console.log(`  ${f}: ${members.length} models`);
  }
  console.log(`\nUsage: fp list --family <name> to see individual models`);
}
