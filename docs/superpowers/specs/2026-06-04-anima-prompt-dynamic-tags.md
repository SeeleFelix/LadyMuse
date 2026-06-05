# Anima Prompt Dynamic Tag System

Rewrite Anima prompt guidance to replace hardcoded quality/negative/safety tag templates with a scenario-indexed reference system. The AI reads all options in the system prompt and dynamically selects the best combination for each image.

## Problem

Current Anima prompts always output the same quality tags (`masterpiece, best quality, score_7, safe`) and negative prompt (`worst quality, low quality, score_1, score_2, score_3, artist name`) regardless of style or content. This causes:

1. **Quality tags ignore style** — `score_7` pushes toward western/Pony aesthetic; flat anime should omit it or add `anime screenshot`
2. **Negative prompts are too thin** — no anatomical fixes for characters, no watermark removal, no style exclusion
3. **Safety tag is always `safe`** — no consideration for content that warrants `sensitive`
4. **Files contain hardcoded "recommended prefix"** — the prompt says "use these exact tags" instead of teaching the AI to choose
5. **anima.md and styles/anima/ have heavy content duplication** — core rules repeated across 4 files

## Design

### Single source of truth in anima.md

All model-specific operational data (quality tags, negative prompts, safety tags, sampler settings, pitfalls) lives in `anima.md` as a structured reference section. No separate files, no knowledge base entries — it's model config, not art knowledge.

The content is organized as **scenario-indexed options**, not fixed templates. The AI reads the options and picks based on the current image's style, subject, and intent.

### Content structure of anima.md

```
1. Model overview (one line)
2. Core format rules (lowercase, spaces, comma-space, BREAK ban, weight syntax)
3. Tag order
4. Artist rules (@ prefix, mixing syntax)
5. Quality tags — scenario table
6. Safety tags — scenario table
7. Negative prompts — layered composition
8. Sampler & parameters — scenario table
9. Special formats (dataset tags, multi-character, weight examples)
10. Pitfalls & caveats
11. Fallback defaults
```

### Quality tags — scenario table

Replace `推荐正向前缀：masterpiece, best quality, score_7, safe` with:

| Scenario | Tags | Notes |
|---|---|---|
| Default | `masterpiece, best quality` | Sufficient for most cases; model has tag dropout |
| Flat anime | `masterpiece, best quality, anime screenshot, anime coloring` | No score tags — they push western aesthetic |
| High quality (accept western drift) | `masterpiece, best quality, score_7, score_8_up` | score_9/8/7 push Pony-era aesthetic |
| Pure score system | `score_9, score_8_up, score_7_up` | PonyV7 aesthetic scoring only |
| Low-fi / retro | `normal quality, score_5` | Intentional downgrade |
| High detail density | `masterpiece, best quality, highres, absurdres` | Resolution meta tags stacked |
| Official art feel | `masterpiece, best quality, official art` | Official illustration aesthetic |
| Lineart / sketch | `monochrome, sketch, lineart` | Negative prompt must be adjusted accordingly |

### Safety tags — scenario table

| Tag | When to use |
|---|---|
| `safe` | General content (default) |
| `sensitive` | Suggestive but not explicit (swimwear, underwear, etc.) |
| `nsfw` | Explicit nudity |
| `explicit` | Extreme content |

One safety tag is mandatory. Omitting it causes unpredictable behavior.

### Negative prompts — layered composition

Instead of a fixed string, teach layered composition:

**Layer 1 — Always include:**
`worst quality, low quality, score_1, score_2, score_3, artist name`

**Layer 2 — When image contains characters:**
`bad hands, bad anatomy, missing fingers, extra digits, fewer digits, disfigured, mutation, 4 fingers, 6 fingers`

**Layer 3 — Face focus / portrait:**
`bad face, ugly face, deformed face, cross-eyed`

**Layer 4 — Watermark / text removal (on demand):**
`watermark, signature, text, logo, jpeg artifacts, patreon logo, patreon username, twitter username, twitter logo`

**Layer 5 — Style exclusion (on demand):**
`monochrome, sketch, multiple views, chibi, blurry, 3d`

**Layer 6 — Composition control (on demand):**
`cropped, out of frame, multiple views, close-up`

