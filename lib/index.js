/**
 * Public SDK entry point.
 *
 * Programmatic consumers do:
 *   import { probe, match, FingerprintDB } from 'llm-fingerprint';
 *
 * The CLI is a thin wrapper over the same modules.
 */

export { probe, resolveReps, BUDGET_CURVE, anthropicMessagesUrl } from './probe.js';
export { match } from './match.js';
export { FingerprintDB, inferFamily, bootstrapReference } from './db.js';
export { jsd } from './jsd.js';
export { TASKS, LANG, normalize, buildDistribution } from './tasks.js';
export { classificationVerdict, verificationVerdict, tierFor, TIERS } from './verdict.js';
export { getProvider, listProviders } from './providers/index.js';
export { withRetry, pool, HttpError } from './http.js';
export { parseCSV } from './csv.js';
export { validateDistribution, validateDistributions } from './schema.js';
export {
  userReferencePath,
  bundledReferencePath,
  bundledDistributionsPath,
  userDataDir
} from './paths.js';
