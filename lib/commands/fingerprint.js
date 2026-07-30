import { readFileSync, existsSync } from 'node:fs';
import { match } from '../match.js';
import { buildDistribution } from '../tasks.js';
import { parseCSV } from '../csv.js';
import { warn, printVerdict } from '../cli-output.js';

export function run({ db, positional, flags }) {
  const csvPath = positional[0];
  if (!csvPath) {
    warn('usage: fp fingerprint <answers.csv> [--model <label>] [--save]');
    process.exit(1);
  }
  if (!existsSync(csvPath)) {
    warn(`file not found: ${csvPath}`);
    process.exit(1);
  }
  const modelLabel = flags.model || 'manual-input';
  const save = Boolean(flags.save);

  const rows = parseCSV(readFileSync(csvPath, 'utf-8'));
  if (rows.length < 2) {
    warn('CSV must have a header row and at least one data row');
    process.exit(1);
  }

  const header = rows[0].map((s) => s.trim().toLowerCase());
  const taskIdx = header.indexOf('task_id');
  const langIdx = header.indexOf('lang');
  const ansIdx = header.indexOf('answer');
  if (taskIdx === -1 || langIdx === -1 || ansIdx === -1) {
    warn('CSV header must contain: task_id, lang, answer');
    process.exit(1);
  }

  // Group by (task_id, lang)
  const groups = new Map();
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    const taskId = cols[taskIdx]?.trim();
    const lang = cols[langIdx]?.trim();
    const answer = cols[ansIdx]; // keep raw — normalize() handles trim/quotes
    if (!taskId || !lang || answer === undefined || answer === null) continue;
    const key = `${taskId}|${lang}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(answer);
  }

  if (groups.size === 0) {
    warn('no valid rows found in CSV');
    process.exit(1);
  }

  const cells = [];
  const records = [];
  for (const [cellKey, rawAnswers] of groups) {
    const [task_id, lang] = cellKey.split('|');
    const result = buildDistribution(rawAnswers);
    if (!result) continue;
    const { dist, nValid, nOffFormat, validityRate } = result;
    const entropy = Object.values(dist).reduce((s, p) => s - (p > 0 ? p * Math.log2(p) : 0), 0);
    const mode = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
    cells.push({
      task_id,
      lang,
      temperature: 1,
      n_valid: nValid,
      n_off_format: nOffFormat,
      validity_rate: validityRate,
      dist,
      entropy_bits: Math.round(entropy * 1000) / 1000,
      mode: mode?.[0] || null,
      mode_share: mode?.[1] || 0
    });
    records.push({
      model: modelLabel,
      task_id,
      lang,
      temperature: 1,
      n_valid: nValid,
      n_off_format: nOffFormat,
      validity_rate: validityRate,
      dist
    });
  }

  const probeResult = {
    model: modelLabel,
    provider: 'manual',
    api_type: 'manual',
    temperature: 1,
    reps: 'manual',
    cells
  };
  console.log(`\nFingerprint from manual answers:`);
  console.log(`  ${groups.size} cell groups`);
  console.log(`  ${cells.length} cells with ≥2 valid answers each\n`);

  const m = match(db, probeResult);
  printVerdict(m);

  if (save) {
    db._ingest(records);
    db.save(records);
    warn(`saved ${records.length} cells for ${modelLabel} to reference library`);
  }
}
