/**
 * Match a probe result against the reference fingerprint database.
 *
 * The algorithm mirrors the paper's approach:
 *   1. For each reference model, compute the mean JSD across all shared
 *      (task_id, lang, temperature) cells.
 *   2. Models with zero shared cells are skipped (no score).
 *   3. Return top-K matches sorted by ascending mean JSD.
 *
 * Additional heuristics:
 *   - If the best JSD < 0.05, the match is "very confident"
 *   - If the best JSD < 0.15, the match is "plausible"
 *   - If the best JSD > 0.30, the probe model is likely unknown
 *   - Best-match family is reported alongside per-model scores
 */

import { jsd } from './jsd.js';
import { inferFamily } from './db.js';

/**
 * @param {import('./db.js').FingerprintDB} db
 * @param {object} probeResult — output of probe()
 * @param {object} [opts]
 * @param {number} [opts.topK=5] — how many results to return
 * @param {string[]} [opts.tasks] — restrict to specific task_ids
 * @param {string[]} [opts.languages] — restrict to specific languages
 * @param {number} [opts.minSharedCells=3] — skip models with fewer shared cells
 * @returns {{
 *   target: string,
 *   families_seen: string[],
 *   probe_cells: number,
 *   candidates: Array<{
 *     model: string,
 *     family: string,
 *     mean_jsd: number,
 *     shared_cells: number,
 *     per_cell: Array<{task_id, lang, jsd: number, p_dist: object, q_dist: object}>
 *   }>,
 *   verdict: { label: string, confidence: 'very_high'|'high'|'moderate'|'low'|'unknown' }
 * }}
 */
export function match(db, probeResult, opts = {}) {
  const { topK = 5, minSharedCells = 3 } = opts;
  const probeCells = probeResult.cells.filter(c => c.temperature === (probeResult.temperature || 1) && c.n_valid >= 2);

  if (probeCells.length === 0) {
    return {
      target: probeResult.model,
      families_seen: [],
      probe_cells: 0,
      candidates: [],
      verdict: { label: 'no data — probe produced no valid cells', confidence: 'unknown' },
    };
  }

  // Build probe lookup
  const probeMap = new Map();
  for (const c of probeCells) {
    const key = `${c.task_id}|${c.lang}|t=${c.temperature}`;
    probeMap.set(key, c.dist);
  }

  const familiesSeen = new Set();
  const candidates = [];

  for (const { model, cells: refCells } of db.entries()) {
    const family = inferFamily(model);
    familiesSeen.add(family);

    const perCell = [];

    for (const [cellKey, refRec] of refCells) {
      const probeDist = probeMap.get(cellKey);
      if (!probeDist) continue;
      const d = jsd(probeDist, refRec.dist);
      if (d === Infinity) continue; // disjoint support → skip this cell
      perCell.push({
        task_id: refRec.task_id,
        lang: refRec.lang,
        temperature: refRec.temperature,
        jsd: Math.round(d * 10000) / 10000,
      });
    }

    if (perCell.length < minSharedCells) continue;

    const meanJsd = perCell.reduce((s, c) => s + c.jsd, 0) / perCell.length;
    candidates.push({
      model,
      family,
      mean_jsd: Math.round(meanJsd * 10000) / 10000,
      shared_cells: perCell.length,
      per_cell: perCell,
    });
  }

  // Sort by ascending mean JSD
  candidates.sort((a, b) => a.mean_jsd - b.mean_jsd);

  // Compute verdict
  const best = candidates[0];
  let label, confidence;
  if (!best) {
    label = 'no match — no shared cells with any reference model';
    confidence = 'unknown';
  } else if (best.mean_jsd < 0.05) {
    label = `matches ${best.model} (JSD=${best.mean_jsd.toFixed(4)}) — very high confidence`;
    confidence = 'very_high';
  } else if (best.mean_jsd < 0.10) {
    label = `most like ${best.model} (JSD=${best.mean_jsd.toFixed(4)}) — high confidence`;
    confidence = 'high';
  } else if (best.mean_jsd < 0.20) {
    label = `resembles ${best.model} (JSD=${best.mean_jsd.toFixed(4)}) — moderate confidence`;
    confidence = 'moderate';
  } else if (best.mean_jsd < 0.30) {
    label = `loose resemblance to ${best.model} (JSD=${best.mean_jsd.toFixed(4)}) — low confidence`;
    confidence = 'low';
  } else {
    label = `no close match — best JSD=${best.mean_jsd.toFixed(4)} — likely an unknown model`;
    confidence = 'unknown';
  }

  return {
    target: probeResult.model || 'unknown',
    families_seen: [...familiesSeen].sort(),
    probe_cells: probeCells.length,
    candidates: candidates.slice(0, topK),
    verdict: { label, confidence },
  };
}