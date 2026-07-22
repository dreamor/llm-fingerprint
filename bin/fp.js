#!/usr/bin/env node
/**
 * fp — LLM Fingerprint CLI (thin router)
 *
 * Each subcommand lives in `lib/commands/*`. This file only:
 *   1. parses argv into { flags, positional }
 *   2. resolves the reference DB (with lazy bootstrap fallback)
 *   3. dispatches to the command module
 */

import { existsSync } from 'node:fs';
import { FingerprintDB, bootstrapReference } from '../lib/db.js';
import { parseArgs } from '../lib/cli-args.js';
import { warn } from '../lib/cli-output.js';
import { bundledDistributionsPath, userReferencePath } from '../lib/paths.js';

const HELP = `
Usage:
  fp probe <endpoint> [<api-key>|-] <model> [--reps N|auto] [--langs en,zh] [--api openai|anthropic] [--concurrency 4] [--adaptive] [--openrouter]
  fp verify <endpoint> [<api-key>|-] <claimed-model> [--reps 16] [--api openai|anthropic] [--concurrency 4] [--openrouter]
  fp match <probe-result.json> [--top 5]
  fp fingerprint <answers.csv> [--model <label>] [--save]
  fp list [--family <name>]
  fp import <responses.jsonl> --model <name>
  fp remove <model-slug>
  fp bootstrap [distributions.json]        (default: bundled results/distributions.json)
  fp help

API key sources (in priority order):
  <positional>           — visible in \`ps\`; discouraged
  --api-key-env NAME     — read from process.env[NAME]
  --api-key-file PATH    — first non-empty line of the file
  env fallback           — LLM_FINGERPRINT_KEY, then OPENAI_API_KEY / ANTHROPIC_API_KEY

Examples:
  fp probe https://api.openai.com/v1 --api-key-env OPENAI_API_KEY gpt-4o --reps 16 --langs en
  fp probe https://api.anthropic.com --api-key-env ANTHROPIC_API_KEY claude-sonnet-5 --api anthropic --reps auto
  fp fingerprint ./answers.csv --save --model "acme/mystery-model"
  fp verify https://api.openai.com/v1 --api-key-env OPENAI_API_KEY gpt-4o --reps 16
  fp list --family claude
  fp import ./raw/responses.jsonl --model "anthropic/claude-sonnet-5"
  fp remove anthropic/deprecated-model
  fp bootstrap
`.trim();

const COMMANDS = {
  probe: () => import('../lib/commands/probe.js'),
  verify: () => import('../lib/commands/verify.js'),
  match: () => import('../lib/commands/match.js'),
  fingerprint: () => import('../lib/commands/fingerprint.js'),
  list: () => import('../lib/commands/list.js'),
  import: () => import('../lib/commands/import.js'),
  remove: () => import('../lib/commands/remove.js'),
  bootstrap: () => import('../lib/commands/bootstrap.js')
};

/** Commands that DON'T need the reference DB loaded first. */
const STANDALONE = new Set(['bootstrap', 'help']);

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(HELP);
    return;
  }

  const loader = COMMANDS[cmd];
  if (!loader) {
    warn(`unknown command: ${cmd}\n\n${HELP}`);
    process.exit(1);
  }

  const { flags, positional } = parseArgs(argv.slice(1));

  let db = null;
  if (!STANDALONE.has(cmd)) {
    db = new FingerprintDB();
    db.load();
    if (db.n === 0) {
      // Lazy-bootstrap from bundled distributions.json so freshly-installed
      // users (esp. via `npm i -g`) don't hit an empty library.
      const bundled = bundledDistributionsPath();
      if (existsSync(bundled)) {
        warn('reference library empty — auto-bootstrapping from bundled distributions.json…');
        try {
          const { modelCount, cellCount, outPath } = bootstrapReference(
            bundled,
            userReferencePath()
          );
          warn(`bootstrapped ${modelCount} models (${cellCount} cells) → ${outPath}`);
          db = new FingerprintDB();
          db.load();
        } catch (e) {
          warn(`auto-bootstrap failed: ${e.message}`);
          warn(`run manually:  fp bootstrap "${bundled}"`);
          process.exit(1);
        }
      }
      if (db.n === 0) {
        warn('reference library empty — run "fp bootstrap" first');
        process.exit(1);
      }
    }
  }

  const mod = await loader();
  await mod.run({ db, flags, positional });
}

main().catch((err) => {
  warn(err.message || String(err));
  process.exit(1);
});
