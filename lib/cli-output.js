/** Shared CLI output helpers. */

export function warn(msg) {
  console.error(`[fp] ${msg}`);
}

export function printVerdict(m) {
  console.log(`\n═══════════════════════════════════════`);
  console.log(`  Target:        ${m.target}`);
  console.log(`  Verdict:       ${m.verdict.label}`);
  console.log(`  Confidence:    ${m.verdict.confidence}`);
  if (m.min_shared_cells) {
    console.log(`  Min shared:    ${m.min_shared_cells} of ${m.probe_cells} cells`);
  }
  console.log(`───────────────────────────────────────`);
  if (m.candidates.length > 0) {
    console.log(`  Top matches:`);
    for (const c of m.candidates) {
      const barLen = Math.max(1, Math.round((1 - Math.min(c.mean_jsd, 1)) * 20));
      const bar = '█'.repeat(barLen) + '░'.repeat(Math.max(0, 20 - barLen));
      console.log(
        `    ${bar}  ${c.model.padEnd(40)} JSD=${c.mean_jsd.toFixed(4)}  (${c.shared_cells} cells)`
      );
    }
  }
  console.log(`═══════════════════════════════════════\n`);
}
