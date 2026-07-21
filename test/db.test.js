import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { FingerprintDB, inferFamily } from '../lib/db.js';

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