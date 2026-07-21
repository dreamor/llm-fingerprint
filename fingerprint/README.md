# LLM Fingerprint (fp)

> Identify unknown language models by their behavioral fingerprint.

Powered by the PAMELA research dataset — 176+ models probed across 15 tasks × 4 languages × 30 repetitions.  
Source: [github.com/dreamor/llm-fingerprint](https://github.com/dreamor/llm-fingerprint)

## How it works

Send simple questions (random numbers, coin flips, color preferences, coordination games) to an unknown model API endpoint. Aggregate the answer distribution across repetitions. Compare against the reference library using Jensen-Shannon Divergence (JSD). The closest match reveals the model's identity.

## Usage

```bash
# 1. Bootstrap the reference library
node bin/fp.js bootstrap ../results/distributions.json

# 2. Probe an unknown model (OpenAI API)
node bin/fp.js probe https://api.openai.com/v1 sk-xxx gpt-4o --reps 16 --langs en

# 3. Probe (Anthropic API)
node bin/fp.js probe https://api.anthropic.com sk-ant-xxx claude-sonnet-5 --api anthropic --reps auto

# 4. Verify a claimed model identity (compliance audit)
node bin/fp.js verify https://api.openai.com/v1 sk-xxx gpt-4o --reps 16

# 5. Match from manually collected answers (no API key needed)
node bin/fp.js fingerprint ./answers.csv

# 6. Match an existing probe result
node bin/fp.js match ./data/probe-1234567890/result.json --top 5

# 7. Browse the reference library
node bin/fp.js list
node bin/fp.js list --family claude

# 8. Import new fingerprint data (paper format)
node bin/fp.js import ./data/runs/main-02/responses.jsonl --model "anthropic/claude-sonnet-5"
```

## Commands

| Command | Description |
|---------|-------------|
| `probe <endpoint> <key> <model>` | Probe via OpenAI or Anthropic API |
| `verify <endpoint> <key> <claimed-model>` | Probe + compliance audit against claimed identity |
| `fingerprint <answers.csv>` | Build distribution from manually collected answers and match |
| `match <result.json>` | Match a probe result against the reference library |
| `list [--family <name>]` | List reference models |
| `import <responses.jsonl> --model <name>` | Import new fingerprint data |
| `bootstrap <distributions.json>` | Initialize reference library |

## Global flags

| Flag | Values | Default | Description |
|------|--------|---------|-------------|
| `--api` | `openai`, `anthropic` | `openai` | API format to use |
| `--reps` | number or `auto` | `30` | Repetitions per cell |
| `--eer` | 0–1 | `0.10` | Target EER when `--reps auto` |
| `--langs` | comma-sep | `en,ru,zh,ar` | Languages to probe |
| `--top` | number | `5` | Top-K matches to return |

### Budget-curve auto-reps

The paper measured how many repetitions are needed for a given accuracy:

| Reps (k) | EER | Use case |
|----------|-----|----------|
| 8 | 10.6% | Quick check — 90% accuracy |
| 16 | 9.5% | Standard probe |
| 24 | 8.9% | Higher confidence |
| 40 | 7.3% | Research-grade (full protocol) |

Pass `--reps auto` to pick the smallest k meeting your EER target (default ≤10%):

```bash
fp probe https://api.openai.com/v1 sk-xxx gpt-4o --reps auto --eer 0.09
# → uses 24 reps (first entry in budget curve with EER ≤ 0.09)
```

## Verify command (compliance audit)

The `verify` command probes an API and compares the behavioral fingerprint against the claimed model identity:

```bash
fp verify https://api.openai.com/v1 sk-xxx gpt-4o
```

Output tells you one of:
- ✅ **PASSED** — JSD < 0.10, model is who it claims to be
- ⚠ **WEAK** — JSD 0.10–0.20, possible update or quantization
- ❌ **SUSPICIOUS** — JSD 0.20–0.30, likely a different model
- ❌ **FAILED** — JSD ≥ 0.30, model is not who it claims to be

Use cases:
- API provider claims GPT-4o, you suspect a cheaper model
- Kubernetes model-router misrouting
- Verify model integrity after deployment

## Fingerprint command (no API key needed)

Collect answers manually (e.g. from a web UI, a colleague's screenshot, or a log file) and match:

```bash
fp fingerprint ./answers.csv
```

The CSV format:

```csv
task_id,lang,answer
num10-random,en,7
num10-random,en,3
coin-flip,en,heads
coin-flip,en,tails
color-favorite,zh,蓝色
color-favorite,zh,红色
```

Each row is one response. Grouping by (task_id, lang) happens automatically.
Need at least 2 answers per cell for a valid distribution.

## How the matching works

1. For each of the 15 probing tasks × 4 languages, the tool sends the same prompt N times (temperature > 0).
2. It aggregates the answers into a discrete probability distribution.
3. For each model in the reference library, it computes the **mean JSD** across all shared (task, language) cells.
4. Models are sorted by ascending mean JSD.

**Confidence thresholds:**

| JSD | Verdict |
|-----|---------|
| < 0.05 | Very high confidence — exact match |
| < 0.10 | High confidence — same or very close variant |
| < 0.20 | Moderate confidence — same family |
| < 0.30 | Low confidence — loose resemblance |
| ≥ 0.30 | Unknown — not in reference library |

## Extending the library

The reference library lives in `data/reference.json`. It uses the same schema as the paper's `distributions.json`.

To add a new model:

```bash
# 1. Collect raw responses in JSONL format
# 2. Import them
node bin/fp.js import ./path/to/responses.jsonl --model "provider/new-model-name"
```

The import command expects the paper's `responses.jsonl` format:
- `task_id`, `lang`, `temperature`, `raw`, `finish_reason`

Or just run a full probe with a known model label:

```bash
node bin/fp.js probe https://api.example.com sk-xxx my-model --reps 30 --langs en,zh
# Then manually copy the probe result into reference.json when you trust the label
```

## File layout

```
fingerprint/
├── bin/fp.js               # CLI entry point
├── lib/
│   ├── jsd.js              # Jensen-Shannon Divergence
│   ├── tasks.js            # 15 probing tasks × 4 languages
│   ├── db.js               # Reference library (in-memory index + persistence)
│   ├── match.js            # Matching algorithm
│   └── probe.js            # API-based probe runner
├── data/
│   ├── reference.json      # Bootstrapped reference library
│   ├── probe-*/            # Probe run results
│   └── verify-*/           # Verify run results
└── README.md
```

## Notes

- **t=0 vs t>0**: All matching uses temperature=1 distributions (30 reps). Temperature=0 is only used for the paper's determinism checks.
- **Paper format**: The `responses.jsonl` format used by the paper is:
  `{"task_id":"num10-random","lang":"en","temperature":1,"raw":"7","finish_reason":"stop", ...}`
- **Cost**: A full probe (15 tasks × 4 languages × 16 reps) costs about 960 queries ~ 65k tokens ≈ $0.01 at GPT-4o-mini pricing. A minimal probe (15 tasks × 1 language × 8 reps) costs ~ 120 queries ≈ $0.001.