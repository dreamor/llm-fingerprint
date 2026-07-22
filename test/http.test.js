import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withRetry, pool, HttpError, parseRetryAfter } from '../lib/http.js';

describe('parseRetryAfter()', () => {
  it('parses seconds', () => assert.equal(parseRetryAfter('5'), 5000));
  it('parses zero seconds', () => assert.equal(parseRetryAfter('0'), 0));
  it('returns null for empty', () => assert.equal(parseRetryAfter(''), null));
  it('returns null for garbage', () => assert.equal(parseRetryAfter('nonsense'), null));
});

describe('withRetry()', () => {
  it('returns immediately on success', async () => {
    let n = 0;
    const r = await withRetry(
      async () => {
        n++;
        return 'ok';
      },
      { baseDelay: 1 }
    );
    assert.equal(r, 'ok');
    assert.equal(n, 1);
  });

  it('retries transient network errors', async () => {
    let n = 0;
    const r = await withRetry(
      async () => {
        n++;
        if (n < 3) throw new Error('ECONNRESET');
        return 'ok';
      },
      { baseDelay: 1, retries: 5 }
    );
    assert.equal(r, 'ok');
    assert.equal(n, 3);
  });

  it('retries HTTP 429 with Retry-After hint', async () => {
    let n = 0;
    await withRetry(
      async () => {
        n++;
        if (n < 2) throw new HttpError(429, 'rate limited', '1');
        return 'ok';
      },
      { baseDelay: 1 }
    );
    assert.equal(n, 2);
  });

  it('does NOT retry 4xx (non-retryable)', async () => {
    let n = 0;
    await assert.rejects(
      withRetry(
        async () => {
          n++;
          throw new HttpError(400, 'bad request');
        },
        { baseDelay: 1, retries: 5 }
      )
    );
    assert.equal(n, 1, 'should not retry a 400');
  });

  it('gives up after retries exhausted', async () => {
    let n = 0;
    await assert.rejects(
      withRetry(
        async () => {
          n++;
          throw new HttpError(500, 'boom');
        },
        { baseDelay: 1, retries: 2 }
      )
    );
    assert.equal(n, 3, 'initial attempt + 2 retries');
  });
});

describe('pool()', () => {
  it('preserves input order in results', async () => {
    const items = [1, 2, 3, 4, 5];
    const out = await pool(items, 2, async (n) => {
      await new Promise((r) => setTimeout(r, (6 - n) * 5)); // reverse timing
      return n * 10;
    });
    assert.deepEqual(out, [10, 20, 30, 40, 50]);
  });

  it('respects the concurrency cap', async () => {
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);
    await pool(items, 3, async (i) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return i;
    });
    assert.ok(peak <= 3, `peak was ${peak}, expected ≤ 3`);
    assert.ok(peak >= 2, 'should hit the cap');
  });

  it('rejects with the first error', async () => {
    await assert.rejects(
      pool([1, 2, 3], 2, async (i) => {
        if (i === 2) throw new Error('nope');
        return i;
      })
    );
  });
});
