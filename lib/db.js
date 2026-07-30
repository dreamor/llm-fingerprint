/**
 * Reference fingerprint database.
 *
 * Wraps the paper's `distributions.json` format:
 *   distributions: [{ model, task_id, lang, temperature, n_valid, dist, ... }]
 *
 * In-memory index: Map<model, Map<cellKey, Distribution>>
 *   where cellKey = `${task_id}|${lang}|t=${temperature}`
 *
 * Persistence layout (in priority order):
 *   1. $LLM_FINGERPRINT_HOME/reference.json
 *   2. User data dir (macOS: Application Support, Linux: XDG_DATA_HOME, Win: LOCALAPPDATA)
 *   3. Bundled package data/reference.json (read-only fallback)
 *
 * Writes always go to the user data path (created if missing). This lets
 * `fp import` work under a global npm install without root.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { resolveReferencePath, userReferencePath, bundledReferencePath } from './paths.js';

/** Resolve the effective default path. Setting LLM_FINGERPRINT_HOME isolates the DB to that HOME. */
function defaultReferencePath() {
  if (process.env.LLM_FINGERPRINT_HOME) return userReferencePath();
  return resolveReferencePath() || bundledReferencePath();
}

export class FingerprintDB {
  /**
   * @param {string} [path] — path to reference.json (defaults to first available)
   * @param {object} [opts]
   * @param {number[]} [opts.temperatures=[1]] — which temperatures to include
   */
  constructor(path, opts = {}) {
    this.path = path || defaultReferencePath();
    this.temperatures = opts.temperatures || [1];
    /** Map<model, Map<cellKey, Distribution>> */
    this._index = new Map();
    /** How many distinct models */
    this.n = 0;
  }

  cellKey(taskId, lang, temperature) {
    return `${taskId}|${lang}|t=${temperature}`;
  }

  /** Load from the on-disk reference file (no-op if not found). */
  load() {
    if (!existsSync(this.path)) return;
    let data;
    try {
      data = JSON.parse(readFileSync(this.path, 'utf-8'));
    } catch (err) {
      throw new Error(
        `failed to parse reference library at ${this.path}: ${err.message}\n` +
          'Run "fp bootstrap" to rebuild it.',
        { cause: err }
      );
    }
    this._ingest(data.distributions || data);
  }

  /** Ingest raw distribution records (distributions.json format) */
  _ingest(records) {
    const tempSet = new Set(this.temperatures);
    for (const rec of records) {
      if (!tempSet.has(rec.temperature)) continue;
      const model = rec.model;
      if (!this._index.has(model)) this._index.set(model, new Map());
      const cellMap = this._index.get(model);
      const key = this.cellKey(rec.task_id, rec.lang, rec.temperature);
      cellMap.set(key, rec);
    }
    this.n = this._index.size;
  }

  /**
   * Persist to disk. `records` overwrite matching cells in existing (last-write-wins).
   * Writes always go to the user-writable location, regardless of where the DB was loaded from.
   */
  save(records) {
    const targetPath = process.env.LLM_FINGERPRINT_HOME
      ? this.path
      : this.path === bundledReferencePath()
        ? userReferencePath()
        : this.path;

    let existing = [];
    if (existsSync(targetPath)) {
      try {
        const data = JSON.parse(readFileSync(targetPath, 'utf-8'));
        existing = data.distributions || data;
      } catch {
        existing = [];
      }
    } else if (existsSync(bundledReferencePath())) {
      try {
        const data = JSON.parse(readFileSync(bundledReferencePath(), 'utf-8'));
        existing = data.distributions || data;
      } catch {
        existing = [];
      }
    }

    const cellKey = (r) => `${r.model}|${r.task_id}|${r.lang}|${r.temperature}`;
    const map = new Map();
    for (const r of existing) map.set(cellKey(r), r);
    for (const r of records) map.set(cellKey(r), r); // records win
    const merged = [...map.values()];

    mkdirSync(dirname(targetPath), { recursive: true });
    const out = {
      generated_utc: new Date().toISOString(),
      n_cells: merged.length,
      distributions: merged
    };
    writeFileSync(targetPath, JSON.stringify(out, null, 2));
    this.path = targetPath;
    console.log(
      `[db] saved ${merged.length} distribution cells (${this._index.size} models) to ${targetPath}`
    );
  }

  /** Remove all cells for a given model. Returns count removed. */
  removeModel(model) {
    const cellMap = this._index.get(model);
    if (!cellMap) return 0;
    const count = cellMap.size;
    this._index.delete(model);
    this.n = this._index.size;
    return count;
  }

  /** Get all reference distributions for a given model */
  getModel(model) {
    return this._index.get(model);
  }

  /** List all known models */
  listModels() {
    return [...this._index.keys()].sort();
  }

  /** List model families (inferred from naming convention) */
  listFamilies() {
    const families = new Set();
    for (const m of this._index.keys()) {
      const f = inferFamily(m);
      if (f) families.add(f);
    }
    return [...families].sort();
  }

  /** Get all models in a family */
  getFamily(family) {
    return this.listModels().filter((m) => inferFamily(m) === family);
  }

  /** Iterate over all (model, distribution records) cells */
  *entries() {
    for (const [model, cellMap] of this._index) {
      yield { model, cells: cellMap };
    }
  }
}

/** Infer model family from its OpenRouter slug */
export function inferFamily(modelSlug) {
  const prefix = modelSlug.split('/')[0];
  const map = {
    anthropic: 'claude',
    openai: 'gpt',
    google: 'gemini',
    'meta-llama': 'llama',
    mistralai: 'mistral',
    deepseek: 'deepseek',
    qwen: 'qwen',
    cohere: 'command',
    'z-ai': 'glm',
    'x-ai': 'grok',
    amazon: 'nova',
    nvidia: 'nemotron',
    moonshotai: 'kimi',
    tencent: 'hunyuan',
    'bytedance-seed': 'seed',
    minimax: 'minimax',
    'ibm-granite': 'granite',
    microsoft: 'microsoft',
    nousresearch: 'nous',
    baidu: 'ernie',
    inflection: 'inflection',
    'arcee-ai': 'arcee',
    'nex-agi': 'nex',
    writer: 'writer',
    xiaomi: 'xiaomi',
    upstage: 'upstage',
    inception: 'inception',
    inclusionai: 'ling',
    liquid: 'liquid',
    deepcogito: 'cogito',
    rekaai: 'reka',
    perceptron: 'perceptron',
    ai21: 'ai21',
    'aion-labs': 'aion'
  };
  return map[prefix] || 'other';
}

/**
 * Materialize a reference library file from a distributions.json source.
 * Accepts either the flat array form or the `{ distributions: [...] }` envelope.
 *
 * @param {string} src — path to source distributions file
 * @param {string} [outPath] — target reference path (defaults to user data dir)
 * @returns {{ outPath: string, modelCount: number, cellCount: number }}
 */
export function bootstrapReference(src, outPath) {
  const target = outPath || userReferencePath();
  const raw = JSON.parse(readFileSync(src, 'utf-8'));
  const records = raw.distributions || raw;
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(
    target,
    JSON.stringify(
      {
        generated_utc: new Date().toISOString(),
        n_cells: records.length,
        distributions: records
      },
      null,
      2
    )
  );
  const models = new Set(records.map((r) => r.model));
  return { outPath: target, modelCount: models.size, cellCount: records.length };
}
