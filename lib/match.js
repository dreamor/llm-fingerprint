/**
 * Match a probe result against the reference fingerprint database.
 *
 * The algorithm mirrors the paper's approach:
 *   1. For each reference model, compute the mean JSD across all shared
 *      (task_id, lang, temperature) cells.
 *   2. Models with fewer than `minSharedCells` shared cells are skipped.
 *   3. Return top-K matches sorted by ascending mean JSD, with ties broken by
 *      shared_cells DESC (a model matching on more cells beats a model matching
 *      on the same JSD but fewer cells — prevents artificial wins from a
 *      single deterministic cell like `secret-password`).
 *
 * Verdict tier thresholds live in `./verdict.js` and are shared with the
 * `verify` command so users don't see contradictory phrasing.
 */

import { jsd } from './jsd.js';
import { inferFamily } from './db.js';
import { classificationVerdict } from './verdict.js';

/**
 * @param {import('./db.js').FingerprintDB} db
 * @param {object} probeResult — output of probe()
 * @param {object} [opts]
 * @param {number} [opts.topK=5]
 * @param {number} [opts.minSharedCells=6]  raised from 3 — a model matching on only 3 of
 *   ~60 cells is almost never a real signal, especially when `secret-password` is one of them
 */
export function match(db, probeResult, opts = {}) {
  const { topK = 5, minSharedCells = 6 } = opts;
  const probeCells = probeResult.cells.filter(
    (c) => c.temperature === (probeResult.temperature || 1) && c.n_valid >= 2
  );

  if (probeCells.length === 0) {
    return {
      target: probeResult.model,
      families_seen: [],
      probe_cells: 0,
      candidates: [],
      verdict: { label: 'no data — probe produced no valid cells', confidence: 'unknown' }
    };
  }

  const probeMap = new Map();
  for (const c of probeCells) {
    const key = `${c.task_id}|${c.lang}|t=${c.temperature}`;
    probeMap.set(key, c.dist);
  }

  const familiesSeen = new Set();
  const candidates = [];
  const effectiveMin = Math.min(minSharedCells, Math.max(3, Math.floor(probeCells.length * 0.4)));

  for (const { model, cells: refCells } of db.entries()) {
    const family = inferFamily(model);
    familiesSeen.add(family);
    const perCell = [];

    for (const [cellKey, refRec] of refCells) {
      const probeDist = probeMap.get(cellKey);
      if (!probeDist) continue;
      const d = jsd(probeDist, refRec.dist);
      if (d === Infinity) continue;
      perCell.push({
        task_id: refRec.task_id,
        lang: refRec.lang,
        temperature: refRec.temperature,
        jsd: Math.round(d * 10000) / 10000
      });
    }

    if (perCell.length < effectiveMin) continue;

    const meanJsd = perCell.reduce((s, c) => s + c.jsd, 0) / perCell.length;
    candidates.push({
      model,
      family,
      mean_jsd: Math.round(meanJsd * 10000) / 10000,
      shared_cells: perCell.length,
      per_cell: perCell
    });
  }

  // Sort by JSD ascending; tie-break by shared_cells descending.
  candidates.sort((a, b) => a.mean_jsd - b.mean_jsd || b.shared_cells - a.shared_cells);

  return {
    target: probeResult.model || 'unknown',
    families_seen: [...familiesSeen].sort(),
    probe_cells: probeCells.length,
    min_shared_cells: effectiveMin,
    candidates: candidates.slice(0, topK),
    verdict: classificationVerdict(candidates[0] || null)
  };
}
