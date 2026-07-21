<!-- AUTO-GENERATED (source: package.json + lib/* source code) -->

# Contributing

## Development setup

```bash
git clone https://github.com/dreamor/llm-fingerprint.git
cd llm-fingerprint
# No npm install needed — zero dependencies, uses Node.js built-in fetch
```

## Available scripts

| Command | Description |
|---------|-------------|
| `node fingerprint/bin/fp.js bootstrap <path>` | Initialize reference library from `distributions.json` |
| `node fingerprint/bin/fp.js probe <url> <key> <model>` | Probe an unknown model API |
| `node fingerprint/bin/fp.js verify <url> <key> <model>` | Verify a claimed model identity |
| `node fingerprint/bin/fp.js fingerprint <csv>` | Match from manually collected answers |
| `node fingerprint/bin/fp.js match <result.json>` | Match an existing probe result |
| `node fingerprint/bin/fp.js list [--family]` | Browse reference library |
| `node fingerprint/bin/fp.js import <jsonl> --model` | Ingest new fingerprints |

## Project structure

```
fingerprint/               # CLI tool (self-contained, zero deps)
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
node fingerprint/bin/fp.js bootstrap results/distributions.json

# Run a self-test: extract gpt-4o fingerprint and match
node -e "
const ref = JSON.parse(require('fs').readFileSync('fingerprint/data/reference.json'));
const gpt4o = ref.distributions.filter(r => r.model === 'openai/gpt-4o' && r.temperature === 1);
const probeResult = { model: 'test', provider: 'test', temperature: 1, reps: 30, cells: gpt4o.slice(0, 10) };
const { match } = require('./fingerprint/lib/match.js');
const { FingerprintDB } = require('./fingerprint/lib/db.js');
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

## Adding a new probing task

Open `fingerprint/lib/tasks.js` and add an entry to `PROMT_TPL`:

```js
'my-new-task': {
  en: 'Your English prompt here. Output only the answer.',
  ru: '...',
  zh: '...',
  ar: '...',
},
```

The normalizer in the same file handles whitespace, quoting, and common refusal patterns. If your task produces non-standard answer formats, add normalization logic there.