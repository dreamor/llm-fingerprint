# LLM Fingerprint (fp)

> **Identify unknown language models by their behavioral fingerprint.**

**fp** is a CLI tool that identifies which LLM is behind an API endpoint by analyzing its **answer distribution** — the pattern of responses to simple questions like "pick a number from 1 to 10" or "flip a coin". Different models have measurably different output distributions (AUC **0.97**), even when trained on similar data.

## Install

```bash
npm install -g llm-fingerprint
```

This will also bootstrap the reference fingerprint library (176 models) automatically.

## Quick start

```bash
# Probe an unknown API (OpenAI-compatible)
fp probe https://api.openai.com/v1 --api-key-env OPENAI_API_KEY gpt-4o --reps 16 --langs en

# Probe via Anthropic API (base URL with or without /v1 both work)
fp probe https://api.anthropic.com --api-key-env ANTHROPIC_API_KEY claude-sonnet-5 --api anthropic --reps auto

# Verify a claimed model identity (compliance audit)
fp verify https://api.openai.com/v1 --api-key-env OPENAI_API_KEY gpt-4o --reps 16

# Match from manually collected answers (no API key needed)
fp fingerprint ./answers.csv

# Browse the reference library
fp list
fp list --family claude
```

## Commands

| Command                                      | Description                                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `probe <endpoint> [key\|-] <model>`          | Probe via OpenAI or Anthropic API and match                                                     |
| `verify <endpoint> [key\|-] <claimed-model>` | Probe + compliance audit against claimed identity                                               |
| `fingerprint <answers.csv> [--save]`         | Build distribution from manually collected answers and match (optionally save to reference lib) |
| `match <result.json>`                        | Match an existing probe result                                                                  |
| `list [--family <name>]`                     | Browse reference library (176 models)                                                           |
| `import <responses.jsonl> --model <name>`    | Ingest new fingerprint data (records overwrite existing cells)                                  |
| `remove <model-slug>`                        | Remove a model from the user's reference library                                                |
| `bootstrap [distributions.json]`             | Initialize reference library (defaults to bundled data)                                         |

### Global flags

| Flag             | Values                | Default       | Description                                                        |
| ---------------- | --------------------- | ------------- | ------------------------------------------------------------------ |
| `--api`          | `openai`, `anthropic` | `openai`      | API format to use                                                  |
| `--reps`         | number or `auto`      | `30`          | Repetitions per cell                                               |
| `--eer`          | 0–1                   | `0.10`        | Target EER when `--reps auto`                                      |
| `--langs`        | comma-sep             | `en,ru,zh,ar` | Languages to probe                                                 |
| `--concurrency`  | number                | `4`           | HTTP concurrency for probes (with 429/5xx retry + backoff)         |
| `--adaptive`     | flag                  | off           | Early-stop when top-1 match stabilizes across rounds               |
| `--openrouter`   | flag                  | off           | Send OpenRouter-only fields (e.g. `reasoning: { enabled: false }`) |
| `--top`          | number                | `5`           | Top-K matches to return                                            |
| `--api-key-env`  | env var name          | —             | Read the API key from this environment variable                    |
| `--api-key-file` | path                  | —             | Read the API key from the first non-empty line of this file        |

Passing the API key positionally still works, but the key becomes visible in
`ps` output and shell history — prefer `--api-key-env` / `--api-key-file`, or
set `LLM_FINGERPRINT_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`.

### Reference library location

Writes always land in a per-user data directory:

| Platform | Path                                                                    |
| -------- | ----------------------------------------------------------------------- |
| macOS    | `~/Library/Application Support/llm-fingerprint/reference.json`          |
| Linux    | `$XDG_DATA_HOME/llm-fingerprint/reference.json` (or `~/.local/share/…`) |
| Windows  | `%LOCALAPPDATA%\llm-fingerprint\reference.json`                         |

Override with `LLM_FINGERPRINT_HOME=/some/dir`. Reads fall back to the bundled
package copy when the user file doesn't exist yet.

## Programmatic API

The CLI is a thin wrapper over `lib/*` — the same functions ship as an ESM library:

```js
import { probe, match, FingerprintDB } from 'llm-fingerprint';

const db = new FingerprintDB();
db.load();

const result = await probe({
  endpoint: 'https://api.openai.com/v1',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o',
  reps: 16,
  concurrency: 8
});

console.log(match(db, result).verdict);
```

Subpath imports for narrower consumers: `llm-fingerprint/probe`,
`llm-fingerprint/match`, `llm-fingerprint/jsd`, `llm-fingerprint/verdict`,
`llm-fingerprint/providers/openai`, `llm-fingerprint/providers/anthropic`.

