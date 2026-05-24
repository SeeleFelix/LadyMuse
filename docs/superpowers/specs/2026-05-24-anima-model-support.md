# Anima Model Support

## Goal

Add a prompt assembly module (`anima.md`) for the Anima model and fix the existing `model-profiles.ts` config, following the same pattern as `zit.md` and `illustrious.md`. Wire Anima into all integration points: model profile, prompt module, module registry, and UI model selector.

## Research Sources

- **Primary**: Civitai official model page (models/2458426/anima)
- HuggingFace: circlestone-labs/Anima (model files, encoder/VAE info)

## Key Model Characteristics

Anima is a 2B parameter model built on NVIDIA Cosmos-Predict2-2B-Text2Image, using a Qwen3 0.6B text encoder (NOT CLIP). This fundamentally changes how prompting works compared to SDXL derivatives:

- **Hybrid prompting**: Danbooru tags, natural language captions, or arbitrary mixing
- **Tag format**: lowercase, spaces instead of underscores (exception: score tags use underscores)
- **Weight syntax**: `(keyword:weight)` works, but needs higher weights than SDXL (e.g. `(chibi:2)`)
- **Gelbooru priority**: when Danbooru and Gelbooru tags differ, prefer Gelbooru
- **Artist tags**: mandatory `@` prefix (`@big chungus`), effect is very weak without it
- **Tag dropout**: trained with random tag dropout — exhaustive tagging is unnecessary
- **Safety tags**: `safe`, `sensitive`, `nsfw`, `explicit`
- **Time tags**: `year 2025`, `year 2024`, `newest`, `recent`, `mid`, `early`, `old`
- **Two quality tag systems**: human-score (`masterpiece`–`worst quality`) and PonyV7 (`score_9`–`score_1`), can mix/match/omit
- **NL minimum**: at least 2 sentences; extremely short prompts give unexpected results
- **Multi-character**: must name AND describe appearance per character
- **Dataset tags**: `ye-pop` / `deviantart` at prompt start + newline, for non-anime styles
- **Base model**: no aesthetic tuning — plain/neutral without quality/artist tags
- **Samplers**: `er_sde` (sharp, flat, default), `euler_a` (softer, thinner), `dpmpp_2m_sde_gpu` (creative, varied)
- **Scheduler**: default ComfyUI schedulers work; `beta57` optional for painterly look
- **Poor at**: realism (by design), text rendering (single words only), very short prompts

## Changes

### 1. Fix `model-profiles.ts` Anima entry

Corrections:
- `promptStyle`: `"tags"` → `"hybrid"`
- `cfgRange`: `[4.0, 5.0]` → `[4, 6]`
- Add missing resolutions: `"832×1216"`, `"1216×896"`
- Rewrite `tips` with: architecture overview, three-sampler comparison, Gelbooru priority, `@` prefix requirement, tag dropout note, NL minimum, safety tag names, base-model plain style warning

### 2. Create `anima.md` prompt module

Same 6-step structure as `zit.md` and `illustrious.md`:

1. **Determine anchor** — metadata tag prefix + NL subject sentence (hybrid anchor pattern unique to Anima)
2. **Description strategy** — metadata as tags (quality/safety/artist/time), content as NL (≥2 sentences), general tags sparingly (tag dropout)
3. **Information trade-offs** — must include: quality tags, safety tag, NL body ≥2 sentences; optional: year/artist/series; skippable: exhaustive general tags
4. **Conflict checking** — style/lighting/composition conflicts
5. **Parameter quick reference** — three-sampler decision table, steps/CFG/resolutions, recommended pos/neg prefixes
6. **Examples** — good (hybrid with metadata prefix + NL body) and bad (tags-only, NL too short, missing `@`, exhaustive tags)

### 3. Register in `modules.json`

Add `"anima": { "file": "anima.md", "enabled": true }` to `model_modules`.

### 4. Add to UI model selector

Add `{ id: "anima", name: "Anima", defaultStyle: "hybrid" }` to `imageModelProfiles` in `chat/+page.svelte`.

## Out of Scope

- LoRA training guidance and Turbo LoRA
- Highres fix / ADetailer configuration
- `beta57` scheduler setup (requires RES4LYF custom node pack — ComfyUI integration detail)
- Non-anime dataset prompting (`ye-pop`, `deviantart`) — mentioned as available but not detailed
- Anima-Turbo support (model not yet released)
