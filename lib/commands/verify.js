import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { match } from '../match.js';
import { probe, resolveReps } from '../probe.js';
import { warn, printVerdict } from '../cli-output.js';
import { resolveApiKey } from '../cli-args.js';
import { createProgress } from '../progress.js';
import { verificationVerdict } from '../verdict.js';
import { userDataDir } from '../paths.js';

export async function run({ db, positional, flags }) {
  const endpoint = positional[0];
  const apiKeyPositional = positional[1];
  const claimedModel = positional[2];
  if (!endpoint || !claimedModel) {
    warn(
      'usage: fp verify <endpoint> [<api-key>|-] <claimed-model> [--reps 16] [--api openai|anthropic]'
    );
    process.exit(1);
  }

  const apiType = flags.api || 'openai';
  const { key: apiKey, source } = resolveApiKey({
    positional: apiKeyPositional,
    flags,
    apiType,
    warn
  });
  if (source !== 'positional') warn(`api key source: ${source}`);

  const reps = resolveReps(flags.reps || '16', 0.1);
  const languages = flags.langs ? flags.langs.split(',').filter(Boolean) : ['en'];
  const concurrency = parseInt(flags.concurrency || '4', 10);
  const extraBody = flags.openrouter ? { reasoning: { enabled: false } } : undefined;

  console.log(`\nVerifying ${claimedModel} …`);
  console.log(`  endpoint:    ${endpoint}`);
  console.log(`  api type:    ${apiType}`);
  console.log(`  reps:        ${reps}`);
  console.log(`  concurrency: ${concurrency}\n`);

  const bar = createProgress({
    total: reps * 15 * languages.length,
    label: `verify ${claimedModel}`
  });
  const result = await probe({
    endpoint,
    apiKey,
    model: claimedModel,
    apiType,
    temperature: 1,
    reps,
    languages,
    concurrency,
    extraBody,
    onEvent: (ev) => {
      if (ev.type === 'progress') bar.update(ev.done);
      else if (ev.type === 'error') warn(`request failed: ${ev.error}`);
    }
  });
  bar.done();

  const outDir = join(userDataDir(), 'runs', `verify-${Date.now()}`);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'result.json'), JSON.stringify(result, null, 2));

  console.log(`\nProbe done — ${result.requests} requests, ${result.failures} failures\n`);

  const m = match(db, result);
  printVerdict(m);

  const claimedInLib = db.listModels().includes(claimedModel);
  if (!claimedInLib) {
    console.log(`  ⚠  "${claimedModel}" is not in the reference library.`);
    console.log(`     Verification is limited to family-level inference.\n`);
    console.log(`═══════════════════════════════════════\n`);
    return;
  }

  const claimedEntry = m.candidates.find((c) => c.model === claimedModel);
  if (!claimedEntry) {
    console.log(
      `  ❌ VERIFICATION FAILED — "${claimedModel}" did not clear the shared-cells threshold.`
    );
    console.log(`═══════════════════════════════════════\n`);
    return;
  }

  const best = m.candidates[0];
  const v = verificationVerdict(claimedEntry.mean_jsd, claimedModel, best?.model);
  console.log(`  ${v.icon} ${v.label}`);
  if (v.detail) console.log(`     ${v.detail}`);
  console.log(`═══════════════════════════════════════\n`);
}
