/**
 * Quick functional self-test: verify the reference library loads and
 * a known model (gpt-4o) matches itself at the top of the candidate list.
 */
import { readFileSync } from 'fs';
import { FingerprintDB } from '../lib/db.js';
import { match } from '../lib/match.js';

const ref = JSON.parse(readFileSync('data/reference.json'));
const cells = ref.distributions.filter((r) => r.model === 'openai/gpt-4o' && r.temperature === 1);
const probeResult = {
  model: 'selftest',
  provider: 'test',
  temperature: 1,
  reps: 30,
  cells: cells.slice(0, 10)
};
const db = new FingerprintDB();
db.load();
const r = match(db, probeResult);

if (r.candidates[0].model !== 'openai/gpt-4o') {
  console.error(`[self-test] FAIL — expected openai/gpt-4o, got ${r.candidates[0].model}`);
  process.exit(1);
}

console.log(`[self-test] OK — top match: ${r.candidates[0].model} (JSD=${r.candidates[0].jsd})`);
