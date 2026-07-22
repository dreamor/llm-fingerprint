import { readFileSync, existsSync } from 'node:fs';
import { warn } from '../cli-output.js';
import { validateDistributions } from '../schema.js';

export function run({ db, positional, flags }) {
  const path = positional[0];
  const model = flags.model;
  if (!path || !model) {
    warn('usage: fp import <responses.jsonl> --model <name>');
    process.exit(1);
  }
  if (!existsSync(path)) {
    warn(`file not found: ${path}`);
    process.exit(1);
  }

  // Group raw responses by (task, lang, temperature) and build distributions
  const lines = readFileSync(path, 'utf-8').trim().split('\n').filter(Boolean);
  const groups = new Map();

  for (const line of lines) {
    let r;
    try {
      r = JSON.parse(line);
    } catch {
      continue;
    }
    if (r.finish_reason !== 'stop') continue;
    if (r.model !== model && r.model !== undefined) continue;
    const key = `${r.task_id}|${r.lang}|t=${r.temperature}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r.raw);
  }

  const records = [];
  for (const [cellKey, rawAnswers] of groups) {
    const [task_id, lang, tempStr] = cellKey.split('|');
    const temperature = parseInt(tempStr.replace('t=', ''), 10);
    const normalized = rawAnswers
      .map((r) => {
        if (r === null || r === undefined || r === '') return null;
        const t = String(r)
          .trim()
          .replace(/^["“”'‘’]|["“”'‘’]$/g, '')
          .trim();
        return t.length === 0 ? null : t;
      })
      .filter(Boolean);
    const nValid = normalized.length;
    if (nValid < 2) continue;
    const dist = {};
    for (const n of normalized) dist[n] = (dist[n] || 0) + 1;
    for (const k of Object.keys(dist)) dist[k] = Math.round((dist[k] / nValid) * 10000) / 10000;
    records.push({
      model,
      task_id,
      lang,
      temperature,
      n_valid: nValid,
      n_off_format: rawAnswers.length - nValid,
      validity_rate: Math.round((nValid / rawAnswers.length) * 10000) / 10000,
      dist
    });
  }

  const { valid, invalid } = validateDistributions(records);
  if (invalid.length > 0) {
    warn(`schema validation: ${invalid.length} records rejected (${valid.length} kept)`);
    for (const { index, errors } of invalid.slice(0, 5)) {
      warn(`  #${index}: ${errors.join('; ')}`);
    }
    if (invalid.length > 5) warn(`  … (${invalid.length - 5} more)`);
  }

  if (valid.length === 0) {
    warn('no valid records to import');
    process.exit(1);
  }

  db._ingest(valid);
  db.save(valid);
  warn(`imported ${valid.length} cells for ${model} from ${path}`);
}
