import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { FingerprintDB } from '../lib/db.js';
import { match } from '../lib/match.js';

describe('match()', () => {
  let db;

  before(() => {
    db = new FingerprintDB();
    db.load();
  });

  it('returns candidates sorted by ascending mean JSD', () => {
    // Build a probe from gpt-4o's own reference cells
    const ref = db.getModel('openai/gpt-4o');
    const cells = [];
    for (const [, rec] of ref) {
      cells.push(rec);
    }
    const probeResult = {
      model: 'unknown',
      temperature: 1,
      cells: cells.slice(0, 10).map((c) => ({
        task_id: c.task_id,
        lang: c.lang,
        temperature: 1,
        n_valid: c.n_valid || 30,
        dist: c.dist
      }))
    };

    const result = match(db, probeResult, { topK: 3, minSharedCells: 2 });
    assert.ok(result.candidates.length > 0);
    assert.equal(result.target, 'unknown');
    // Verify ascending JSD
    for (let i = 1; i < result.candidates.length; i++) {
      assert.ok(result.candidates[i - 1].mean_jsd <= result.candidates[i].mean_jsd);
    }
  });

  it('identifies gpt-4o as top match when probed with gpt-4o data', () => {
    const ref = db.getModel('openai/gpt-4o');
    const cells = [];
    for (const [, rec] of ref) {
      cells.push(rec);
    }
    const probeResult = {
      model: 'test',
      temperature: 1,
      cells: cells.slice(0, 15).map((c) => ({
        task_id: c.task_id,
        lang: c.lang,
        temperature: 1,
        n_valid: c.n_valid || 30,
        dist: { ...c.dist }
      }))
    };

    const result = match(db, probeResult, { topK: 5, minSharedCells: 3 });
    assert.ok(result.candidates.length > 0);
    assert.equal(result.candidates[0].model, 'openai/gpt-4o');
    assert.ok(result.candidates[0].mean_jsd < 0.01);
  });

  it('returns empty candidates when probe has zero valid cells', () => {
    const probeResult = {
      model: 'empty',
      temperature: 1,
      cells: []
    };
    const result = match(db, probeResult, { topK: 5, minSharedCells: 3 });
    assert.equal(result.candidates.length, 0);
    assert.equal(result.verdict.confidence, 'unknown');
  });

  it('returns family information for each candidate', () => {
    const ref = db.getModel('anthropic/claude-sonnet-5');
    const cells = [];
    for (const [, rec] of ref) {
      cells.push(rec);
    }
    const probeResult = {
      model: 'test',
      temperature: 1,
      cells: cells.slice(0, 10).map((c) => ({
        task_id: c.task_id,
        lang: c.lang,
        temperature: 1,
        n_valid: c.n_valid || 30,
        dist: { ...c.dist }
      }))
    };

    const result = match(db, probeResult, { topK: 3, minSharedCells: 2 });
    for (const c of result.candidates) {
      assert.ok(typeof c.family === 'string');
      assert.ok(typeof c.shared_cells === 'number');
    }
    assert.ok(result.families_seen.includes('claude'));
  });
});
