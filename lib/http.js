/**
 * HTTP helpers used by the probe layer.
 *
 * The probe issues thousands of requests per run (15 tasks × 4 langs × N reps),
 * so serial + no-retry is a non-starter for anything past a smoke test. This
 * module adds:
 *
 *   - `withRetry()` — exponential backoff on transient failures (429/5xx/network),
 *     honoring the server's Retry-After header when present
 *   - `pool()` — bounded concurrency executor that preserves input order
 *
 * Zero dependencies by design (the rest of the project is dep-free).
 */

/** Sleep for `ms` milliseconds. */
export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Parse a Retry-After header (seconds or HTTP-date). Returns ms, or null. */
export function parseRetryAfter(value) {
  if (!value) return null;
  const secs = Number(value);
  if (Number.isFinite(secs) && secs >= 0) return Math.round(secs * 1000);
  const date = Date.parse(value);
  if (Number.isFinite(date)) {
    const delta = date - Date.now();
    return delta > 0 ? delta : 0;
  }
  return null;
}

/**
 * Wrap an async operation with retry + exponential backoff.
 *
 * The operation should throw either a plain Error (network failure) or a
 * `HttpError` (status ≥ 400). Only retries on:
 *   - HTTP 408, 425, 429, 500, 502, 503, 504
 *   - network errors (any thrown non-HttpError)
 *
 * @template T
 * @param {() => Promise<T>} op
 * @param {object} [opts]
 * @param {number} [opts.retries=4]
 * @param {number} [opts.baseDelay=500]
 * @param {number} [opts.maxDelay=15000]
 * @param {number} [opts.jitterSeed=0]  unique per-worker seed to spread retries
 * @param {(attempt: number, delay: number, err: Error) => void} [opts.onRetry]
 * @returns {Promise<T>}
 */
export async function withRetry(op, opts = {}) {
  const { retries = 4, baseDelay = 500, maxDelay = 15000, jitterSeed = 0, onRetry } = opts;
  let attempt = 0;
  for (;;) {
    try {
      return await op();
    } catch (err) {
      const retryable = isRetryable(err);
      if (!retryable || attempt >= retries) throw err;
      const hintedDelay = err instanceof HttpError ? parseRetryAfter(err.retryAfter) : null;
      const backoff = Math.min(maxDelay, baseDelay * 2 ** attempt);
      const jitter = Math.floor(
        backoff * 0.25 * (0.5 - deterministicJitter(attempt * 1000 + jitterSeed))
      );
      const delay = Math.max(0, hintedDelay ?? backoff + jitter);
      onRetry?.(attempt + 1, delay, err);
      await sleep(delay);
      attempt++;
    }
  }
}

function isRetryable(err) {
  if (err instanceof HttpError) return RETRYABLE_STATUSES.has(err.status);
  return true; // network / TypeError / AbortError → retry
}

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

// Deterministic pseudo-jitter to avoid Math.random() (also cheap): pick a small
// value from a fixed sequence to spread retry timings across concurrent workers.
function deterministicJitter(seed) {
  const t = Math.sin(seed * 12.9898) * 43758.5453;
  return t - Math.floor(t);
}

/** HTTP error carrying status and Retry-After. */
export class HttpError extends Error {
  constructor(status, message, retryAfter) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

/**
 * Bounded-concurrency map: run `worker(item, i)` for each item with at most
 * `concurrency` in flight. Preserves input order in the result array.
 *
 * If a worker rejects, the pool waits for in-flight tasks then rejects.
 *
 * @template T, R
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T, i: number) => Promise<R>} worker
 * @returns {Promise<R[]>}
 */
export async function pool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  let firstError = null;
  const runners = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length)) },
    async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        if (firstError) return;
        try {
          results[i] = await worker(items[i], i);
        } catch (err) {
          firstError = firstError || err;
        }
      }
    }
  );
  await Promise.all(runners);
  if (firstError) throw firstError;
  return results;
}
