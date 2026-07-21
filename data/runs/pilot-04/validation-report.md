# Validation report — run pilot-04

Generated: 2026-07-04T22:00:32.542Z
Type: pilot, prompts v1.0.0, git 8db2d31d

## Completeness

| model | collected | expected | % | empty | truncated |
|---|---|---|---|---|---|
| mistralai/mistral-large-2512 | 1380 | 1380 | 100.0% | 0 | 0 |
| mistralai/ministral-8b-2512 | 1380 | 1380 | 100.0% | 0 | 1 |
| z-ai/glm-4.7 | 1380 | 1380 | 100.0% | 0 | 2 |
| z-ai/glm-4.5-air | 1380 | 1380 | 100.0% | 0 | 0 |
| meta-llama/llama-3.1-8b-instruct | 1380 | 1380 | 100.0% | 0 | 14 |
| google/gemma-4-26b-a4b-it | 1380 | 1380 | 100.0% | 0 | 0 |

## Failures (0 logged attempts)


## Totals

- unique responses: 8280 (0 duplicate log lines ignored)
- tokens: 512905 in / 26772 out
- reported cost: $0.0935

## Provider mix (model ← serving provider)

(Multiple providers per model are EXPECTED on OpenRouter and analytically useful — see paper1 robustness analysis.)

- 20× google/gemma-4-26b-a4b-it ← DeepInfra
- 89× google/gemma-4-26b-a4b-it ← DekaLLM
- 59× google/gemma-4-26b-a4b-it ← Google
- 665× google/gemma-4-26b-a4b-it ← NextBit
- 79× google/gemma-4-26b-a4b-it ← Novita
- 85× google/gemma-4-26b-a4b-it ← Parasail
- 75× google/gemma-4-26b-a4b-it ← SiliconFlow
- 66× google/gemma-4-26b-a4b-it ← Venice
- 242× google/gemma-4-26b-a4b-it ← Wafer
- 10× meta-llama/llama-3.1-8b-instruct ← Cloudflare
- 882× meta-llama/llama-3.1-8b-instruct ← DeepInfra
- 62× meta-llama/llama-3.1-8b-instruct ← Groq
- 426× meta-llama/llama-3.1-8b-instruct ← Novita
- 1164× mistralai/ministral-8b-2512 ← Mistral
- 216× mistralai/ministral-8b-2512 ← NextBit
- 1380× mistralai/mistral-large-2512 ← Mistral
- 801× z-ai/glm-4.5-air ← Novita
- 40× z-ai/glm-4.5-air ← SiliconFlow
- 539× z-ai/glm-4.5-air ← Z.AI
- 32× z-ai/glm-4.7 ← AtlasCloud
- 3× z-ai/glm-4.7 ← Cerebras
- 966× z-ai/glm-4.7 ← DeepInfra
- 24× z-ai/glm-4.7 ← Google
- 34× z-ai/glm-4.7 ← Novita
- 12× z-ai/glm-4.7 ← Phala
- 44× z-ai/glm-4.7 ← StreamLake
- 240× z-ai/glm-4.7 ← Venice
- 25× z-ai/glm-4.7 ← Z.AI

## Verdict

✓ All models ≥95% complete — proceed to stats/ (npm run stats:all).