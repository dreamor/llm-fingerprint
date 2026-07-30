import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { match } from '../match.js';
import { probe, resolveReps, BUDGET_CURVE } from '../probe.js';
import { LANG } from '../tasks.js';
import { warn, printVerdict } from '../cli-output.js';
import { resolveApiKey } from '../cli-args.js';
import { createProgress } from '../progress.js';
import { userDataDir } from '../paths.js';

export async function run({ db, positional, flags }) {
  const endpoint = positional[0];
  const apiKeyPositional = positional[1];
  const model = positional[2];
  if (!endpoint || !model) {
    warn(
      'usage: fp probe <endpoint> [<api-key>|-] <model> [--reps N|auto] [--langs en,zh] [--api openai|anthropic] [--concurrency 4] [--adaptive]'
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

  const repsRaw = flags.reps || '30';
  const eerTarget = flags.eer ? parseFloat(flags.eer) : 0.1;
  const reps = resolveReps(repsRaw, eerTarget);
  const languages = flags.langs ? flags.langs.split(',').filter(Boolean) : LANG;
  const concurrency = parseInt(flags.concurrency || '4', 10);
  const adaptive = Boolean(flags.adaptive);
  const extraBody = flags.openrouter ? { reasoning: { enabled: false } } : undefined;

  console.log(`\nProbing ${model} …`);
  console.log(`  endpoint:    ${endpoint}`);
  console.log(`  api type:    ${apiType}`);
  console.log(`  languages:   ${languages.join(', ')}`);
  console.log(
    `  reps:        ${reps}${repsRaw === 'auto' ? ` (auto — budget EER ≤ ${(eerTarget * 100).toFixed(0)}%)` : ''}`
  );
  console.log(`  concurrency: ${concurrency}`);
  if (adaptive) console.log(`  adaptive:    early-stop enabled`);
  if (flags.openrouter) console.log(`  openrouter:  sending reasoning: { enabled: false }`);
  console.log();

  const bar = createProgress({ total: reps * 15 * languages.length, label: `probe ${model}` });
  let lastRetryLog = 0;
  const result = await probe({
    endpoint,
    apiKey,
    model,
    apiType,
    temperature: 1,
    reps,
    languages,
    concurrency,
    extraBody,
    adaptive,
    adaptiveContext: adaptive ? { matcher: match, db } : undefined,
    onEvent: (ev) => {
      if (ev.type === 'progress') bar.update(ev.done);
      else if (ev.type === 'retry') {
        // Rate-limit retry log lines so a rate-limited run doesn't drown the progress bar
        if (Date.now() - lastRetryLog > 500) {
          warn(`retry #${ev.attempt} in ${ev.delay}ms: ${ev.error}`);
          lastRetryLog = Date.now();
        }
      } else if (ev.type === 'error') {
        warn(`request failed permanently (${ev.unit.task_id}|${ev.unit.lang}): ${ev.error}`);
      } else if (ev.type === 'adaptive_stop') {
        warn(`adaptive early-stop at ${ev.reps} reps — top=${ev.top} JSD=${ev.jsd.toFixed(4)}`);
      }
    }
  });
  bar.done();

  const ts = Date.now();
  const outDir = join(userDataDir(), 'runs', `probe-${ts}`);
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'result.json');
  writeFileSync(outPath, JSON.stringify(result, null, 2));

  console.log(`\nProbe complete — ${result.requests} requests, ${result.failures} failures`);
  console.log(`Saved to ${outPath}\n`);

  const m = match(db, result, { topK: parseInt(flags.top || '5', 10) });
  printVerdict(m);
}

export { BUDGET_CURVE };
