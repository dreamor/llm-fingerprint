import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FingerprintDB, inferFamily, bootstrapReference } from '../lib/db.js';

describe('FingerprintDB', () => {
  let db;

  before(() => {
    db = new FingerprintDB();
    db.load();
  });

  it('loads models from the reference library', () => {
    assert.ok(db.n > 0, 'should have at least 1 model');
    assert.ok(db.n >= 160, `expected >= 160 models, got ${db.n}`);
  });

  it('listModels() returns sorted unique model names', () => {
    const models = db.listModels();
    assert.ok(Array.isArray(models));
    assert.equal(models.length, db.n);
    // verify sorted
    for (let i = 1; i < models.length; i++) {
      assert.ok(models[i - 1] <= models[i], 'not sorted');
    }
  });

  it('getModel() returns a cell map for known models', () => {
    const cells = db.getModel('openai/gpt-4o');
    assert.ok(cells instanceof Map);
    assert.ok(cells.size > 0);
  });

  it('getModel() returns undefined for unknown models', () => {
    assert.equal(db.getModel('nonexistent/model'), undefined);
  });

  it('listFamilies() returns expected families', () => {
    const families = db.listFamilies();
    assert.ok(families.includes('claude'));
    assert.ok(families.includes('gpt'));
    assert.ok(families.includes('qwen'));
    assert.ok(families.includes('deepseek'));
    assert.ok(families.includes('llama'));
    assert.ok(families.includes('mistral'));
  });

  it('entries() iterates all models', () => {
    let count = 0;
    /* eslint-disable-next-line no-unused-vars */
    for (const _ of db.entries()) {
      count++;
    }
    assert.equal(count, db.n);
  });

  it('entries() yields model and cells', () => {
    for (const { model, cells } of db.entries()) {
      assert.ok(typeof model === 'string');
      assert.ok(cells instanceof Map);
      assert.ok(cells.size > 0);
      break;
    }
  });
});

describe('inferFamily()', () => {
  it('maps anthropic to claude', () => {
    assert.equal(inferFamily('anthropic/claude-sonnet-5'), 'claude');
  });

  it('maps openai to gpt', () => {
    assert.equal(inferFamily('openai/gpt-4o'), 'gpt');
  });

  it('maps google to gemini', () => {
    assert.equal(inferFamily('google/gemini-2.5-flash'), 'gemini');
  });

  it('maps meta-llama to llama', () => {
    assert.equal(inferFamily('meta-llama/llama-4-maverick'), 'llama');
  });

  it('maps unknown prefix to other', () => {
    assert.equal(inferFamily('unknown-org/custom-model'), 'other');
  });

  it('handles model slugs without provider prefix', () => {
    // Not realistic for OpenRouter but defensive
    assert.equal(inferFamily('just-a-model'), 'other');
  });
});

describe('FingerprintDB.save() overwrite semantics', () => {
  let tmp;
  let path;

  before(() => {
    tmp = mkdtempSync(join(tmpdir(), 'fp-db-'));
    path = join(tmp, 'reference.json');
  });

  after(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('records overwrite existing cells with the same (model, task, lang, temp) key', () => {
    const db = new FingerprintDB(path);
    const initial = [
      {
        model: 'acme/foo',
        task_id: 'coin-flip',
        lang: 'en',
        temperature: 1,
        n_valid: 10,
        dist: { heads: 0.7, tails: 0.3 }
      }
    ];
    db.save(initial);

    // Re-import with a corrected distribution
    const updated = [
      {
        model: 'acme/foo',
        task_id: 'coin-flip',
        lang: 'en',
        temperature: 1,
        n_valid: 20,
        dist: { heads: 0.5, tails: 0.5 }
      }
    ];
    db.save(updated);

    const stored = JSON.parse(readFileSync(path, 'utf-8'));
    const cell = stored.distributions.find(
      (r) => r.model === 'acme/foo' && r.task_id === 'coin-flip' && r.lang === 'en'
    );
    assert.equal(cell.n_valid, 20, 'expected new record to overwrite old');
    assert.deepEqual(cell.dist, { heads: 0.5, tails: 0.5 });
    // no duplicate row
    const matching = stored.distributions.filter(
      (r) =>
        r.model === 'acme/foo' &&
        r.task_id === 'coin-flip' &&
        r.lang === 'en' &&
        r.temperature === 1
    );
    assert.equal(matching.length, 1);
  });

  it('preserves unrelated cells across saves', () => {
    const db = new FingerprintDB(path);
    db.save([
      {
        model: 'acme/bar',
        task_id: 'coin-flip',
        lang: 'en',
        temperature: 1,
        n_valid: 5,
        dist: { heads: 1 }
      }
    ]);
    const stored = JSON.parse(readFileSync(path, 'utf-8'));
    const models = new Set(stored.distributions.map((r) => r.model));
    assert.ok(models.has('acme/foo'), 'earlier model must survive');
    assert.ok(models.has('acme/bar'), 'new model must be added');
  });
});

describe('bootstrapReference()', () => {
  let tmp;
  before(() => {
    tmp = mkdtempSync(join(tmpdir(), 'fp-boot-'));
  });
  after(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('materializes a reference file from the flat-array form', () => {
    const src = join(tmp, 'src-flat.json');
    const out = join(tmp, 'nested', 'reference.json');
    writeFileSync(
      src,
      JSON.stringify([
        { model: 'a/x', task_id: 't', lang: 'en', temperature: 1, dist: { y: 1 } },
        { model: 'a/y', task_id: 't', lang: 'en', temperature: 1, dist: { y: 1 } }
      ])
    );
    const result = bootstrapReference(src, out);
    assert.equal(result.modelCount, 2);
    assert.equal(result.cellCount, 2);
    assert.equal(result.outPath, out);
    assert.ok(existsSync(out), 'output file must be created (including parent dirs)');
    const stored = JSON.parse(readFileSync(out, 'utf-8'));
    assert.equal(stored.n_cells, 2);
    assert.equal(stored.distributions.length, 2);
  });

  it('accepts the { distributions: [...] } envelope form', () => {
    const src = join(tmp, 'src-envelope.json');
    const out = join(tmp, 'ref2.json');
    writeFileSync(
      src,
      JSON.stringify({
        generated_utc: '2026-01-01',
        distributions: [{ model: 'a/x', task_id: 't', lang: 'en', temperature: 1, dist: { y: 1 } }]
      })
    );
    const result = bootstrapReference(src, out);
    assert.equal(result.cellCount, 1);
    assert.equal(result.modelCount, 1);
  });
});
