/**
 * CLI end-to-end tests. Spawns `node bin/fp.js` for real. The reference DB is
 * pointed at a fixture via LLM_FINGERPRINT_HOME so tests never touch user
 * data or the bundled reference file.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'fp.js');

/** Minimal in-fixture reference set: two mock models covering enough cells to satisfy match.minSharedCells. */
const FIXTURE_MODELS = ['acme/foo', 'acme/bar'];
const FIXTURE_TASKS = ['coin-flip', 'num10-random', 'color-favorite', 'num100-random', 'num-favorite', 'letter-random', 'word-random', 'color-random', 'animal-random', 'city-random'];

function makeFixtureDistributions() {
  const records = [];
  for (const model of FIXTURE_MODELS) {
    for (const task_id of FIXTURE_TASKS) {
      records.push({
        model, task_id, lang: 'en', temperature: 1,
        n_valid: 10, n_off_format: 0, validity_rate: 1,
        dist: model === 'acme/foo' ? { heads: 0.5, tails: 0.5 } : { heads: 0.9, tails: 0.1 },
      });
    }
  }
  return records;
}

function run(env, args) {
  return spawnSync('node', [BIN, ...args], {
    env: { ...process.env, ...env },
    encoding: 'utf-8',
  });
}

describe('CLI e2e', () => {
  let home;

  before(() => {
    home = mkdtempSync(join(tmpdir(), 'fp-e2e-'));
    const distFile = join(home, 'dist.json');
    writeFileSync(distFile, JSON.stringify(makeFixtureDistributions()));
    // Bootstrap the reference to the sandboxed HOME
    const r = run({ LLM_FINGERPRINT_HOME: home }, ['bootstrap', distFile]);
    assert.equal(r.status, 0, `bootstrap failed: ${r.stderr}`);
    assert.ok(existsSync(join(home, 'reference.json')), 'reference.json must be created in HOME');
  });

  after(() => {
    rmSync(home, { recursive: true, force: true });
  });

  it('help prints usage without needing a DB', () => {
    const r = spawnSync('node', [BIN, 'help'], { encoding: 'utf-8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Usage:/);
    assert.match(r.stdout, /fp probe/);
  });

  it('list shows both fixture families', () => {
    const r = run({ LLM_FINGERPRINT_HOME: home }, ['list']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Reference library: 2 models/);
  });

  it('list --family filters by family', () => {
    const r = run({ LLM_FINGERPRINT_HOME: home }, ['list', '--family', 'other']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /acme\/foo/);
    assert.match(r.stdout, /acme\/bar/);
  });

  it('match reports a top candidate for a matching probe result', () => {
    const probe = {
      model: 'acme/mystery', temperature: 1,
      cells: FIXTURE_TASKS.map(task_id => ({
        task_id, lang: 'en', temperature: 1,
        n_valid: 10, dist: { heads: 0.5, tails: 0.5 },
      })),
    };
    const probePath = join(home, 'probe.json');
    writeFileSync(probePath, JSON.stringify(probe));
    const r = run({ LLM_FINGERPRINT_HOME: home }, ['match', probePath]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /acme\/foo/);
    assert.match(r.stdout, /very high|high confidence/);
  });

  it('fingerprint accepts a CSV with quoted / Unicode / commas', () => {
    const csv = 'task_id,lang,answer\ncoin-flip,en,heads\ncoin-flip,en,"tails"\ncoin-flip,en,heads\ncoin-flip,en,tails\ncoin-flip,en,heads\nnum10-random,en,7\nnum10-random,en,7\n';
    const csvPath = join(home, 'answers.csv');
    writeFileSync(csvPath, csv);
    const r = run({ LLM_FINGERPRINT_HOME: home }, ['fingerprint', csvPath]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /cell groups/);
  });

  it('import + remove round-trip', () => {
    const jsonl = [
      { model: 'acme/added', task_id: 'coin-flip', lang: 'en', temperature: 1, raw: 'heads', finish_reason: 'stop' },
      { model: 'acme/added', task_id: 'coin-flip', lang: 'en', temperature: 1, raw: 'heads', finish_reason: 'stop' },
      { model: 'acme/added', task_id: 'coin-flip', lang: 'en', temperature: 1, raw: 'tails', finish_reason: 'stop' },
    ].map(o => JSON.stringify(o)).join('\n');
    const jsonlPath = join(home, 'add.jsonl');
    writeFileSync(jsonlPath, jsonl);

    const r1 = run({ LLM_FINGERPRINT_HOME: home }, ['import', jsonlPath, '--model', 'acme/added']);
    assert.equal(r1.status, 0, r1.stderr);
    assert.match(r1.stderr, /imported/);

    const stored = JSON.parse(readFileSync(join(home, 'reference.json'), 'utf-8'));
    assert.ok(stored.distributions.some(r => r.model === 'acme/added'), 'imported model must be present');

    const r2 = run({ LLM_FINGERPRINT_HOME: home }, ['remove', 'acme/added']);
    assert.equal(r2.status, 0, r2.stderr);
    const after = JSON.parse(readFileSync(join(home, 'reference.json'), 'utf-8'));
    assert.ok(!after.distributions.some(r => r.model === 'acme/added'), 'removed model must be gone');
  });

  it('unknown command exits non-zero with usage', () => {
    const r = run({ LLM_FINGERPRINT_HOME: home }, ['whatever']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /unknown command/);
  });

  it('lazy bootstrap kicks in when HOME is empty (uses bundled distributions)', () => {
    const empty = mkdtempSync(join(tmpdir(), 'fp-empty-'));
    try {
      const r = run({ LLM_FINGERPRINT_HOME: empty }, ['list']);
      assert.equal(r.status, 0, r.stderr);
      assert.match(r.stderr, /auto-bootstrapping/);
      assert.match(r.stdout, /Reference library/);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
