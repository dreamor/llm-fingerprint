/**
 * Minimal stderr progress renderer. TTY only — falls back to periodic warn
 * lines when stderr isn't a terminal (CI, piped output). Zero deps.
 *
 * Usage:
 *   const p = createProgress({ total: 1800, label: 'probing gpt-4o' });
 *   p.tick();       // increment done
 *   p.update(500);  // set done to 500
 *   p.done();       // finalize (clears the line in TTY mode)
 */

const BAR_WIDTH = 24;

export function createProgress({
  total,
  label = '',
  stream = process.stderr,
  minIntervalMs = 100
}) {
  const isTTY = Boolean(stream.isTTY);
  let done = 0;
  let lastRender = 0;

  const render = (force = false) => {
    const now = Date.now();
    if (!force && now - lastRender < minIntervalMs) return;
    lastRender = now;

    const pct = total > 0 ? done / total : 0;
    const filled = Math.round(pct * BAR_WIDTH);
    const bar = '█'.repeat(filled) + '░'.repeat(Math.max(0, BAR_WIDTH - filled));
    const pctStr = `${(pct * 100).toFixed(1).padStart(5)}%`;
    const line = `[fp] ${label} ${bar} ${pctStr} (${done}/${total})`;

    if (isTTY) {
      stream.write(`\r${line}`);
    } else if (force || done === total || done % Math.max(1, Math.floor(total / 20)) === 0) {
      // Non-TTY: emit occasional milestone lines (every 5%)
      stream.write(`${line}\n`);
    }
  };

  return {
    tick(n = 1) {
      done += n;
      render();
    },
    update(value) {
      done = value;
      render();
    },
    done() {
      done = total;
      render(true);
      if (isTTY) stream.write('\n');
    },
    get value() {
      return done;
    },
    get total() {
      return total;
    }
  };
}
