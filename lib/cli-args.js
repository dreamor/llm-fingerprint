/**
 * Tiny arg parser. Enough for this CLI, avoids adding a dependency.
 *
 * Handles:
 *   --flag value       → flags.flag = "value"
 *   --flag=value       → flags.flag = "value"
 *   --bool             → flags.bool = true (only if the next arg starts with "-" or is absent)
 *   positional args    → returned in `positional`
 *
 * Unknown flags are still captured (permissive by design — we validate
 * required flags at the command level).
 */

import { readFileSync } from 'node:fs';

export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
        continue;
      }
      const key = arg.slice(2);
      const nxt = argv[i + 1];
      if (nxt === undefined || nxt.startsWith('-')) {
        flags[key] = true;
      } else {
        flags[key] = nxt;
        i++;
      }
      continue;
    }
    positional.push(arg);
  }
  return { flags, positional };
}

/**
 * Resolve an API key from the various supported sources, in order:
 *   1. Positional arg (backwards compat — printed with a warning)
 *   2. --api-key-env <NAME>  → read from process.env[NAME]
 *   3. --api-key-file <path> → read the first non-empty line
 *   4. Environment: LLM_FINGERPRINT_KEY, then OPENAI_API_KEY / ANTHROPIC_API_KEY based on apiType
 *
 * Returns { key, source } or throws with an actionable message.
 */
export function resolveApiKey({ positional, flags, apiType, warn }) {
  if (positional && positional !== '-') {
    // Positional keys are visible in `ps` and shell history. Discourage silently.
    warn?.(
      'api key passed positionally is visible in `ps` output; prefer --api-key-env or --api-key-file'
    );
    return { key: positional, source: 'positional' };
  }
  if (flags['api-key-env']) {
    const name = flags['api-key-env'];
    const val = process.env[name];
    if (!val) throw new Error(`env var ${name} is empty or unset`);
    return { key: val, source: `env:${name}` };
  }
  if (flags['api-key-file']) {
    const raw = readFileSync(flags['api-key-file'], 'utf-8');
    const key = raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find(Boolean);
    if (!key) throw new Error(`api key file is empty: ${flags['api-key-file']}`);
    return { key, source: `file:${flags['api-key-file']}` };
  }
  const envFallbacks = ['LLM_FINGERPRINT_KEY'];
  if (apiType === 'anthropic') envFallbacks.push('ANTHROPIC_API_KEY');
  else envFallbacks.push('OPENAI_API_KEY');
  for (const name of envFallbacks) {
    if (process.env[name]) return { key: process.env[name], source: `env:${name}` };
  }
  throw new Error(
    `no api key — pass positionally, use --api-key-env NAME, --api-key-file PATH, or set one of: ${envFallbacks.join(', ')}`
  );
}
