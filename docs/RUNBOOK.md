<!-- AUTO-GENERATED (source: lib/probe.js + lib/db.js + lib/match.js) -->

# Runbook

## Install

```bash
npm install -g llm-fingerprint
fp bootstrap   # auto-runs on install
```

Or from source:

```bash
git clone https://github.com/dreamor/llm-fingerprint.git
cd llm-fingerprint
node bin/fp.js bootstrap results/distributions.json
```

## Typical workflows

### Probe an unknown API

```bash
cd /path/to/llm-fingerprint

# Step 1: Bootstrap (one-time)
fp bootstrap results/distributions.json

# Step 2: Probe
fp probe https://api.openai.com/v1 --api-key-env OPENAI_API_KEY gpt-4o --reps 16 --langs en
```

The verdict tells you:
- **very_high** (JSD < 0.05) — exact model match
- **high** (JSD < 0.10) — very close variant
- **moderate** (JSD < 0.20) — same family
- **low** (JSD < 0.30) — loose resemblance
- **unknown** (JSD ≥ 0.30) — not in reference library

### Compliance audit

```bash
fp verify https://api.openai.com/v1 --api-key-env OPENAI_API_KEY gpt-4o --reps 16
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
fp fingerprint /tmp/answers.csv
```

## Commands

| Command | Description |
|---------|-------------|
| `probe <endpoint> [key\|-] <model>` | Probe via OpenAI or Anthropic API and match |
| `verify <endpoint> [key\|-] <claimed-model>` | Probe + compliance audit against claimed identity |
| `fingerprint <answers.csv> [--save]` | Build distribution from manually collected answers and match (optionally save to reference lib) |
| `match <result.json>` | Match an existing probe result |
| `list [--family <name>]` | Browse reference library (176 models) |
| `import <responses.jsonl> --model <name>` | Ingest new fingerprint data (records overwrite existing cells) |
| `remove <model-slug>` | Remove a model from the user's reference library |
| `bootstrap [distributions.json]` | Initialize reference library (defaults to bundled data) |

### Global flags

| Flag | Values | Default | Description |
|------|--------|---------|-------------|
| `--api` | `openai`, `anthropic` | `openai` | API format to use |
| `--reps` | number or `auto` | `30` | Repetitions per cell |
| `--eer` | 0–1 | `0.10` | Target EER when `--reps auto` |
| `--langs` | comma-sep | `en,ru,zh,ar` | Languages to probe |
| `--concurrency` | number | `4` | HTTP concurrency for probes (with 429/5xx retry + backoff) |
| `--adaptive` | flag | off | Early-stop when top-1 match stabilizes across rounds |
| `--openrouter` | flag | off | Send OpenRouter-only fields (e.g. `reasoning: { enabled: false }`) |
| `--top` | number | `5` | Top-K matches to return |
| `--api-key-env` | env var name | — | Read the API key from this environment variable |
| `--api-key-file` | path | — | Read the API key from the first non-empty line of this file |

Passing the API key positionally still works, but the key becomes visible in
`ps` output and shell history — prefer `--api-key-env` / `--api-key-file`, or
set `LLM_FINGERPRINT_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`.

### Manual fingerprint with save

```bash
# Probe a model by collecting answers manually and save its fingerprint
fp fingerprint /tmp/answers.csv --save
# The distribution is added to the reference library under a prompt-derived name
```

### Removing a model

```bash
fp remove gpt-4o              # by slug
fp remove anthropic/claude-*  # by glob pattern
```

## Reference library management

### Bootstrap from paper data

```bash
fp bootstrap results/distributions.json
# → bootstrapped 176 models (10540 cells) → data/reference.json
```

### Import new data (JSONL format)

```bash
fp import ./responses.jsonl --model "anthropic/claude-sonnet-5"
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
| API returns 400 errors | `reasoning` param not supported | Try removing `--openrouter` |
| Slow probe (many reps) | High `--reps` or many `--langs` | Pass `--adaptive` for early-stop; reduce `--langs` to `en`; lower `--reps` |
| `unknown` provider error | Provider not in registry | Supported: `openai`, `anthropic` — pass `--api` accordingly |

## Health check

```bash
# If reference is loaded...
fp list
# Should show "Reference library: 176 models" and family breakdown

# If reference is empty on first run, it now auto-bootstraps from the bundled
# results/distributions.json — no manual step required. To force a rebuild:
fp bootstrap
```

## Reference library location

Writes always go to a per-user data directory (never the read-only package copy):

| Platform | Path |
|----------|------|
| macOS    | `~/Library/Application Support/llm-fingerprint/reference.json` |
| Linux    | `$XDG_DATA_HOME/llm-fingerprint/reference.json` (default `~/.local/share/…`) |
| Windows  | `%LOCALAPPDATA%\llm-fingerprint\reference.json` |

Set `LLM_FINGERPRINT_HOME=/some/dir` to isolate a run (also how the CI tests
sandbox themselves).

## API keys

Preferred (never appears in `ps` or shell history):

```bash
export OPENAI_API_KEY=sk-xxx
fp probe https://api.openai.com/v1 --api-key-env OPENAI_API_KEY gpt-4o
# or
fp probe https://api.openai.com/v1 --api-key-file ~/.secrets/openai gpt-4o
```

Env fallback order: `LLM_FINGERPRINT_KEY` → `OPENAI_API_KEY` (openai) /
`ANTHROPIC_API_KEY` (anthropic).

## Common failure modes

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `HttpError 429: rate limited` | Provider throttle | Retries kick in automatically; lower `--concurrency` if it keeps recurring |
| `Anthropic API 404` | Base URL missing `/v1` | Fixed — either `https://api.anthropic.com` or `https://api.anthropic.com/v1` works |
| `unknown OpenAI param: reasoning` | Strict OpenAI-compatible server | Don't pass `--openrouter` |
| Probe never converges | Model output too diverse | Pass `--adaptive` for automatic early-stop when top-1 stabilizes |
| Import silently kept old data | Prior bug where `existing` won over records | Fixed — records now overwrite existing cells |
| Verdict "moderate" but verify says "weak" | Different threshold tables per command | Fixed — both use `lib/verdict.js` |

## Files

| Path | Purpose | Backup? |
|------|---------|---------|
| `data/reference.json` | Reference fingerprint library | Yes (git-tracked) |
| `data/runs/*/manifest.json` | Experiment configuration | Yes (paper artifact) |
| `results/distributions.json` | Paper reference fingerprints | Yes (paper artifact) |
| `data/probe-*/` or `data/verify-*/` | Probe/verify run artifacts | No (regenerable) |