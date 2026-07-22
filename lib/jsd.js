/**
 * Jensen-Shannon Divergence (JSD)
 *
 * The paper's core metric — symmetric, bounded [0, 1] (when using log2),
 * and well-behaved even when distributions have disjoint support.
 *
 * JSD(P ‖ Q) = ½KL(P ‖ M) + ½KL(Q ‖ M)  where M = ½(P + Q)
 */

function kl(p, q) {
  let sum = 0;
  for (const k of Object.keys(p)) {
    const pi = p[k];
    if (pi === 0) continue; // 0 * log(0/q) = 0 by convention
    const qi = q[k];
    if (qi === undefined || qi === 0) return Infinity;
    sum += pi * Math.log2(pi / qi);
  }
  return sum;
}

/**
 * Compute JSD between two discrete probability distributions.
 * @param {Record<string,number>} p — e.g. {"3": 0.5, "7": 0.5}
 * @param {Record<string,number>} q — same shape
 * @returns {number} JSD in bits (log2). 0 = identical, approaches 1 for very different.
 */
export function jsd(p, q) {
  const keys = new Set([...Object.keys(p), ...Object.keys(q)]);
  const m = {};
  for (const k of keys) m[k] = ((p[k] || 0) + (q[k] || 0)) / 2;
  return 0.5 * kl(p, m) + 0.5 * kl(q, m);
}
