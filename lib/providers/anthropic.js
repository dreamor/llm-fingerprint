/* global fetch, AbortController */

/**
 * Anthropic Messages API provider.
 *
 * Handles both `https://api.anthropic.com` and `https://api.anthropic.com/v1`
 * as the base — the previous version silently 404'd when users copied the
 * README example verbatim.
 */

import { HttpError } from '../http.js';

export const name = 'anthropic';

/** Build the canonical /v1/messages URL from any endpoint form. */
export function messagesUrl(endpoint) {
  const base = String(endpoint).replace(/\/+$/, '');
  return /\/v\d+$/.test(base) ? `${base}/messages` : `${base}/v1/messages`;
}

export function buildRequest(opts) {
  const { apiKey, model, prompt, temperature, maxTokens } = opts;
  return {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens || 16,
      temperature,
      messages: [{ role: 'user', content: prompt }]
    })
  };
}

export function extractText(json) {
  const blocks = json?.content || [];
  return blocks
    .filter((b) => b?.type === 'text')
    .map((b) => b.text)
    .join('');
}

export async function complete(endpoint, opts) {
  const url = messagesUrl(endpoint);
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
        `Anthropic API ${res.status}: ${body || res.statusText}`,
        res.headers.get('retry-after')
      );
    }
    const json = await res.json();
    return extractText(json);
  } finally {
    clearTimeout(timer);
  }
}
