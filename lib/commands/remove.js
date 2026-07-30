import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { warn } from '../cli-output.js';
import { userReferencePath, bundledReferencePath } from '../paths.js';

/**
 * Remove a model from the user's reference library. Writes to user data dir,
 * never touches the bundled read-only copy.
 */
export function run({ db, positional }) {
  const model = positional[0];
  if (!model) {
    warn('usage: fp remove <model-slug>');
    process.exit(1);
  }
  const count = db.removeModel(model);
  if (count === 0) {
    warn(`model not found: ${model}`);
    process.exit(1);
  }

  const target = userReferencePath();
  let existing = [];
  const src = existsSync(target)
    ? target
    : existsSync(bundledReferencePath())
      ? bundledReferencePath()
      : null;
  if (src) {
    let data;
    try {
      data = JSON.parse(readFileSync(src, 'utf-8'));
    } catch (err) {
      warn(`failed to parse ${src}: ${err.message} — run "fp bootstrap" to rebuild`);
      process.exit(1);
    }
    existing = (data.distributions || data).filter((r) => r.model !== model);
  }

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(
    target,
    JSON.stringify(
      {
        generated_utc: new Date().toISOString(),
        n_cells: existing.length,
        distributions: existing
      },
      null,
      2
    )
  );

  warn(`removed ${count} cells for ${model} → ${target}`);
}
