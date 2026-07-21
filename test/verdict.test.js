import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classificationVerdict, verificationVerdict, tierFor } from '../lib/verdict.js';

describe('tierFor()', () => {
  it('assigns very_high for JSD < 0.05', () => {
    assert.equal(tierFor(0.02).key, 'very_high');
    assert.equal(tierFor(0.049).key, 'very_high');
  });
  it('assigns high for 0.05 ≤ JSD < 0.10', () => {
    assert.equal(tierFor(0.05).key, 'high');
    assert.equal(tierFor(0.099).key, 'high');
  });
  it('assigns moderate for 0.10 ≤ JSD < 0.20', () => {
    assert.equal(tierFor(0.10).key, 'moderate');
    assert.equal(tierFor(0.19).key, 'moderate');
  });
  it('assigns low for 0.20 ≤ JSD < 0.30', () => {
    assert.equal(tierFor(0.25).key, 'low');
  });
  it('assigns unknown for JSD ≥ 0.30', () => {
    assert.equal(tierFor(0.30).key, 'unknown');
    assert.equal(tierFor(0.90).key, 'unknown');
  });
});

describe('classificationVerdict()', () => {
  it('reports very_high with the model name', () => {
    const v = classificationVerdict({ model: 'openai/gpt-4o', mean_jsd: 0.02 });
    assert.equal(v.confidence, 'very_high');
    assert.match(v.label, /openai\/gpt-4o/);
    assert.match(v.label, /very high/);
  });
  it('handles null best (no candidates)', () => {
    const v = classificationVerdict(null);
    assert.equal(v.confidence, 'unknown');
    assert.match(v.label, /no match/);
  });
});

describe('verificationVerdict()', () => {
  it('passes when JSD < 0.10 (aligned with classification high/very_high)', () => {
    const v = verificationVerdict(0.03, 'openai/gpt-4o', 'openai/gpt-4o');
    assert.equal(v.status, 'passed');
    assert.match(v.label, /PASSED/);
  });
  it('marks moderate JSD as weak, not passed — resolves match vs verify contradiction', () => {
    const v = verificationVerdict(0.15, 'openai/gpt-4o', 'openai/gpt-4o');
    assert.equal(v.status, 'weak');
  });
  it('marks low JSD as suspicious, suggesting alternative', () => {
    const v = verificationVerdict(0.25, 'openai/gpt-4o', 'qwen/qwen3');
    assert.equal(v.status, 'suspicious');
    assert.match(v.detail, /qwen/);
  });
  it('marks unknown JSD as failed', () => {
    const v = verificationVerdict(0.40, 'openai/gpt-4o', 'anthropic/claude');
    assert.equal(v.status, 'failed');
    assert.match(v.detail, /claude/);
  });
});
