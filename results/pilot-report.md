# Pilot report

Generated: 2026-07-04T22:00:47.875Z

## Q1 — Response validity (target: ≥80% per model)

| model | valid | share |
|---|---|---|
| nvidia/nemotron-3-nano-30b-a3b | 1334/1380 | 96.7% |
| google/gemma-4-31b-it | 1363/1380 | 98.8% |
| meta-llama/llama-3.3-70b-instruct | 1359/1380 | 98.5% |
| nvidia/nemotron-3-ultra-550b-a55b | 1369/1380 | 99.2% |
| deepseek/deepseek-v4-flash | 1292/1380 | 93.6% |
| deepseek/deepseek-v4-pro | 1361/1380 | 98.6% |
| qwen/qwen3-30b-a3b-instruct-2507 | 1380/1380 | 100.0% |
| qwen/qwen3-235b-a22b-2507 | 1120/1380 | 81.2% |
| mistralai/ministral-8b-2512 | 1378/1380 | 99.9% |
| mistralai/mistral-large-2512 | 1380/1380 | 100.0% |
| google/gemma-4-26b-a4b-it | 1380/1380 | 100.0% |
| z-ai/glm-4.5-air | 1378/1380 | 99.9% |
| meta-llama/llama-3.1-8b-instruct | 1340/1380 | 97.1% |
| z-ai/glm-4.7 | 1369/1380 | 99.2% |

## Q2 — Determinism at t=0 within provider (target: ≥90% of cells)

92.5% of 840 cells deterministic within provider
(pooled across providers: 79.4% — the gap is provider serving-stack variance, analytically useful, not sampling noise)

## Q3 — Family separation (inter- vs intra-family JSD)

- intra-family mean JSD: 0.4187 (7 pairs)
- inter-family mean JSD: 0.4924
- gap: 0.0737
- permutation test (10k label shuffles): p = 0.0008 ✓

## Q4 — Cost extrapolation

- observed avg tokens/request in pilot: 65.0 in, 3.0 out (n=19320, cost $0.3208)
- extrapolated main run (190 models × 1980 requests): **$37.51**

## Verdict

**GO** — all pilot criteria met. Before the main run: (1) native-speaker review of translations, (2) manual review of models.selected.json, (3) OSF pre-registration of H1-H3 and the analysis plan, (4) re-run fetch-models for fresh pricing.