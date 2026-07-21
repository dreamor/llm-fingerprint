/**
 * Reference fingerprint database.
 *
 * Wraps the paper's `distributions.json` format:
 *   distributions: [{ model, task_id, lang, temperature, n_valid, dist, ... }]
 *
 * In-memory index: Map<model, Map<cellKey, Distribution>>
 *   where cellKey = `${task_id}|${lang}|t=${temperature}`
 *
 * Persisted to data/reference.json (identical schema to distributions.json)
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(DIR, '..', 'data', 'reference.json');

export class FingerprintDB {
  /**
   * @param {string} [path] — path to reference.json
   * @param {object} [opts]
   * @param {boolean} [opts.temperatures] — which temperatures to include. default [1]
   */
  constructor(path, opts = {}) {
    this.path = path || DEFAULT_PATH;
    this.temperatures = opts.temperatures || [1];
    /** Map<model, Map<cellKey, Distribution>> */
    this._index = new Map();
    /** How many distinct models */
    this.n = 0;
  }

  cellKey(taskId, lang, temperature) {
    return `${taskId}|${lang}|t=${temperature}`;
  }

  /** Load from the on-disk reference file */
  load() {
    if (!existsSync(this.path)) {
      console.warn(`[db] reference file not found: ${this.path}`);
      return;
    }
    const data = JSON.parse(readFileSync(this.path, 'utf-8'));
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

  /** Persist to disk (merge with existing) */
  save(records) {
    // merge: load existing, add new, dedupe by (model, task_id, lang, temperature)
    let existing = [];
    if (existsSync(this.path)) {
      const data = JSON.parse(readFileSync(this.path, 'utf-8'));
      existing = data.distributions || data;
    }
    const seen = new Set();
    const merged = [];
    for (const r of [...existing, ...records]) {
      const key = `${r.model}|${r.task_id}|${r.lang}|${r.temperature}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(r);
    }
    const out = { generated_utc: new Date().toISOString(), n_cells: merged.length, distributions: merged };
    writeFileSync(this.path, JSON.stringify(out, null, 2));
    console.log(`[db] saved ${merged.length} distribution cells (${this._index.size} models) to ${this.path}`);
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
    return this.listModels().filter(m => inferFamily(m) === family);
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
    'anthropic': 'claude',
    'openai': 'gpt',
    'google': 'gemini',
    'meta-llama': 'llama',
    'mistralai': 'mistral',
    'deepseek': 'deepseek',
    'qwen': 'qwen',
    'cohere': 'command',
    'z-ai': 'glm',
    'x-ai': 'grok',
    'amazon': 'nova',
    'nvidia': 'nemotron',
    'moonshotai': 'kimi',
    'tencent': 'hunyuan',
    'bytedance-seed': 'seed',
    'minimax': 'minimax',
    'ibm-granite': 'granite',
    'microsoft': 'microsoft',
    'nousresearch': 'nous',
    'baidu': 'ernie',
    'inflection': 'inflection',
    'arcee-ai': 'arcee',
    'nex-agi': 'nex',
    'writer': 'writer',
    'xiaomi': 'xiaomi',
    'upstage': 'upstage',
    'inception': 'inception',
    'inclusionai': 'ling',
    'liquid': 'liquid',
    'deepcogito': 'cogito',
    'rekaai': 'reka',
    'perceptron': 'perceptron',
    'ai21': 'ai21',
    'aion-labs': 'aion',
  };
  return map[prefix] || 'other';
}