# Anima Model Support

## Goal

Add a prompt assembly module (`anima.md`) for the Anima model, following the same pattern as `zit.md` and `illustrious.md`. Fix incorrect fields in the existing `model-profiles.ts` config.

## Research Sources

- HuggingFace: circlestone-labs/Anima (official model card)
- Civitai: model page + articles about Anima settings
- Reddit: community discussions on Anima vs Illustrious, sampler comparisons, composition issues
- Community: Anima 2B Style Explorer, LoRA trainer reports

## Key Model Characteristics

Anima is NOT another SDXL finetune. It's built on NVIDIA Cosmos (DiT) with a Qwen3 0.6B text encoder. This fundamentally changes how prompting works:

- Supports three input modes: Danbooru tags, natural language, and free mixing
- Uses Gelbooru tags (not Danbooru) when they differ
- Tags use spaces (not underscores), except score tags
- Artist tags require mandatory `@` prefix
- Weight syntax needs higher values than SDXL: `(tag:2)` is reasonable
- DPM samplers don't work at all — use er_sde
- Has repetitive composition tendency across seeds
- Multi-artist prompts cause style dilution
- Supports temporal tags (year, newest, recent, etc.)
- Dataset tags for non-anime styles (ye-pop, deviantart)

## Changes

### 1. Fix `model-profiles.ts` Anima entry

Corrections:
- `promptStyle`: `"tags"` → `"hybrid"`
- `scheduler`: `"normal"` → `"sgm_uniform"`
- Add missing resolutions: `"832×1216"`, `"1216×896"`
- Expand `tips` with critical info: Gelbooru priority, @ prefix mandatory, higher weights, no DPM, quality tag caveat

### 2. Create `anima.md` prompt module

Following the same 4-step structure as `zit.md` and `illustrious.md`:
1. Determine anchor
2. Description strategy (hybrid: tags + natural language)
3. Information trade-offs
4. Conflict checking
5. Parameter quick reference
6. Examples (good and bad)

The module must cover Anima-specific behaviors:
- How to mix tags and natural language effectively
- Gelbooru tag format rules
- Artist tag @ prefix usage
- Weight scaling differences from SDXL
- Sampler selection and why DPM doesn't work
- How to avoid repetitive compositions
- Multi-artist style dilution warning
- Temporal and dataset tag usage

### 3. Register in `modules.json`

Add `"anima": { "file": "anima.md", "enabled": true }` to `model_modules`.

## Out of Scope

- LoRA training guidance
- Turbo LoRA support
- Highres fix / ADetailer configuration
- Non-anime dataset prompting (ye-pop, deviantart) — mentioned briefly but not detailed
