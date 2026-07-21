# results/ — analysis outputs

Everything here is **machine-generated** by `stats/` scripts and safe to delete —
regenerate with `npm run stats:all`. Do not hand-edit; if a number is wrong, fix the
script or the data curation upstream.

| File | Producer | Content |
|---|---|---|
| `distributions.json` | stats/02 | per model×task×lang answer distributions, entropy, mode share, validity; t=0 determinism check |
| `divergence.json` | stats/03 | mean pairwise Jensen-Shannon divergence matrix + per-task matrices |
| `divergence-matrix.csv` | stats/03 | same matrix, CSV for R |
| `split-scores.json` | stats/03 | split-half genuine/impostor verification trials |
| `clustering.json`, `figures/dendrogram.pdf` | stats/R/10 | UPGMA tree, cophenetic corr., ARI vs. families |
| `classification.json` | stats/R/11 | LOO 1-NN family accuracy, per-family P/R, misclassified models (anomaly candidates) |
| `verification.json`, `figures/roc.pdf`, `figures/budget-curve.pdf` | stats/R/12 | AUC/EER, query-budget curve |
| `pilot-report.md` | stats/04 | **go/no-go document for the main run** — read this before spending money |

Numbers destined for the papers are copied from these files into
`paper1/main.tex` placeholders (marked `\todo{...}`); each placeholder comment names its
source file so the mapping is auditable.
