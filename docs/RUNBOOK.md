<!-- AUTO-GENERATED (source: lib/probe.js + lib/db.js + lib/match.js) -->

# Runbook

## Typical workflows

### Probe an unknown API

```bash
cd /path/to/llm-fingerprint

# Step 1: Bootstrap (one-time)
node bin/fp.js bootstrap results/distributions.json

# Step 2: Probe
node bin/fp.js probe https://api.openai.com/v1 $OPENAI_KEY gpt-4o --reps 16 --langs en
```

The verdict tells you:
- **very_high** (JSD < 0.05) — exact model match
- **high** (JSD < 0.10) — very close variant
- **moderate** (JSD < 0.20) — same family
- **low** (JSD < 0.30) — loose resemblance
- **unknown** (JSD ≥ 0.30) — not in reference library

### Compliance audit

```bash
node bin/fp.js verify https://api.openai.com/v1 $KEY gpt-4o --reps 16
```

Expected output:
```
  ✅ VERIFICATION PASSED — "gpt-4o" confirmed (JSD=0.0032).
  or
  ❌ VERIFICATION FAILED — "gpt-4o" JSD=0.3512.
     Best match: qwen/qwen3-235b-a22b (JSD=0.1876).
```

### Manual fingerprint (no API key)

```csv
task_id,lang,answer
num10-random,en,7
num10-random,en,3
...
```

```bash
node bin/fp.js fingerprint /tmp/answers.csv
```

## Reference library management

### Bootstrap from paper data

```bash
node bin/fp.js bootstrap results/distributions.json
# → bootstrapped 176 models (10540 cells) → data/reference.json
```

### Import new data (JSONL format)

```bash
node bin/fp.js import ./responses.jsonl --model "anthropic/claude-sonnet-5"
```

The JSONL format must follow the paper's schema:
- `task_id`: string matching a task in `lib/tasks.js`
- `lang`: `en` | `ru` | `zh` | `ar`
- `temperature`: number (typically `1`)
- `raw`: string — the raw model output
- `finish_reason`: `"stop"` — filtered out otherwise

## Common issues

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| All cells validity_rate < 50% | Safety filter blocking answers | Check model provider's content policy | |
| Verdict always "unknown" | Model not in reference | Use family-level inference; or run a full probe to add it |
| JSD very high for known model | Model was updated | Re-probe the model and re-import |
| API returns 400 errors | `reasoning` param not supported | Try without `reasoning: { enabled: false }` param |

## Health check

```bash
# If reference is loaded...
node bin/fp.js list
# Should show "Reference library: 176 models" and family breakdown

# If reference is empty...
echo "Run: node bin/fp.js bootstrap results/distributions.json"
```

## Files

| Path | Purpose | Backup? |
|------|---------|---------|
| `data/reference.json` | Reference fingerprint library | Yes (git-tracked) |
| `data/runs/*/manifest.json` | Experiment configuration | Yes (paper artifact) |
| `results/distributions.json` | Paper reference fingerprints | Yes (paper artifact) |
| `data/probe-*/` or `data/verify-*/` | Probe/verify run artifacts | No (regenerable) |