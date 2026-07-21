# data/ — raw and derived research data

**Raw data are append-only.** Never edit, rewrite, or delete files under `data/runs/`
by hand — analyses must be reproducible from the exact bytes the runner wrote. All
cleaning happens downstream in `data/derived/` (regenerable at any time by
`npm run stats:normalize`).

## Layout

```
data/
  models-catalog.json          # OpenRouter catalog snapshot (run/fetch-models.js)
  runs/
    <run-id>/                  # e.g. pilot-01, main-01 — one directory per run
      manifest.json            # design freeze: prompts+config hashes, git commit, model list, UTC created
      responses.jsonl          # append-only; ONE line per successful cell repetition
      failures.jsonl           # append-only log of exhausted retries (never analysed)
      validation-report.md     # run/validate-run.js output
  derived/
    normalized.jsonl           # stats/01 output — merged runs, normalized answers
    normalization-report.json  # validity taxonomy, unmapped color answers
```

## responses.jsonl record (one JSON object per line)

| field | meaning |
|---|---|
| `key` | sha1(model\|task\|lang\|temp\|rep\|prompts-major-version) — identity for resume/dedupe |
| `run_id`, `model`, `task_id`, `lang`, `temperature`, `rep` | cell coordinates |
| `provider` | upstream provider that actually served the request (OpenRouter routing) — analytical variable |
| `model_reported` | model string echoed by the API (≠ requested slug is itself a finding) |
| `request_utc`, `latency_ms` | timing metadata |
| `raw` | verbatim completion text — never modified |
| `finish_reason` | `stop` expected; `length` = truncated |
| `usage` | `{prompt_tokens, completion_tokens, cost_usd}` as reported by OpenRouter |
| `gen_id` | OpenRouter generation id (auditable server-side) |
| `error` | always `null` here (errors go to failures.jsonl) |

`normalized.jsonl` adds: `normalized` (canonical answer), `answer_class`
(`valid|invalid|refusal|empty`), `color_canon` (for color tasks).

## Merging runs

Runs are merged by `stats/01-normalize.js`; records are deduped on `key`, so pilot and
main runs of the **same prompts major version** combine safely. The pilot is analysed
separately for the go/no-go decision but is *not* mixed into confirmatory analyses
(pre-registration discipline) — pass `--runs main-01` to restrict.

## Publication

This directory (minus nothing — there are no secrets here) is intended to be published
as the paper's dataset artifact (e.g. Zenodo, CC-BY). Keep it that way: no API keys, no
personal data, UTC timestamps only.
