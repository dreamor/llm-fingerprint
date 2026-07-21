# LLM Fingerprint (fp)

> **Identify unknown language models by their behavioral fingerprint.**

[![]()]() 

**fp** is a CLI tool that identifies which LLM is behind an API endpoint by analyzing its **answer distribution** — the pattern of responses to simple questions like "pick a number from 1 to 10" or "flip a coin". Different models have measurably different output distributions (AUC **0.97**), even when trained on similar data.

## Quick start

```bash
# 1. Bootstrap the reference library
node bin/fp.js bootstrap results/distributions.json

# 2. Probe an unknown API
node bin/fp.js probe https://api.openai.com/v1 $OPENAI_KEY gpt-4o --reps 16 --langs en

# 3. Verify a claimed model (compliance audit)
node bin/fp.js verify https://api.example.com $KEY gpt-4o --reps 16
```

## Features

| Command | What it does |
|---------|--------------|
| `probe` | Send probing questions to an OpenAI/Anthropic API and match the fingerprint |
| `verify` | Probe + audit: is the model who it claims to be? |
| `fingerprint` | Build a distribution from manually collected answers and match (no API key needed) |
| `list` | Browse the reference library (176 models, 19 families) |
| `import` | Ingest new fingerprint data in the paper's JSONL format |

## Requirements

- **Node.js 18+** (uses built-in `fetch`)
- A reference fingerprint file (bootstrap from `results/distributions.json`)

## How it works

1. Send 15 simple probing tasks × N languages × M repetitions to the target model (temperature > 0)
2. Aggregate the answers into discrete probability distributions
3. Compare against the reference library using **Jensen-Shannon Divergence (JSD)**
4. Return the closest match with a confidence verdict

### Accuracy

| Queries per model | Equal Error Rate | When to use |
|-------------------|------------------|-------------|
| 8 | 10.6% | Quick check |
| 16 | 9.5% | Standard probe |
| 24 | 8.9% | Higher confidence |
| 40 | 7.3% | Research-grade (full protocol) |

API probing is cheap — ~$0.01 at GPT-4o-mini pricing for a full 15-task × 4-language × 16-rep run.

## Repo structure

```
llm-fingerprint/
├── bin/fp.js              # Entry point
├── lib/                   # Core modules
│   ├── jsd.js             # JSD computation
│   ├── tasks.js           # 15 probing tasks × 4 languages
│   ├── db.js              # Reference library
│   ├── match.js           # Matching algorithm
│   └── probe.js           # API probe runner
├── data/
│   ├── reference.json     # Bootstrapped fingerprints (176 models)
│   ├── runs/              # Experiment manifests
│   └── derived/           # Normalized data
├── results/               # Analysis outputs
│   ├── distributions.json # Reference fingerprints
│   ├── clustering.json    # UPGMA tree
│   ├── classification.json # 1-NN results (59.5% vs 18.4% chance)
│   └── verification.json  # AUC=0.97, EER=7.3%
├── docs/
│   ├── CONTRIBUTING.md
│   └── RUNBOOK.md
├── package.json
├── .gitignore
└── README.md
```

## The research behind it

The fingerprint library comes from the **PAMELA** study: 176+ models across 19 families, each probed with 15 tasks × 4 languages × 30 repetitions. Key findings:

- **AUC 0.97** — model identities are highly discriminable from behavior alone
- **1-NN accuracy 59.5%** (chance 18.4%) — family-level classification far above random
- **JSD gap between vs within families: 0.07 (p=0.0008)** — related models share behavioral traits
- Some models are routinely confused (e.g. Qwen → Gemini), revealing potential training overlap

## License

Research data: CC-BY.
Tool: MIT.