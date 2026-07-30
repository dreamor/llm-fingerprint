/* global URL */

/**
 * Probe an unknown LLM endpoint and build its empirical answer distribution.
 *
 * Delegates HTTP transport to `lib/providers/*` and retry/concurrency to
 * `lib/http.js`. Also supports:
 *
 *   - budget-curve auto-reps (--reps auto)
 *   - bounded-concurrency HTTP with exponential backoff + Retry-After
 *   - adaptive early stop: after each round of ADAPTIVE_ROUND_SIZE reps per cell,
 *     re-match against a supplied reference index; if top-1 hasn't changed AND
 *     its mean JSD ≤ ADAPTIVE_STABLE_JSD for two consecutive rounds, stop early.
 *     Only active when caller passes `{ adaptive: true, matcher, db }`.
 */

import { TASKS, LANG, buildDistribution } from './tasks.js';
import { pool, withRetry } from './http.js';
import { getProvider } from './providers/index.js';

/** Budget curve from verification.json: k → EER */
const BUDGET_CURVE = [
  { k: 4, eer: 0.132 },
  { k: 8, eer: 0.106 },
  { k: 16, eer: 0.095 },
  { k: 24, eer: 0.089 },
  { k: 40, eer: 0.073 }
];

/** Adaptive early-stop constants. */
const ADAPTIVE_ROUND_SIZE = 8;
const ADAPTIVE_STABLE_JSD = 0.08;
const ADAPTIVE_MIN_REPS = 8;

/**
 * Resolve reps from user input.
 * `"auto"` picks the smallest k that meets the EER target.
 * A number is used as-is.
 */
