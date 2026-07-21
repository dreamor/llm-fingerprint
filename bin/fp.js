#!/usr/bin/env node
/**
 * fp — LLM Fingerprint CLI
 *
 * Usage:
 *   fp probe <endpoint> <api-key> <model>         Probe an unknown model
 *   fp match <probe-result.json>                   Match against reference library
 *   fp fingerprint                                 Build distributions from manual answers and match
 *   fp verify <endpoint> <api-key> <claimed-model> Verify a claimed model identity
 *   fp list [-f family]                            List reference fingerprints
 *   fp import <responses.jsonl> --model <name>     Ingest new fingerprint data
 *   fp bootstrap <distributions.json>              Initialize reference library
 *   fp help
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FingerprintDB, inferFamily } from '../lib/db.js';
import { match } from '../lib/match.js';
import { probe, resolveReps, BUDGET_CURVE } from '../lib/probe.js';
import { TASKS, LANG, normalize } from '../lib/tasks.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, '..');

const help = `
Usage:
  fp probe <endpoint> <api-key> <model> [--reps 30|auto] [--langs en,zh] [--api openai|anthropic]
  fp match <probe-result.json> [--top 5]
  fp fingerprint <answers.csv> [--model <label>]
  fp verify <endpoint> <api-key> <claimed-model> [--reps 16] [--api openai|anthropic]
  fp list [--family <name>]
  fp import <responses.jsonl> --model <name>
  fp bootstrap <distributions.json>
  fp help

Examples:
  fp probe https://api.openai.com/v1 sk-xxx gpt-4o --reps 16 --langs en
  fp probe https://api.anthropic.com sk-ant-xxx claude-sonnet-5 --api anthropic --reps auto
  fp fingerprint ./answers.csv
  fp verify https://api.openai.com/v1 sk-xxx gpt-4o --reps 16
  fp match ./data/probe-20260721.json
  fp list --family claude
  fp import ./raw/responses.jsonl --model "anthropic/claude-sonnet-5"
  fp bootstrap ../results/distributions.json

fingerprint answers.csv format (header required):
  task_id,lang,answer
  num10-random,en,7
  coin-flip,en,heads
  color-favorite,zh,蓝色
`.trim();

function warn(msg) { console.error(`[fp] ${msg}`); }

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(help);
    return;
  }

  // ---- bootstrap ----
  if (cmd === 'bootstrap') {
    const src = args[1];
    if (!src) { warn('usage: fp bootstrap <distributions.json>'); process.exit(1); }
    if (!existsSync(src)) { warn(`file not found: ${src}`); process.exit(1); }
    const raw = JSON.parse(readFileSync(src, 'utf-8'));
    const records = raw.distributions || raw;
    const outPath = join(ROOT, 'data', 'reference.json');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify({
      generated_utc: new Date().toISOString(),
      n_cells: records.length,
      distributions: records,
    }, null, 2));
    const models = new Set(records.map(r => r.model));
    warn(`bootstrapped ${models.size} models (${records.length} cells) → data/reference.json`);
    return;
  }

  // Ensure reference library exists
  const db = new FingerprintDB();
  db.load();
  if (db.n === 0 && cmd !== 'bootstrap') {
    warn('reference library empty — run "fp bootstrap <distributions.json>" first');
    process.exit(1);
  }

  // ---- list ----
  if (cmd === 'list') {
    const familyFilter = parseFlag(args, '--family');
    const models = db.listModels();
    if (familyFilter) {
      const filtered = models.filter(m => inferFamily(m) === familyFilter);
      console.log(`\n${familyFilter} (${filtered.length} models):`);
      for (const m of filtered) console.log(`  ${m}`);
    } else {
      const families = db.listFamilies();
      console.log(`\nReference library: ${db.n} models`);
      for (const f of families) {
        const members = db.getFamily(f);
        console.log(`  ${f}: ${members.length} models`);
      }
      console.log(`\nUsage: fp list --family <name> to see individual models`);
    }
    return;
  }

  // ---- probe ----
  if (cmd === 'probe') {
    const endpoint = args[1];
    const apiKey = args[2];
    const model = args[3];
    if (!endpoint || !apiKey || !model) {
      warn('usage: fp probe <endpoint> <api-key> <model> [--reps N] [--langs en,zh] [--api openai|anthropic]');
      process.exit(1);
    }
    const apiType = parseFlag(args, '--api') || 'openai';
    const repsRaw = parseFlag(args, '--reps') || '30';
    const eerTarget = parseFlag(args, '--eer')
      ? parseFloat(parseFlag(args, '--eer'))
      : 0.10;
    const reps = resolveReps(repsRaw, eerTarget);
    const langs = parseFlag(args, '--langs')?.split(',').filter(Boolean) || LANG;

    console.log(`\nProbing ${model} …`);
    console.log(`  endpoint: ${endpoint}`);
    console.log(`  api type: ${apiType}`);
    console.log(`  languages: ${langs.join(', ')}`);
    console.log(`  reps: ${reps}`);
    if (repsRaw === 'auto') {
      console.log(`  (auto — budget curve EER ≤ ${(eerTarget * 100).toFixed(0)}%)`);
    }
    console.log();

    const result = await probe({
      endpoint,
      apiKey,
      model,
      apiType,
      temperature: 1,
      reps,
      languages: langs,
      onProgress: msg => warn(msg),
    });

    const ts = Date.now();
    const outDir = join(ROOT, 'data', `probe-${ts}`);
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 'result.json');
    writeFileSync(outPath, JSON.stringify(result, null, 2));

    console.log(`\nProbe complete — ~$${result.cost_usd.toFixed(5)}`);
    console.log(`Saved to ${outPath}\n`);

    // Run match automatically
    const m = match(db, result);
    printVerdict(m);
    return;
  }

  // ---- verify ----
  if (cmd === 'verify') {
    const endpoint = args[1];
    const apiKey = args[2];
    const claimedModel = args[3];
    if (!endpoint || !apiKey || !claimedModel) {
      warn('usage: fp verify <endpoint> <api-key> <claimed-model> [--reps 16] [--api openai|anthropic]');
      process.exit(1);
    }
    const apiType = parseFlag(args, '--api') || 'openai';
    const repsRaw = parseFlag(args, '--reps') || '16';
    const reps = resolveReps(repsRaw, 0.10);
    const langs = parseFlag(args, '--langs')?.split(',').filter(Boolean) || ['en'];

    console.log(`\nVerifying ${claimedModel} …`);
    console.log(`  endpoint: ${endpoint}`);
    console.log(`  api type: ${apiType}`);
    console.log(`  claimed model: ${claimedModel}`);
    console.log(`  reps: ${reps}`);
    console.log();

    const result = await probe({
      endpoint,
      apiKey,
      model: claimedModel,
      apiType,
      temperature: 1,
      reps,
      languages: langs,
      onProgress: msg => warn(msg),
    });

    const ts = Date.now();
    const outDir = join(ROOT, 'data', `verify-${ts}`);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'result.json'), JSON.stringify(result, null, 2));

    console.log(`\nProbe done — ~$${result.cost_usd.toFixed(5)}`);
    console.log();

    const m = match(db, result);
    printVerdict(m);

    // Check if claimed model is in reference library
    const claimedInLib = db.listModels().includes(claimedModel);
    if (!claimedInLib) {
      console.log(`  ⚠  "${claimedModel}" is not in the reference library.`);
      console.log(`     Verification is limited to family-level inference.\n`);
      console.log(`═══════════════════════════════════════\n`);
      return;
    }

    // Find the claimed model in the match results
    const claimedEntry = m.candidates.find(c => c.model === claimedModel);
    if (!claimedEntry) {
      console.log(`  ❌ VERIFICATION FAILED — "${claimedModel}" did not match at all.`);
      console.log(`     The closest reference models belong to a different family.\n`);
      console.log(`═══════════════════════════════════════\n`);
      return;
    }

    const jsd = claimedEntry.mean_jsd;
    if (jsd < 0.10) {
      console.log(`  ✅ VERIFICATION PASSED — "${claimedModel}" confirmed (JSD=${jsd.toFixed(4)}).`);
    } else if (jsd < 0.20) {
      console.log(`  ⚠  VERIFICATION WEAK — "${claimedModel}" JSD=${jsd.toFixed(4)}.`);
      console.log(`     The model behaves like ${claimedModel} but the fingerprint is not clean.`);
      console.log(`     Possible: model update, quantization, or provider routing variance.`);
    } else if (jsd < 0.30) {
      console.log(`  ❌ VERIFICATION SUSPICIOUS — "${claimedModel}" JSD=${jsd.toFixed(4)}.`);
      console.log(`     The claimed model is only a loose match. The actual model may be different.`);
      console.log(`     Best alternative: ${m.candidates[0].model} (JSD=${m.candidates[0].mean_jsd.toFixed(4)}).`);
    } else {
      console.log(`  ❌ VERIFICATION FAILED — "${claimedModel}" JSD=${jsd.toFixed(4)}.`);
      console.log(`     The actual behavior does not match the claimed model.`);
      console.log(`     Best match instead: ${m.candidates[0].model} (JSD=${m.candidates[0].mean_jsd.toFixed(4)}).`);
    }
    console.log(`═══════════════════════════════════════\n`);
    return;
  }

  // ---- fingerprint (manual answers) ----
  if (cmd === 'fingerprint') {
    const csvPath = args[1];
    if (!csvPath) {
      warn('usage: fp fingerprint <answers.csv> [--model <label>]');
      process.exit(1);
    }
    if (!existsSync(csvPath)) { warn(`file not found: ${csvPath}`); process.exit(1); }
    const modelLabel = parseFlag(args, '--model') || 'manual-input';

    const text = readFileSync(csvPath, 'utf-8').trim();
    const lines = text.split('\n').filter(Boolean);
    if (lines.length < 2) { warn('CSV must have a header row and at least one data row'); process.exit(1); }

    // Parse CSV (simple: no escaped commas)
    const header = lines[0].toLowerCase().split(',').map(s => s.trim());
    const taskIdx = header.indexOf('task_id');
    const langIdx = header.indexOf('lang');
    const ansIdx = header.indexOf('answer');
    if (taskIdx === -1 || langIdx === -1 || ansIdx === -1) {
      warn('CSV header must contain: task_id, lang, answer');
      process.exit(1);
    }

    // Group by (task_id, lang)
    const groups = new Map();
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(s => s.trim());
      const taskId = cols[taskIdx];
      const lang = cols[langIdx];
      const answer = cols[ansIdx];
      if (!taskId || !lang || !answer) continue;
      const key = `${taskId}|${lang}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(answer);
    }

    if (groups.size === 0) { warn('no valid rows found in CSV'); process.exit(1); }

    const cells = [];
    for (const [cellKey, rawAnswers] of groups) {
      const [task_id, lang] = cellKey.split('|');
      const normalized = rawAnswers.map(r => normalize(r)).filter(Boolean);
      const nValid = normalized.length;
      if (nValid < 2) continue;
      const dist = {};
      for (const n of normalized) dist[n] = (dist[n] || 0) + 1;
      for (const k of Object.keys(dist)) dist[k] = Math.round((dist[k] / nValid) * 10000) / 10000;
      const entropy = Object.values(dist).reduce((s, p) => s - (p > 0 ? p * Math.log2(p) : 0), 0);
      const mode = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
      cells.push({
        task_id, lang,
        temperature: 1,
        n_valid: nValid,
        n_off_format: rawAnswers.length - nValid,
        validity_rate: Math.round((nValid / rawAnswers.length) * 10000) / 10000,
        dist,
        entropy_bits: Math.round(entropy * 1000) / 1000,
        mode: mode?.[0] || null,
        mode_share: mode?.[1] || 0,
      });
    }

    const probeResult = { model: modelLabel, provider: 'manual', api_type: 'manual', temperature: 1, reps: 'manual', cells, cost_usd: 0 };
    console.log(`\nFingerprint from manual answers:`);
    console.log(`  ${groups.size} cell groups`);
    console.log(`  ${cells.length} cells with ≥2 valid answers each\n`);

    const m = match(db, probeResult);
    printVerdict(m);
    return;
  }

  // ---- match ----
  if (cmd === 'match') {
    const path = args[1];
    if (!path) { warn('usage: fp match <probe-result.json>'); process.exit(1); }
    if (!existsSync(path)) { warn(`file not found: ${path}`); process.exit(1); }
    const probeResult = JSON.parse(readFileSync(path, 'utf-8'));
    const topK = parseInt(parseFlag(args, '--top') || '5', 10);
    const m = match(db, probeResult, { topK });
    printVerdict(m);
    return;
  }

  // ---- import ----
  if (cmd === 'import') {
    const path = args[1];
    const model = parseFlag(args, '--model');
    if (!path || !model) {
      warn('usage: fp import <responses.jsonl> --model <name>');
      process.exit(1);
    }
    if (!existsSync(path)) { warn(`file not found: ${path}`); process.exit(1); }

    // Group raw responses by (task, lang, temperature) and build distributions
    const lines = readFileSync(path, 'utf-8').trim().split('\n').filter(Boolean);
    const groups = new Map();
    const seen = new Set();

    for (const line of lines) {
      const r = JSON.parse(line);
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
      const normalized = rawAnswers.map(r => {
        if (r === null || r === undefined || r === '') return null;
        let t = String(r).trim().replace(/^[""'']|[""'']$/g, '').trim();
        if (t.length === 0) return null;
        return t;
      }).filter(Boolean);
      const nValid = normalized.length;
      if (nValid < 2) continue;
      const dist = {};
      for (const n of normalized) { dist[n] = (dist[n] || 0) + 1; }
      for (const k of Object.keys(dist)) { dist[k] = Math.round((dist[k] / nValid) * 10000) / 10000; }
      records.push({ model, task_id, lang, temperature, n_valid: nValid, n_off_format: rawAnswers.length - nValid, validity_rate: Math.round((nValid / rawAnswers.length) * 10000) / 10000, dist });
    }

    db._ingest(records);
    db.save(records);
    warn(`imported ${records.length} cells for ${model} from ${path}`);
    return;
  }

  warn(`unknown command: ${cmd}\n${help}`);
  process.exit(1);
}

function parseFlag(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function printVerdict(m) {
  console.log(`\n═══════════════════════════════════════`);
  console.log(`  Target:        ${m.target}`);
  console.log(`  Verdict:       ${m.verdict.label}`);
  console.log(`  Confidence:    ${m.verdict.confidence}`);
  console.log(`───────────────────────────────────────`);

  if (m.candidates.length > 0) {
    console.log(`  Top matches:`);
    for (const c of m.candidates) {
      const barLen = Math.max(1, Math.round((1 - Math.min(c.mean_jsd, 1)) * 20));
      const bar = '█'.repeat(barLen) + '░'.repeat(Math.max(0, 20 - barLen));
      console.log(`    ${bar}  ${c.model.padEnd(40)} JSD=${c.mean_jsd.toFixed(4)}  (${c.shared_cells} cells)`);
    }
  }
  console.log(`═══════════════════════════════════════\n`);
}

main().catch(err => { warn(err.message); process.exit(1); });