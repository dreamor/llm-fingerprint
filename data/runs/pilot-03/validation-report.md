# Validation report — run pilot-03

Generated: 2026-07-04T21:39:40.177Z
Type: pilot, prompts v1.0.0, git 8db2d31d

## Completeness

| model | collected | expected | % | empty | truncated |
|---|---|---|---|---|---|
| nvidia/nemotron-3-ultra-550b-a55b | 1380 | 1380 | 100.0% | 0 | 2 |
| nvidia/nemotron-3-nano-30b-a3b | 1380 | 1380 | 100.0% | 0 | 38 |
| qwen/qwen3-235b-a22b-2507 | 1380 | 1380 | 100.0% | 159 | 100 |
| qwen/qwen3-30b-a3b-instruct-2507 | 1380 | 1380 | 100.0% | 0 | 0 |
| deepseek/deepseek-v4-pro | 1380 | 1380 | 100.0% | 0 | 9 |
| deepseek/deepseek-v4-flash | 1380 | 1380 | 100.0% | 66 | 71 |
| meta-llama/llama-3.3-70b-instruct | 1380 | 1380 | 100.0% | 0 | 12 |
| google/gemma-4-31b-it | 1380 | 1380 | 100.0% | 17 | 17 |

## Failures (0 logged attempts)


## Totals

- unique responses: 11040 (0 duplicate log lines ignored)
- tokens: 743848 in / 31314 out
- reported cost: $0.2273

## Provider mix (model ← serving provider)

(Multiple providers per model are EXPECTED on OpenRouter and analytically useful — see paper1 robustness analysis.)

- 69× deepseek/deepseek-v4-flash ← AkashML
- 108× deepseek/deepseek-v4-flash ← Alibaba
- 98× deepseek/deepseek-v4-flash ← AtlasCloud
- 174× deepseek/deepseek-v4-flash ← Baidu
- 8× deepseek/deepseek-v4-flash ← DeepInfra
- 120× deepseek/deepseek-v4-flash ← DigitalOcean
- 14× deepseek/deepseek-v4-flash ← Fireworks
- 182× deepseek/deepseek-v4-flash ← GMICloud
- 93× deepseek/deepseek-v4-flash ← Morph
- 91× deepseek/deepseek-v4-flash ← Novita
- 74× deepseek/deepseek-v4-flash ← Parasail
- 104× deepseek/deepseek-v4-flash ← SiliconFlow
- 95× deepseek/deepseek-v4-flash ← StreamLake
- 54× deepseek/deepseek-v4-flash ← Venice
- 96× deepseek/deepseek-v4-flash ← WandB
- 83× deepseek/deepseek-v4-pro ← Alibaba
- 78× deepseek/deepseek-v4-pro ← AtlasCloud
- 288× deepseek/deepseek-v4-pro ← Baidu
- 86× deepseek/deepseek-v4-pro ← DeepInfra
- 163× deepseek/deepseek-v4-pro ← GMICloud
- 90× deepseek/deepseek-v4-pro ← Novita
- 32× deepseek/deepseek-v4-pro ← Parasail
- 82× deepseek/deepseek-v4-pro ← SiliconFlow
- 324× deepseek/deepseek-v4-pro ← StreamLake
- 50× deepseek/deepseek-v4-pro ← Together
- 45× deepseek/deepseek-v4-pro ← Venice
- 59× deepseek/deepseek-v4-pro ← WandB
- 171× google/gemma-4-31b-it ← DeepInfra
- 19× google/gemma-4-31b-it ← ModelRun
- 74× google/gemma-4-31b-it ← Novita
- 600× google/gemma-4-31b-it ← Parasail
- 9× google/gemma-4-31b-it ← Phala
- 33× google/gemma-4-31b-it ← SambaNova
- 87× google/gemma-4-31b-it ← SiliconFlow
- 26× google/gemma-4-31b-it ← Together
- 180× google/gemma-4-31b-it ← Venice
- 181× google/gemma-4-31b-it ← WandB
- 149× meta-llama/llama-3.3-70b-instruct ← AkashML
- 18× meta-llama/llama-3.3-70b-instruct ← Cloudflare
- 250× meta-llama/llama-3.3-70b-instruct ← DeepInfra
- 9× meta-llama/llama-3.3-70b-instruct ← Google
- 9× meta-llama/llama-3.3-70b-instruct ← Groq
- 141× meta-llama/llama-3.3-70b-instruct ← Nebius
- 158× meta-llama/llama-3.3-70b-instruct ← Novita
- 619× meta-llama/llama-3.3-70b-instruct ← Parasail
- 16× meta-llama/llama-3.3-70b-instruct ← SambaNova
- 4× meta-llama/llama-3.3-70b-instruct ← Together
- 7× meta-llama/llama-3.3-70b-instruct ← WandB
- 622× nvidia/nemotron-3-nano-30b-a3b ← DeepInfra
- 443× nvidia/nemotron-3-nano-30b-a3b ← Nebius
- 315× nvidia/nemotron-3-nano-30b-a3b ← Novita
- 1011× nvidia/nemotron-3-ultra-550b-a55b ← DeepInfra
- 110× nvidia/nemotron-3-ultra-550b-a55b ← Nebius
- 259× nvidia/nemotron-3-ultra-550b-a55b ← Together
- 125× qwen/qwen3-235b-a22b-2507 ← Alibaba
- 61× qwen/qwen3-235b-a22b-2507 ← AtlasCloud
- 441× qwen/qwen3-235b-a22b-2507 ← DeepInfra
- 58× qwen/qwen3-235b-a22b-2507 ← Friendli
- 106× qwen/qwen3-235b-a22b-2507 ← Google
- 260× qwen/qwen3-235b-a22b-2507 ← Novita
- 162× qwen/qwen3-235b-a22b-2507 ← Parasail
- 59× qwen/qwen3-235b-a22b-2507 ← StreamLake
- 52× qwen/qwen3-235b-a22b-2507 ← Together
- 56× qwen/qwen3-235b-a22b-2507 ← Venice
- 165× qwen/qwen3-30b-a3b-instruct-2507 ← Alibaba
- 346× qwen/qwen3-30b-a3b-instruct-2507 ← Nebius
- 538× qwen/qwen3-30b-a3b-instruct-2507 ← StreamLake
- 331× qwen/qwen3-30b-a3b-instruct-2507 ← WandB

## Verdict

✓ All models ≥95% complete — proceed to stats/ (npm run stats:all).