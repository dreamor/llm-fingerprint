import { existsSync } from 'node:fs';
import { bootstrapReference } from '../db.js';
import { bundledDistributionsPath, userReferencePath } from '../paths.js';
import { warn } from '../cli-output.js';

export function run({ positional }) {
  const src = positional[0] || bundledDistributionsPath();
  if (!existsSync(src)) {
    warn(`file not found: ${src}`);
    process.exit(1);
  }
  const { outPath, modelCount, cellCount } = bootstrapReference(src, userReferencePath());
  warn(`bootstrapped ${modelCount} models (${cellCount} cells) → ${outPath}`);
}
