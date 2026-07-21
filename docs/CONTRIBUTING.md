<!-- AUTO-GENERATED (source: package.json + lib/* source code) -->

# Contributing

## Development setup

```bash
git clone https://github.com/dreamor/llm-fingerprint.git
cd llm-fingerprint

# Option A: install globally for the `fp` command
npm install -g .

# Option B: run directly from source (no install needed)
node bin/fp.js --help
```

Zero npm dependencies — uses Node.js built-in `fetch`.

## Available scripts

| Command (global) | Command (local) | Description |
|------------------|-----------------|-------------|
| `fp bootstrap <path>` | `node bin/fp.js bootstrap <path>` | Initialize reference library from `distributions.json` |
| `fp probe <url> <key> <model>` | `node bin/fp.js probe ...` | Probe an unknown model API |
| `fp verify <url> <key> <model>` | `node bin/fp.js verify ...` | Verify a claimed model identity |
| `fp fingerprint <csv>` | `node bin/fp.js fingerprint <csv>` | Match from manually collected answers |
| `fp match <result.json>` | `node bin/fp.js match <result.json>` | Match an existing probe result |
| `fp list [--family]` | `node bin/fp.js list [--family]` | Browse reference library |
| `fp import <jsonl> --model` | `node bin/fp.js import <jsonl> --model` | Ingest new fingerprints |

## Project structure

```
.               # CLI tool (self-contained, zero deps)
├── bin/fp.js              # CLI entry point — 7 commands
├── lib/
│   ├── jsd.js             # Jensen-Shannon Divergence
│   ├── tasks.js           # 15 probing tasks × 4 languages + answer normalizer
│   ├── db.js              # FingerprintDB (in-memory index + JSON persistence)
│   ├── match.js           # Top-K matching by mean JSD
│   └── probe.js           # API probe runner (OpenAI + Anthropic) + budget-curve auto-reps
└── data/reference.json    # Bootstrapped fingerprints (git-tracked, merged on import)

data/                      # PAMELA research experiment data
results/                   # Analysis outputs (pilot-report, distributions, clustering, etc.)
```

## Testing

No test suite yet. To verify changes:

```bash
# Bootstrap from the paper's distributions
node bin/fp.js bootstrap results/distributions.json

# Run a self-test: extract gpt-4o fingerprint and match
node -e "
const ref = JSON.parse(require('fs').readFileSync('data/reference.json'));
const gpt4o = ref.distributions.filter(r => r.model === 'openai/gpt-4o' && r.temperature === 1);
const probeResult = { model: 'test', provider: 'test', temperature: 1, reps: 30, cells: gpt4o.slice(0, 10) };
const { match } = require('./lib/match.js');
const { FingerprintDB } = require('./lib/db.js');
const db = new FingerprintDB(); db.load();
console.log(match(db, probeResult).verdict.label);  // should show 'matches openai/gpt-4o'
"
```

## Code style

- **ESM** (`import`/`export`) — no CommonJS
- **JSDoc** for exported function signatures
- **2-space indent**
- **No semicolons** (choose your own — the codebase uses them inconsistently, pick one and stay consistent)
- Async with `async`/`await` and try-catch

## Pull request checklist

Before submitting a PR:

- [ ] `node bin/fp.js list` loads without error
- [ ] New probe task or language added to `lib/tasks.js`
- [ ] Self-test match works for a known model
- [ ] Repo URL references use `github.com/dreamor/llm-fingerprint`
- [ ] `data/README.md` and `results/README.md` reference the correct dataset DOI (if published)

## Publishing to npm (Trusted Publisher)

This package uses **npm Trusted Publisher** (OIDC-based, no token required).

### One-time setup

```bash
# 1. Create the package on npm
npm login
npm publish --access public --dry-run   # verify first
npm publish --access public              # first publish (run locally)

# 2. Configure Trusted Publisher for CI
npm token create --publish --oidc
# → follow the link to set up the OIDC publisher on GitHub
#   Environment:  leave blank (any branch)
#   Owner:        dreamor
#   Repository:   llm-fingerprint
#   Workflow:     release.yml
```

After setup, every GitHub Release automatically publishes:

```bash
# GitHub → Releases → "Draft a new release"
# Tag: v0.2.0, target: main
# → CI runs npm publish --provenance --access public
```

## Adding a new probing task

Open `lib/tasks.js` and add an entry to `PROMT_TPL`:

```js
'my-new-task': {
  en: 'Your English prompt here. Output only the answer.',
  ru: '...',
  zh: '...',
  ar: '...',
},
```

The normalizer in the same file handles whitespace, quoting, and common refusal patterns. If your task produces non-standard answer formats, add normalization logic there.