**Layer 7 — Landscape / no-character scenes:**
Replace layer 2 with: `person, human` + add layer 4

### Sampler & parameters — scenario table

| Goal | Sampler | CFG | Steps | Scheduler | Notes |
|---|---|---|---|---|---|
| Sharp lines, flat colors | `er_sde` | 4-5 | 25-35 | normal | Default, neutral |
| Soft, fine lines, 2.5D | `euler_a` | 4.5-5.5 | 25-30 | normal | CFG can go slightly above 5 |
| Variety, creative | `dpmpp_2m_sde_gpu` | 4-5 | 25-30 | normal | More variation, occasionally wild |
| Realistic / oil texture | `er_sde` | 4-5 | 30-35 | beta57 | RES4LYF custom node pack |

### Pitfalls & caveats

- `score_9/8/7` push toward Pony-era western aesthetic; for flat anime, omit or add `anime screenshot` / `anime coloring`
- BREAK is interpreted literally ("destroy"), forbidden
- Missing space after comma significantly degrades results
- NL section must be at least 2 sentences; shorter prompts produce unexpected results
- Base model has no aesthetic tuning — without artist/quality tags, output is very plain
- Artist tags without `@` prefix have very weak effect
- Mixed artists must use `@[artist1|artist2]` syntax; side-by-side `@a, @b` is ineffective
- `ye-pop` dataset tag for abstract/contemporary art; `deviantart` for digital painting — placed at prompt start with newline separator

### Fallback defaults

When the AI cannot determine the appropriate scenario:

- Quality: `masterpiece, best quality, safe`
- Negative: `worst quality, low quality, score_1, score_2, score_3, artist name`

### Style guidance files — cleanup

`styles/anima/` files are trimmed to only contain format-specific instructions. Core rules (lowercase, spaces, BREAK ban, etc.) are NOT repeated — they live only in `anima.md`.

**hybrid.md** — Only:
- Hybrid format definition (tags + NL mixed)
- Recommended pattern: metadata tags prefix, then NL content
- NL minimum 2 sentences, cover subject/environment/lighting/color
- One brief example

**tags.md** — Only:
- Pure tag format definition
- One brief example

**natural.md** — Only:
- NL format definition (quality/artist tags allowed at beginning)
- NL writing guidelines
- One brief example

### model-profiles.ts updates

- `tips` array: remove hardcoded "推荐正向前缀" and "推荐负面提示词" lines
- Add tip pointing to the scenario tables in the system prompt
- CFG range stays [4, 5] (already correct)

## Files Changed

| File | Action |
|---|---|
| `src/lib/server/agent/prompts/anima.md` | Full rewrite: scenario tables, layered negatives, pitfalls |
| `src/lib/server/agent/prompts/styles/anima/hybrid.md` | Trim: remove duplicated core rules |
| `src/lib/server/agent/prompts/styles/anima/tags.md` | Trim: remove duplicated core rules |
| `src/lib/server/agent/prompts/styles/anima/natural.md` | Trim: remove duplicated core rules |
| `src/lib/server/agent/model-profiles.ts` | Update tips: remove hardcoded tag recommendations |

## Research Sources

- [Anima Official Model Card (HuggingFace)](https://huggingface.co/circlestone-labs/Anima)
- [HuggingFace Discussion #83 — Score tag bias analysis](https://huggingface.co/circlestone-labs/Anima/discussions/83)
- [HuggingFace Discussion #112 — Architecture analysis](https://huggingface.co/circlestone-labs/Anima/discussions/112)
- [Civitai — Anima Base v1.0](https://civitai.com/models/2458426/anima)
- [Civitai — SlivAnimix (community finetune negative prompts)](https://civitai.com)
- [Civitai — BlenderMix (community checkpoint negative prompts)](https://civitai.com)
- [Reddit r/StableDiffusion — Anima settings](https://www.reddit.com/r/StableDiffusion/comments/1qzaj8l/best_settings_for_anima/)
- [ComfyUI Official Anima Tutorial](https://docs.comfy.org/tutorials/image/anima/anima)
- [RES4LYF Custom Node Pack (beta57 scheduler)](https://github.com/ClownsharkBatwing/RES4LYF)
