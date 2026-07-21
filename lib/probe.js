/**
 * Probe an unknown LLM endpoint and build its empirical answer distribution.
 *
 * For each (task × language × rep) cell, sends a chat completion request
 * to an OpenAI-compatible or Anthropic API, collects the raw text, normalizes
 * it, and aggregates into a distribution compatible with the paper's format.
 *
 * Supports:
 *   - OpenAI API format (OpenRouter, any OpenAI-compatible provider)
 *   - Anthropic Messages API (--api anthropic)
 *   - temperature > 0 for diversity
 *   - configurable repetitions per cell
 *   - budget-curve auto-reps (--reps auto)
 */

import { TASKS, LANG, normalize } from './tasks.js';

/** Budget curve from verification.json: k → EER */
const BUDGET_CURVE = [
  { k: 4, eer: 0.132 },
  { k: 8, eer: 0.106 },
  { k: 16, eer: 0.095 },
  { k: 24, eer: 0.089 },
  { k: 40, eer: 0.073 },
];

/**
 * Resolve reps from user input.
 * `"auto"` picks the smallest k that meets the EER target.
 * A number is used as-is.
 */
export function resolveReps(repsInput, eerTarget) {
  if (repsInput === 'auto') {
    const target = eerTarget ?? 0.10;
    for (const { k, eer } of BUDGET_CURVE) {
      if (eer <= target) return k;
    }
    return 40;
  }
  const n = parseInt(repsInput, 10);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

/**
 * @param {object} opts
 * @param {string} opts.endpoint — API base URL (e.g. https://api.openai.com/v1)
 * @param {string} opts.apiKey
 * @param {string} opts.model — model slug to probe
 * @param {'openai'|'anthropic'} [opts.apiType='openai']
 * @param {number} [opts.temperature=1]
 * @param {number} [opts.reps=30]
 * @param {string[]} [opts.languages] — defaults to all 4
 * @param {number} [opts.maxTokens=16]
 * @param {(msg: string) => void} [opts.onProgress]
 * @returns {Promise<{
 *   model: string,
 *   provider: string,
 *   api_type: string,
 *   temperature: number,
 *   reps: number,
 *   cells: Array<{ task_id, lang, n_valid, n_off_format, dist, entropy_bits, mode, mode_share }>,
 *   cost_usd: number
 * }>}
 */
export async function probe(opts) {
  const { endpoint, apiKey, model, apiType = 'openai', temperature = 1, reps = 30, maxTokens = 16, onProgress } = opts;
  const languages = opts.languages || LANG;

  const log = onProgress || (() => {});
  const cells = [];
  let costUsd = 0;

  for (const lang of languages) {
    for (const task of TASKS) {
      const prompt = task.prompts[lang];
      if (!prompt) continue;

      const rawAnswers = [];

      for (let r = 0; r < reps; r++) {
        log(`[probe] ${model} | ${task.task_id} | ${lang} | rep ${r + 1}/${reps}`);

        const raw = await callApi(apiType, endpoint, apiKey, model, prompt, temperature, maxTokens);

        if (typeof raw !== 'string') {
          throw new Error(`API returned non-string content for ${task.task_id}|${lang}`);
        }
        rawAnswers.push(raw);
        // crude token-based cost estimate (prompt ~65t, completion ~3t)
        costUsd += 65 * 0.00000015 + 3 * 0.0000006;
      }

      // Build distribution from valid normalized answers
      const normalized = rawAnswers.map(r => normalize(r)).filter(Boolean);
      const validCount = normalized.length;
      const dist = {};
      for (const n of normalized) {
        dist[n] = (dist[n] || 0) + 1;
      }
      for (const k of Object.keys(dist)) {
        dist[k] = Math.round((dist[k] / validCount) * 10000) / 10000;
      }

      const entropy = computeEntropy(dist);
      const mode = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];

      cells.push({
        task_id: task.task_id,
        lang,
        temperature,
        n_valid: validCount,
        n_off_format: reps - validCount,
        validity_rate: Math.round((validCount / reps) * 10000) / 10000,
        dist,
        entropy_bits: entropy,
        mode: mode?.[0] || null,
        mode_share: mode?.[1] || 0,
      });

      log(`[probe] ${task.task_id}|${lang} done — ${validCount}/${reps} valid, mode="${mode?.[0]}" @ ${mode?.[1]}`);
    }
  }

  return {
    model,
    provider: new URL(endpoint).hostname,
    api_type: apiType,
    temperature,
    reps,
    cells,
    cost_usd: Math.round(costUsd * 100000) / 100000,
  };
}

/**
 * Send one chat-completion request, regardless of API format.
 */
async function callApi(apiType, endpoint, apiKey, model, prompt, temperature, maxTokens) {
  if (apiType === 'anthropic') {
    return callAnthropic(endpoint, apiKey, model, prompt, temperature, maxTokens);
  }
  return callOpenAI(endpoint, apiKey, model, prompt, temperature, maxTokens);
}

async function callOpenAI(endpoint, apiKey, model, prompt, temperature, maxTokens) {
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
      reasoning: { enabled: false },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'unknown');
    throw new Error(`OpenAI API error ${response.status}: ${errText}`);
  }

  const json = await response.json();
  return json.choices?.[0]?.message?.content || '';
}

async function callAnthropic(endpoint, apiKey, model, prompt, temperature, maxTokens) {
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens || 16,
      temperature,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'unknown');
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const json = await response.json();
  // Anthropic returns content as an array of blocks
  const blocks = json.content || [];
  const texts = blocks.filter(b => b.type === 'text').map(b => b.text);
  return texts.join('') || '';
}

function computeEntropy(dist) {
  let bits = 0;
  for (const p of Object.values(dist)) {
    if (p > 0) bits -= p * Math.log2(p);
  }
  return Math.round(bits * 1000) / 1000;
}

export { BUDGET_CURVE };