## How it works

1. Send 15 simple probing tasks × N languages × M repetitions to the target model (temperature > 0)
2. Aggregate the answers into discrete probability distributions
3. Compare against the reference library using **Jensen-Shannon Divergence (JSD)**
4. Return the closest match with a confidence verdict

### Accuracy (budget curve)

| Queries per model | Equal Error Rate | When to use                    |
| ----------------- | ---------------- | ------------------------------ |
| 8                 | 10.6%            | Quick check — 90% accuracy     |
| 16                | 9.5%             | Standard probe                 |
| 24                | 8.9%             | Higher confidence              |
| 40                | 7.3%             | Research-grade (full protocol) |

API probing is cheap — ~$0.01 at GPT-4o-mini pricing for a full 15-task × 4-language × 16-rep run.

### Confidence thresholds

| JSD    | Verdict                                      |
| ------ | -------------------------------------------- |
| < 0.05 | Very high confidence — exact match           |
| < 0.10 | High confidence — same or very close variant |
| < 0.20 | Moderate confidence — same family            |
| < 0.30 | Low confidence — loose resemblance           |
| ≥ 0.30 | Unknown — not in reference library           |

### Budget-curve auto-reps

```bash
# Auto-pick the smallest reps that meet target EER
fp probe https://api.openai.com/v1 sk-xxx gpt-4o --reps auto --eer 0.09
# → uses 24 reps
```

## Use cases

| Scenario                                                | Command          |
| ------------------------------------------------------- | ---------------- |
| API provider claims GPT-4o, you suspect a cheaper model | `fp verify`      |
| Kubernetes model-router misrouting                      | `fp verify`      |
| Distillation / model theft detection                    | `fp fingerprint` |
| Reverse-engineer a black-box chat service               | `fp fingerprint` |
| Compare model versions before/after update              | `fp probe`       |

## Requirements

- **Node.js 18+** (uses built-in `fetch`)

## Repo structure

```
llm-fingerprint/
├── bin/fp.js              # CLI router (dispatches to lib/commands/*)
├── lib/
│   ├── index.js           # SDK entry — `import { probe, match } from 'llm-fingerprint'`
│   ├── jsd.js             # JSD computation
│   ├── tasks.js           # 15 probing tasks × 4 languages + multi-lingual refusal filter
│   ├── db.js              # Reference library + user-writable path
│   ├── match.js           # Matching algorithm (shared-cells weighted, tie-break)
│   ├── probe.js           # Probe orchestrator (concurrency + retry + adaptive early-stop)
│   ├── verdict.js         # Shared tier table (match & verify agree)
│   ├── providers/         # openai.js, anthropic.js + registry
│   ├── http.js            # Bounded-concurrency pool + exponential backoff + Retry-After
│   ├── csv.js             # RFC-4180-ish CSV parser (quoted / CRLF / Unicode)
│   ├── schema.js          # Runtime record validator (bootstrap/import)
│   ├── progress.js        # stderr progress bar (TTY-aware)
│   ├── paths.js           # Platform user-data paths (XDG / macOS / Windows)
│   ├── cli-args.js        # parseArgs + resolveApiKey
│   ├── cli-output.js      # warn + printVerdict
│   └── commands/          # One file per subcommand
├── data/
│   ├── reference.json     # Bundled read-only fingerprints
│   ├── runs/              # Experiment manifests
│   └── derived/           # Normalized data
├── results/               # Analysis outputs (distributions.json, clustering, verification…)
├── test/                  # 123 unit + E2E tests
├── docs/                  # CONTRIBUTING.md, RUNBOOK.md
├── package.json
└── README.md
```

## The research behind it

The fingerprint library comes from the **PAMELA** study: 176+ models across 19 families, each probed with 15 tasks × 4 languages × 30 repetitions. Key findings:

- **AUC 0.97** — model identities are highly discriminable from behavior alone
- **1-NN accuracy 59.5%** (chance 18.4%) — family-level classification far above random
- **JSD gap between vs within families: 0.07 (p=0.0008)** — related models share behavioral traits
- Some models are routinely confused (e.g. Qwen → Gemini), revealing potential training overlap

### Citation

If you use this dataset or tool in academic work, please cite:

> Bruckner, T. (2026). Single-token output distributions as behavioral fingerprints of large language models [Data set]. Zenodo. https://doi.org/10.5281/zenodo.21278557

## License

- **Research data**: CC-BY
- **Tool**: MIT
