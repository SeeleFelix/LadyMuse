# Anima Prompt Best Practices Alignment

Fix Anima prompt guidance to match the official model card and community best practices, and refactor the style guidance architecture to use file-based per-model overrides.

## Problem

The current Anima prompt rules diverge from official guidance in multiple ways that affect generation quality:

1. **CFG range wrong** — 4-6 should be 4-5 (official model card)
2. **Hybrid guidance too rigid** — forces "tags prefix + NL content" when official says arbitrary mixing is fine
3. **Missing critical best practices** — tag order, artist mixing syntax, score tag caveat, BREAK warning, comma-space requirement, NL capitalization, dataset tags, beta57 scheduler
4. **Wrong fallback for non-hybrid styles** — generic STYLE_GUIDANCE has rules that are incorrect for Anima (75-token limit, no weight syntax)

## Architecture Change

### Current

Style guidance lives as hardcoded strings in `system-prompt.ts`:
- `STYLE_GUIDANCE` — generic Record keyed by style name (tags/hybrid/natural)
- `ANIMA_HYBRID_GUIDANCE` — one special override for Anima hybrid only
- Other models fall back to generic guidance, which contains model-specific inaccuracies

### New

Style guidance follows the same file-based pattern as prompt modules:

```
src/lib/server/agent/prompts/
├── styles/
│   └── anima/
│       ├── tags.md
│       ├── hybrid.md
│       └── natural.md
├── 00-persona.md
├── anima.md
├── zit.md
└── ...
```

`system-prompt.ts` loads per-model style files, falls back to generic `STYLE_GUIDANCE`:

```typescript
function loadStyleGuidance(modelId: string, promptStyle: string): string {
  const styleFile = join(import.meta.dirname, "prompts", "styles", modelId, `${promptStyle}.md`);
  try {
    return readFileSync(styleFile, "utf-8");
  } catch {
    return STYLE_GUIDANCE[promptStyle] ?? STYLE_GUIDANCE.hybrid;
  }
}
```

- Remove `ANIMA_HYBRID_GUIDANCE` constant, merge into `styles/anima/hybrid.md`
- `STYLE_GUIDANCE` remains as generic fallback for models without per-model files
- Adding per-model guidance for other models in the future only requires adding files

## Content Changes

### model-profiles.ts

- `cfgRange: [4, 6]` → `[4, 5]`
- Update `tips` string: fix CFG range mention, add missing best practice pointers

### anima.md

**Fix:**
- CFG range: 4-6 → 4-5
- Weight guidance: specify range 2-5 (not just "higher than SDXL")

**Add:**
- Official tag order: `[quality/meta/year/safety] [1girl/1boy/1other] [character] [series] [artist] [general tags]`
- Artist mixing syntax: `@[artist1|artist2]` alternating words (side-by-side doesn't work)
- Score tag caveat: score_9/8/7 pushes western art style; for flat anime, remove or add `anime screenshot` / `anime coloring`
- BREAK warning: BREAK is SD/SDXL-specific 75-token chunk separator; Anima interprets it literally as "destroy" — must not use
- Comma-space requirement: space after comma is critical, significantly affects results
- NL capitalization: character/series names follow standard English capitalization
- Dataset tags: `ye-pop` / `deviantart` prefix for non-anime artistic styles (tag + newline + description)
- beta57 scheduler: for realistic/painterly textures, from RES4LYF custom node pack

**Keep unchanged:**
- Overall 5-step structure
- Lowercase + spaces-instead-of-underscores rules
- Gelbooru priority rule
- Tag dropout explanation
- Multi-character naming rules
- Positive/negative prompt recommendations
- Sampler recommendation table
- Good/bad examples (minor adjustments only)

### styles/anima/hybrid.md

Replace `ANIMA_HYBRID_GUIDANCE`. Key changes:
- Remove rigid "tags prefix + NL content" requirement
- State that tags and NL can mix in arbitrary order
- "Tags prefix + NL" is the recommended pattern (matches official examples), not the only valid one
- Include `@[artist1|artist2]` mixing syntax
- Emphasize comma-space requirement

### styles/anima/tags.md (new)

Anima-specific tag-only guidance. Differs from generic `STYLE_GUIDANCE.tags`:
- No 75-token limit (Qwen3 encoder, not CLIP)
- Supports weight syntax `(keyword:weight)`, values 2-5
- Follow official tag order
- Artist tags require `@` prefix
- No need to exhaustively list tags (tag dropout)
- BREAK is forbidden

### styles/anima/natural.md (new)

Anima-specific natural language guidance. Differs from generic `STYLE_GUIDANCE.natural`:
- Supports weight syntax (generic says "don't use weight syntax")
- Can place quality/artist tags at beginning of NL prompt
- At least 2 complete sentences required
- Character/series names follow standard English capitalization
- BREAK is forbidden

## Files Changed

| File | Action |
|------|--------|
| `src/lib/server/agent/prompts/anima.md` | Rewrite |
| `src/lib/server/agent/prompts/styles/anima/hybrid.md` | New (replaces ANIMA_HYBRID_GUIDANCE) |
| `src/lib/server/agent/prompts/styles/anima/tags.md` | New |
| `src/lib/server/agent/prompts/styles/anima/natural.md` | New |
| `src/lib/server/agent/system-prompt.ts` | Refactor: remove ANIMA_HYBRID_GUIDANCE, add loadStyleGuidance |
| `src/lib/server/agent/model-profiles.ts` | Fix CFG range, update tips |

## References

- [Anima Official Model Card](https://huggingface.co/circlestone-labs/Anima/blob/main/README.md)
- [Anima Beginner Guide (Japanese)](https://note.com/hirorohi03/n/n2195c7ca70be)
- [Reddit: Anima Tips](https://www.reddit.com/r/StableDiffusion/comments/1t5b87p/anima_tips/)
- [Anima 2B Style Explorer](https://thetacursed.github.io/Anima-Style-Explorer/about.html)
