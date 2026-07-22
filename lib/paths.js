/**
 * Platform-appropriate paths for user-mutable data.
 *
 * The reference library is read from (in priority order):
 *   1. $LLM_FINGERPRINT_HOME/reference.json (explicit override)
 *   2. User data dir (XDG_DATA_HOME on Linux, ~/Library/Application Support on
 *      macOS, %LOCALAPPDATA% on Windows)
 *   3. Bundled data/reference.json inside the package (read-only fallback)
 *
 * Writes always go to the user data dir. This lets `fp import` work under a
 * global npm install where the package directory is root-owned.
 */

import { homedir, platform } from 'node:os';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const APP_NAME = 'llm-fingerprint';
const DIR = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(DIR, '..');

/** Returns the platform-appropriate app data directory (does not create it). */
export function userDataDir() {
  if (process.env.LLM_FINGERPRINT_HOME) return process.env.LLM_FINGERPRINT_HOME;
  const home = homedir();
  const plat = platform();
  if (plat === 'darwin') return join(home, 'Library', 'Application Support', APP_NAME);
  if (plat === 'win32')
    return join(process.env.LOCALAPPDATA || join(home, 'AppData', 'Local'), APP_NAME);
  return join(process.env.XDG_DATA_HOME || join(home, '.local', 'share'), APP_NAME);
}

/** Absolute path where writes land. */
export function userReferencePath() {
  return join(userDataDir(), 'reference.json');
}

/** Bundled read-only reference file shipped with the package. */
export function bundledReferencePath() {
  return join(PKG_ROOT, 'data', 'reference.json');
}

/** Source distributions file shipped with the package (used by bootstrap). */
export function bundledDistributionsPath() {
  return join(PKG_ROOT, 'results', 'distributions.json');
}

/**
 * Pick the first reference file that exists, preferring user-writable location.
 * Returns null if none exist yet.
 */
export function resolveReferencePath() {
  const user = userReferencePath();
  if (existsSync(user)) return user;
  const bundled = bundledReferencePath();
  if (existsSync(bundled)) return bundled;
  return null;
}

export { PKG_ROOT };
