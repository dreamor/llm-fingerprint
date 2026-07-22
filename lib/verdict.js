/**
 * Verdict tier — shared by `match` (confidence classification) and `verify`
 * (compliance audit against a claimed identity). Both used to inline slightly
 * different threshold tables; this module centralizes them.
 *
 * Tiers here are ordered from best to worst. Each entry has:
 *   - `key`: stable identifier for programmatic checks
 *   - `maxJsd`: upper bound (exclusive) — the tier applies when mean_jsd < maxJsd
 *   - `label`: short user-facing label
 */

const TIERS = [
  { key: 'very_high', maxJsd: 0.05, label: 'very high confidence — exact match' },
  { key: 'high', maxJsd: 0.1, label: 'high confidence — same or very close variant' },
  { key: 'moderate', maxJsd: 0.2, label: 'moderate confidence — same family' },
  { key: 'low', maxJsd: 0.3, label: 'low confidence — loose resemblance' },
  { key: 'unknown', maxJsd: Infinity, label: 'unknown — not in reference library' }
];

/** Look up the tier a given mean JSD falls into. */
export function tierFor(jsd) {
  for (const t of TIERS) {
    if (jsd < t.maxJsd) return t;
  }
  return TIERS[TIERS.length - 1];
}

/**
 * Build a matcher verdict — used by `fp match`, `fp probe`, `fp fingerprint`.
 * @param {{model: string, mean_jsd: number} | null} best
 * @returns {{ label: string, confidence: string }}
 */
export function classificationVerdict(best) {
  if (!best) {
    return { label: 'no match — no shared cells with any reference model', confidence: 'unknown' };
  }
  const tier = tierFor(best.mean_jsd);
  const jsdStr = best.mean_jsd.toFixed(4);
  const phrase = {
    very_high: `matches ${best.model} (JSD=${jsdStr}) — very high confidence`,
    high: `most like ${best.model} (JSD=${jsdStr}) — high confidence`,
    moderate: `resembles ${best.model} (JSD=${jsdStr}) — moderate confidence`,
    low: `loose resemblance to ${best.model} (JSD=${jsdStr}) — low confidence`,
    unknown: `no close match — best JSD=${jsdStr} — likely an unknown model`
  }[tier.key];
  return { label: phrase, confidence: tier.key };
}

/**
 * Build a compliance verdict for `fp verify`, comparing observed JSD against
 * the model the caller claimed. Same threshold table as classification, so
 * users don't see contradictory "high confidence" + "verification weak".
 *
 * @param {number} jsd — mean JSD of the claimed model
 * @param {string} claimed — the model name the caller passed
 * @param {string | null} bestAlternative — best-matching model in the library (may equal claimed)
 * @returns {{ status: 'passed'|'weak'|'suspicious'|'failed', label: string, icon: string, detail?: string }}
 */
export function verificationVerdict(jsd, claimed, bestAlternative) {
  const tier = tierFor(jsd);
  const jsdStr = jsd.toFixed(4);
  if (tier.key === 'very_high' || tier.key === 'high') {
    return {
      status: 'passed',
      icon: '✅',
      label: `VERIFICATION PASSED — "${claimed}" confirmed (JSD=${jsdStr}).`
    };
  }
  if (tier.key === 'moderate') {
    return {
      status: 'weak',
      icon: '⚠',
      label: `VERIFICATION WEAK — "${claimed}" JSD=${jsdStr}.`,
      detail:
        'Behavior is in the same family but the fingerprint is not clean. Possible: model update, quantization, or provider routing variance.'
    };
  }
  if (tier.key === 'low') {
    return {
      status: 'suspicious',
      icon: '❌',
      label: `VERIFICATION SUSPICIOUS — "${claimed}" JSD=${jsdStr}.`,
      detail:
        bestAlternative && bestAlternative !== claimed
          ? `Only a loose match. Best alternative in reference: ${bestAlternative}.`
          : 'Only a loose match against the claimed model.'
    };
  }
  return {
    status: 'failed',
    icon: '❌',
    label: `VERIFICATION FAILED — "${claimed}" JSD=${jsdStr}.`,
    detail:
      bestAlternative && bestAlternative !== claimed
        ? `Actual behavior does not match the claimed model. Best match instead: ${bestAlternative}.`
        : 'Actual behavior does not match the claimed model.'
  };
}

export { TIERS };