export function resolveReps(repsInput, eerTarget) {
  if (repsInput === 'auto') {
    const target = eerTarget ?? 0.1;
    for (const { k, eer } of BUDGET_CURVE) {
      if (eer <= target) return k;
    }
    return 40;
  }
  const n = parseInt(repsInput, 10);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

/**
 * Kept for backwards compat with earlier tests / imports.
 * @deprecated Use `getProvider('anthropic').messagesUrl(endpoint)`.
 */
export { messagesUrl as anthropicMessagesUrl } from './providers/anthropic.js';

/**
 * Run a full probe.
 *
 * @param {object} opts
 * @param {string} opts.endpoint
 * @param {string} opts.apiKey
 * @param {string} opts.model
 * @param {'openai'|'anthropic'} [opts.apiType='openai']
 * @param {number} [opts.temperature=1]
 * @param {number} [opts.reps=30]
 * @param {string[]} [opts.languages]
 * @param {number} [opts.maxTokens=16]
 * @param {number} [opts.concurrency=4]
 * @param {number} [opts.retries=4]
 * @param {object} [opts.extraBody]  provider-specific extras (e.g. OpenRouter `reasoning`)
 * @param {(event: object) => void} [opts.onEvent]  progress + retry events
 * @param {boolean} [opts.adaptive=false]  enable adaptive early stopping
 * @param {object} [opts.adaptiveContext]  { matcher, db } required when adaptive=true
 * @returns {Promise<object>} probe result envelope
 */
export async function probe(opts) {
  const {
    endpoint,
    apiKey,
    model,
    apiType = 'openai',
    temperature = 1,
    reps = 30,
    maxTokens = 16,
    concurrency = 4,
    retries = 4,
    extraBody,
    onEvent = () => {},
    adaptive = false,
    adaptiveContext
  } = opts;
  const languages = opts.languages || LANG;
  const provider = getProvider(apiType);

  const emit = (type, payload) => onEvent({ type, ...payload });

  // Build the flat unit-of-work list: one entry per (task, lang, rep). We'll
  // process them with bounded concurrency and group by cell at the end.
  const cellUnits = new Map(); // cellKey → array of raw responses
  const cellKeys = [];
  const workItems = [];
  for (const lang of languages) {
    for (const task of TASKS) {
      const prompt = task.prompts[lang];
      if (!prompt) continue;
      const cellKey = `${task.task_id}|${lang}`;
      cellKeys.push(cellKey);
      cellUnits.set(cellKey, []);
      for (let r = 0; r < reps; r++) {
        workItems.push({ cellKey, task_id: task.task_id, lang, prompt, rep: r });
      }
    }
  }

  emit('start', { model, total: workItems.length, cells: cellKeys.length, concurrency });

  const totalDoneRef = { n: 0 };
  const stopSignal = { stop: false };
  const failures = { count: 0 };

  const runOne = async (unit, index) => {
    if (stopSignal.stop) return;
    try {
      const raw = await withRetry(
        () =>
          provider.complete(endpoint, {
            apiKey,
            model,
            prompt: unit.prompt,
            temperature,
            maxTokens,
            extraBody
          }),
        {
          retries,
          jitterSeed: index,
          onRetry: (attempt, delay, err) =>
            emit('retry', { unit, attempt, delay, error: err.message })
        }
      );
      cellUnits.get(unit.cellKey).push(raw);
    } catch (err) {
      failures.count += 1;
      emit('error', { unit, error: err.message });
    }
    totalDoneRef.n += 1;
    emit('progress', { done: totalDoneRef.n, total: workItems.length });
  };

  if (!adaptive) {
    await pool(workItems, concurrency, runOne);
  } else {
    if (!adaptiveContext?.matcher || !adaptiveContext?.db) {
      throw new Error('adaptive=true requires adaptiveContext.{matcher, db}');
    }
    await runAdaptive({
      workItems,
      cellKeys,
      cellUnits,
      runOne,
      concurrency,
      model,
      temperature,
      matcher: adaptiveContext.matcher,
      db: adaptiveContext.db,
      stopSignal,
      emit
    });
  }

  // Aggregate cells
  const cells = [];
  for (const cellKey of cellKeys) {
    const rawAnswers = cellUnits.get(cellKey);
    if (rawAnswers.length === 0) continue;
    const [task_id, lang] = cellKey.split('|');
    cells.push(buildCell(task_id, lang, temperature, rawAnswers));
  }

  emit('done', { model, cells: cells.length, failures: failures.count });

  return {
    model,
    provider: safeHostname(endpoint),
    api_type: apiType,
    temperature,
    reps,
    concurrency,
    requests: totalDoneRef.n,
    failures: failures.count,
    cells
  };
}

function buildCell(task_id, lang, temperature, rawAnswers) {
  const result = buildDistribution(rawAnswers);
  if (!result) {
    return {
      task_id,
      lang,
      temperature,
      n_valid: 0,
      n_off_format: rawAnswers.length,
      validity_rate: 0,
      dist: {},
      entropy_bits: 0,
      mode: null,
      mode_share: 0
    };
  }
  const { dist, nValid, nOffFormat, validityRate } = result;
  const entropy = computeEntropy(dist);
  const mode = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
  return {
    task_id,
    lang,
    temperature,
    n_valid: nValid,
    n_off_format: nOffFormat,
    validity_rate: validityRate,
    dist,
    entropy_bits: entropy,
    mode: mode?.[0] || null,
    mode_share: mode?.[1] || 0
  };
}

/**
 * Adaptive loop: process work in rounds of ADAPTIVE_ROUND_SIZE reps per cell.
 * After each round call the matcher; stop if top-1 model stayed the same and
 * its mean JSD ≤ ADAPTIVE_STABLE_JSD for two consecutive rounds.
 */
async function runAdaptive({
  workItems,
  cellKeys,
  cellUnits,
  runOne,
  concurrency,
  model,
  temperature,
  matcher,
  db,
  stopSignal,
  emit
}) {
  // Group work items into rounds interleaved across cells: round R contains
  // items where (rep % ADAPTIVE_ROUND_SIZE) == R MOD-mapped
  const byRep = new Map();
  for (const unit of workItems) {
    if (!byRep.has(unit.rep)) byRep.set(unit.rep, []);
    byRep.get(unit.rep).push(unit);
  }
  const sortedReps = [...byRep.keys()].sort((a, b) => a - b);

  let lastTop = null;
  let stableRounds = 0;
  let repsSoFar = 0;

  for (const rep of sortedReps) {
    const batch = byRep.get(rep);
    await pool(batch, concurrency, runOne);
    repsSoFar++;
    if (stopSignal.stop) return;

    if (repsSoFar < ADAPTIVE_MIN_REPS) continue;
    if (repsSoFar % ADAPTIVE_ROUND_SIZE !== 0) continue;

    // Build a partial probe result and run matcher
    const partialCells = [];
    for (const cellKey of cellKeys) {
      const rawAnswers = cellUnits.get(cellKey);
      if (rawAnswers.length < 2) continue;
      const [task_id, lang] = cellKey.split('|');
      partialCells.push(buildCell(task_id, lang, temperature, rawAnswers));
    }
    const m = matcher(db, { model, temperature, cells: partialCells }, { topK: 1 });
    const top = m.candidates[0];
    emit('adaptive_check', {
      reps: repsSoFar,
      top: top?.model ?? null,
      jsd: top?.mean_jsd ?? null
    });
    if (top && top.model === lastTop && top.mean_jsd <= ADAPTIVE_STABLE_JSD) {
      stableRounds += 1;
      if (stableRounds >= 2) {
        stopSignal.stop = true;
        emit('adaptive_stop', { reps: repsSoFar, top: top.model, jsd: top.mean_jsd });
        return;
      }
    } else {
      stableRounds = top && top.model === lastTop ? stableRounds : 0;
    }
    lastTop = top?.model ?? null;
  }
}

function computeEntropy(dist) {
  let bits = 0;
  for (const p of Object.values(dist)) {
    if (p > 0) bits -= p * Math.log2(p);
  }
  return Math.round(bits * 1000) / 1000;
}

function safeHostname(endpoint) {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return String(endpoint);
  }
}

export { BUDGET_CURVE, ADAPTIVE_ROUND_SIZE, ADAPTIVE_STABLE_JSD };
