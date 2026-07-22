import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateDistribution, validateDistributions } from '../lib/schema.js';

describe('validateDistribution()', () => {
  const good = {
    model: 'openai/gpt-4o',
    task_id: 'coin-flip',
    lang: 'en',
    temperature: 1,
    dist: { heads: 0.5, tails: 0.5 }
  };

  it('accepts a valid record', () => {
    const r = validateDistribution(good);
    assert.ok(r.ok, r.errors.join('; '));
  });

  it('rejects missing required fields', () => {
    const r = validateDistribution({ model: 'x/y' });
    assert.ok(!r.ok);
    assert.ok(r.errors.some((e) => e.includes('task_id')));
    assert.ok(r.errors.some((e) => e.includes('lang')));
    assert.ok(r.errors.some((e) => e.includes('temperature')));
    assert.ok(r.errors.some((e) => e.includes('dist')));
  });

  it('rejects non-numeric probabilities', () => {
    const r = validateDistribution({ ...good, dist: { heads: 'wat', tails: 0.5 } });
    assert.ok(!r.ok);
  });

  it('rejects probabilities outside [0,1]', () => {
    const r = validateDistribution({ ...good, dist: { heads: 1.5, tails: -0.5 } });
    assert.ok(!r.ok);
  });

  it('rejects distributions that do not sum to ~1', () => {
    const r = validateDistribution({ ...good, dist: { heads: 0.3, tails: 0.3 } });
    assert.ok(!r.ok);
    assert.ok(r.errors.some((e) => e.includes('sum to ~1')));
  });

  it('tolerates 1% rounding slack', () => {
    const r = validateDistribution({ ...good, dist: { heads: 0.503, tails: 0.502 } });
    assert.ok(r.ok, r.errors.join('; '));
  });

  it('rejects null', () => {
    assert.ok(!validateDistribution(null).ok);
  });
});

describe('validateDistributions() batch', () => {
  it('splits valid vs invalid with indices', () => {
    const records = [
      { model: 'a/x', task_id: 't', lang: 'en', temperature: 1, dist: { y: 1 } },
      { model: 'b/y', /* missing task_id */ lang: 'en', temperature: 1, dist: { y: 1 } }
    ];
    const { valid, invalid } = validateDistributions(records);
    assert.equal(valid.length, 1);
    assert.equal(invalid.length, 1);
    assert.equal(invalid[0].index, 1);
  });

  it('handles a non-array input', () => {
    const { valid, invalid } = validateDistributions('nope');
    assert.equal(valid.length, 0);
    assert.equal(invalid.length, 1);
    assert.equal(invalid[0].index, -1);
  });
});
