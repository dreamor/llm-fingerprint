/* global fetch, AbortController */

/**
 * OpenAI-compatible chat completions provider (also covers OpenRouter,
 * Together, Groq, vLLM/TGI in OpenAI mode, Azure OpenAI, etc.).
 *
 * The `--openrouter` flag gates OpenRouter-only body extensions like
 * `reasoning: { enabled: false }` — plain OpenAI and strict compatibles
 * reject unknown fields, so we don't send them by default.
 */

import { HttpError } from '../http.js';

export const name = 'openai';

/** Normalize the completions URL from any endpoint form. */
export function chatCompletionsUrl(endpoint) {
  return `${String(endpoint).replace(/\/+$/, '')}/chat/completions`;
}

/**
 * Build the fetch options for one completion request.
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} opts.model
 * @param {string} opts.prompt
 * @param {number} opts.temperature
 * @param {number} opts.maxTokens
 * @param {object} [opts.extraBody]  extra fields merged into the body (e.g. OpenRouter's `reasoning`)
 */
export function buildRequest(opts) {
  const { apiKey, model, prompt, temperature, maxTokens, extraBody } = opts;
  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature,
    max_tokens: maxTokens,
    ...(extraBody || {})
  };
  return {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };
}

export function extractText(json) {
  return json?.choices?.[0]?.message?.content ?? '';
}

/**
 * Send one completion request. Throws HttpError on non-2xx so retry logic can
 * distinguish transient failures.
 */
export async function complete(endpoint, opts) {
  const url = chatCompletionsUrl(endpoint);
  const reqOpts = buildRequest(opts);
  const timeout = opts.timeout ?? 30000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...reqOpts, signal: controller.signal });
    if (!res.ok) {
      const body = (await res.text().catch(() => '')).slice(0, 500);
      throw new HttpError(
        res.status,
        `OpenAI API ${res.status}: ${body || res.statusText}`,
        res.headers.get('retry-after')
      );
    }
    const json = await res.json();
    return extractText(json);
  } finally {
    clearTimeout(timer);
  }
}
