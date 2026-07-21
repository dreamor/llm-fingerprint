import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { jsd } from '../lib/jsd.js';

describe('jsd()', () => {
  it('returns 0 for identical distributions', () => {
    const d = { a: 1 };
    assert.equal(jsd(d, d), 0);
  });

  it('returns 0 for identical multi-key distributions', () => {
    const d = { a: 0.5, b: 0.5 };
    assert.equal(jsd(d, d), 0);
  });

  it('returns a positive value for different distributions', () => {
    const p = { a: 1 };
    const q = { b: 1 };
    const result = jsd(p, q);
    assert.ok(result > 0);
    assert.ok(result <= 1);
  });

  it('is symmetric: JSD(P,Q) == JSD(Q,P)', () => {
    const p = { a: 0.7, b: 0.3 };
    const q = { a: 0.3, b: 0.7 };
    const forward = jsd(p, q);
    const backward = jsd(q, p);
    assert.equal(forward, backward);
  });

  it('handles partially overlapping distributions', () => {
    const p = { a: 0.5, b: 0.5 };
    const q = { b: 0.5, c: 0.5 };
    const d = jsd(p, q);
    assert.ok(d > 0);
    assert.ok(d <= 1);
  });

  it('handles zero-probability keys gracefully (smoothed by M)', () => {
    // JSD handles zeros via the midpoint distribution M
    const p = { x: 1 };
    const q = { x: 0, y: 1 };
    // q has 0 for 'x' but M has 0.5 for 'x'; KL(P||M) has log2(1/0.5) = 1
    // KL(Q||M): Q only has y=1, M has y=0.5 → log2(1/0.5) = 1
    // JSD = 0.5*(1) + 0.5*(1) = 1
    // But the keys are {x,y}, p(x)=1, M(x)=0.5, Q(x)=0 → KL(P||M) = 1*log2(1/0.5) = 1
    // Q only iterates over its own keys {y}, Q(y)=1, M(y)=0.5 → KL(Q||M) = 1*log2(1/0.5) = 1
    // JSD = 0.5*1 + 0.5*1 = 1
    const d = jsd(p, q);
    assert.equal(d, 1);
  });
});