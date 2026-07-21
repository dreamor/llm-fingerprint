/**
 * Provider registry. Each provider knows how to:
 *   - assemble the correct endpoint URL for a given base
 *   - build the HTTP request (headers + body) for one completion
 *   - extract the raw text from the response payload
 *   - estimate per-request cost (best-effort; nullable)
 *
 * Add a new provider by creating `lib/providers/<name>.js` that exports the
 * shape below and registering it here.
 */

import * as openai from './openai.js';
import * as anthropic from './anthropic.js';

const REGISTRY = { openai, anthropic };

export function getProvider(name) {
  const p = REGISTRY[name];
  if (!p) throw new Error(`unknown provider: ${name} (known: ${Object.keys(REGISTRY).join(', ')})`);
  return p;
}

export function listProviders() {
  return Object.keys(REGISTRY);
}
