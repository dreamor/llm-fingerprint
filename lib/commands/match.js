import { readFileSync, existsSync } from 'node:fs';
import { match } from '../match.js';
import { warn, printVerdict } from '../cli-output.js';

export function run({ db, positional, flags }) {
  const path = positional[0];
  if (!path) {
    warn('usage: fp match <probe-result.json>');
    process.exit(1);
  }
  if (!existsSync(path)) {
    warn(`file not found: ${path}`);
    process.exit(1);
  }
  const probeResult = JSON.parse(readFileSync(path, 'utf-8'));
  const topK = parseInt(flags.top || '5', 10);
  const m = match(db, probeResult, { topK });
  printVerdict(m);
}
