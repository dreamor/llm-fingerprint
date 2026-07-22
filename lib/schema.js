/**
 * Lightweight runtime schema checks — used to validate distribution records at
 * ingest time (`bootstrap`, `import`). Not a full JSON Schema implementation;
 * intentionally narrow to what this project needs.
 *
 * Returns { ok: boolean, errors: string[] }. Callers decide whether to reject
 * or filter.
 */

const REQUIRED_FIELDS = ['model', 'task_id', 'lang', 'temperature', 'dist'];

/** Validate a single distribution record. */
export function validateDistribution(record) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { ok: false, errors: ['record is not an object'] };
  }
  for (const f of REQUIRED_FIELDS) {
    if (record[f] === undefined || record[f] === null) errors.push(`missing field: ${f}`);
  }
  if (typeof record.model !== 'string' || record.model.length === 0)
    errors.push('model must be a non-empty string');
  if (typeof record.task_id !== 'string' || record.task_id.length === 0)
    errors.push('task_id must be a non-empty string');
  if (typeof record.lang !== 'string' || record.lang.length === 0)
    errors.push('lang must be a non-empty string');
  if (typeof record.temperature !== 'number' || !Number.isFinite(record.temperature))
    errors.push('temperature must be a finite number');
  if (record.dist !== undefined && record.dist !== null) {
    if (typeof record.dist !== 'object' || Array.isArray(record.dist)) {
      errors.push('dist must be an object');
    } else {
      let sum = 0;
      for (const [k, v] of Object.entries(record.dist)) {
        if (typeof k !== 'string' || k.length === 0)
          errors.push(`dist key must be a non-empty string, got: ${JSON.stringify(k)}`);
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) {
          errors.push(`dist[${k}] must be a probability in [0,1], got: ${v}`);
        }
        sum += Number(v) || 0;
      }
      // allow up to 1% rounding slack; empty dist is also allowed for pathological cells
      const entries = Object.keys(record.dist).length;
      if (entries > 0 && Math.abs(sum - 1) > 0.01) {
        errors.push(`dist probabilities must sum to ~1, got ${sum.toFixed(4)}`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Validate a batch. Returns { valid, invalid } where each element of `invalid`
 * has `{ record, errors, index }` so the caller can log actionable diagnostics.
 */
export function validateDistributions(records) {
  if (!Array.isArray(records)) {
    return {
      valid: [],
      invalid: [{ record: records, errors: ['input is not an array'], index: -1 }]
    };
  }
  const valid = [];
  const invalid = [];
  records.forEach((record, index) => {
    const r = validateDistribution(record);
    if (r.ok) valid.push(record);
    else invalid.push({ record, errors: r.errors, index });
  });
  return { valid, invalid };
}
