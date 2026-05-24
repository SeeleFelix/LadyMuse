# Civitai Query Tools Redesign

## Problem

The current Civitai integration has 3 tools (`search_civitai_models`, `search_civitai_prompts`, `search_civitai_tags`), but only `search_civitai_prompts` is enabled. It has fundamental issues:

1. **No query flexibility** - hardcoded to `sort=Most Reactions`, no model/period/username filtering, no pagination
2. **Always same results** - no sort/period variety means the AI sees the same popular images regardless of intent
3. **Raw data dump** - returns up to 30 raw prompts with no structure, wasting tokens and forcing the AI to do all analysis in one shot
4. **Misleading fallback** - progressively degrades query (full -> 2 words -> 1 word -> popular), giving irrelevant results silently
5. **Tags tool is useless for prompts** - it queries model tags, not image tags

The root cause: the tool tries to be "smart" (fallback, pre-filtering, bulk dump) instead of giving the AI flexible access to Civitai's data.

## Design Principle

**Tools are pipes, not brains.** Expose Civitai API capabilities to the AI, let the AI decide how to query and interpret results.

## API Verification Summary

Tested against `civitai.com/api/v1/` on 2026-05-24:

| Feature | Status | Notes |
|---|---|---|
| `baseModels` filter | Verified | Works on both images and models endpoints |
| `modelId` filter | Verified | Browse a specific model's gallery |
| `username` filter | Verified | Filter by creator |
| `sort` options | Verified | Most Reactions / Newest / Most Comments / Most Collected / Oldest all work |
| `period` options | Verified | AllTime / Year / Month / Week / Day all work |
| `sort=Random` | **Unreliable** | Returns identical IDs across multiple calls; server-side caching suspected |
| Cursor pagination | Verified | `nextCursor` format varies but functional |
| `withMeta` param | **No effect** | Images with meta always include it regardless of param |
| Prompt coverage | 95% | Among Most Reactions images, 95% include prompt data |
| `civitai.red` fallback | Verified | Still operational |

## Tool Design

### Replace 3 tools with 2

```
Current:                          New:
  search_civitai_models (OFF)  ->  search_civitai_models (rewritten)
  search_civitai_prompts (ON)  ->  search_civitai_images (new, replaces prompts)
  search_civitai_tags (OFF)    ->  (removed)
```

---

### Tool 1: `search_civitai_images`

Replaces `search_civitai_prompts` and `search_civitai_tags`. A unified image search tool exposing the Civitai Images API's core parameters.

**Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `query` | string (optional) | - | Text search keywords. English works best. |
| `sort` | enum (optional) | `Most Reactions` | `Most Reactions` / `Newest` / `Most Comments` / `Most Collected` / `Oldest` |
| `period` | enum (optional) | `AllTime` | `AllTime` / `Year` / `Month` / `Week` / `Day` |
| `baseModels` | string (optional) | - | Filter by base model: `Illustrious`, `SDXL 1.0`, `SD 1.5`, `Pony`, `Flux.1 D`, etc. |
| `modelId` | number (optional) | - | Images from a specific model's gallery. |
| `username` | string (optional) | - | Images from a specific creator. |
| `limit` | number (optional) | `10` | Results per page, 1-20. |
| `cursor` | string (optional) | - | Pagination cursor from previous response. |

**Returns:**

```json
{
  "images": [
    {
      "id": 12345,
      "url": "https://image.civitai.com/...",
      "width": 1024,
      "height": 1536,
      "baseModel": "Illustrious",
      "likes": 500,
      "username": "artist_name",
      "createdAt": "2026-05-20T...",
      "meta": {
        "prompt": "...",
        "negativePrompt": "...",
        "sampler": "Euler a",
        "cfgScale": 7,
        "steps": 25,
        "Size": "832x1216",
        "resources": [
          { "name": "...", "type": "lora" }
        ]
      }
    }
  ],
  "nextCursor": "1|1779600000000",
  "meta": {
    "returned": 10,
    "withPrompt": 9,
    "withoutPrompt": 1
  }
}
```

- Images without `meta.prompt` still include `id`, `url`, `likes` etc. but `meta` may be `null` or lack `prompt`.
- `meta` counts let the AI know how many results actually have usable prompt data.
- `resources` field from meta is included so the AI can see which LoRAs/models were used.

**Tool description (for AI):**

> Search Civitai for AI-generated images with prompts and generation parameters. Use this to find real prompt references, study how others write prompts for specific styles/subjects, or browse a model's gallery.
>
> Tips:
> - query must be English keywords
> - Use different sort+period combinations for variety: sort="Newest" period="Week" for recent trends, sort="Most Comments" for discussion-worthy works
> - Use modelId to browse a specific model or LoRA's gallery
> - Use baseModels to filter by target architecture (e.g. "Illustrious")
> - Use cursor to paginate through more results
> - Results include image URLs - you can reference them

---

### Tool 2: `search_civitai_models`

Rewritten from the disabled original. Leaner - returns model info only, no images (use `search_civitai_images` with `modelId` for gallery).

**Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `query` | string | required | Search by model name. |
| `types` | enum (optional) | - | `Checkpoint` / `LORA` / `DoRA` / `Controlnet` / etc. |
| `baseModels` | string (optional) | - | Filter by base model. |
| `sort` | enum (optional) | `Highest Rated` | `Highest Rated` / `Most Downloaded` / `Newest` / `Most Liked` |
| `period` | enum (optional) | `AllTime` | `AllTime` / `Year` / `Month` / `Week` / `Day` |
| `limit` | number (optional) | `5` | 1-10. |

**Returns:**

```json
{
  "models": [
    {
      "id": 4201,
      "name": "Realistic Vision V6.0 B1",
      "type": "Checkpoint",
      "baseModel": "SD 1.5",
      "tags": ["anime", "realistic", "photorealistic"],
      "downloads": 2219523,
      "likes": 12345,
      "description": "..." // truncated to 300 chars
    }
  ]
}
```

**Tool description (for AI):**

> Search Civitai for AI image models (checkpoints, LoRAs, etc.). Returns model info: name, type, base model, tags, download/like counts, and description. To see a model's generated images with prompts, use search_civitai_images with that model's ID.

---

## Implementation Changes

### 1. Rewrite `src/lib/server/civitai.ts`

- Remove `searchImagesWithFallback` and all fallback logic
- New function: `searchImages(params)` accepting the full parameter set
- New function: `searchModels(params)` accepting types/baseModels/sort/period
- Keep `fetchWithRetry` and `fetchWithFallback` for reliability
- Remove `fetchTags`, `fetchPopularImages`, `fetchModelImages` (no longer needed)

### 2. Rewrite Civitai tools in `src/lib/server/agent/tools.ts`

- Delete `searchCivitaiPrompts`, `searchCivitaiTags`, old `searchCivitaiModels`
- Add `searchCivitaiImages` and `searchCivitaiModels` (new implementations)
- Update `allToolDefinitions` map:
  - `search_civitai_models` -> new `searchCivitaiModels`
  - `search_civitai_images` -> new `searchCivitaiImages`
  - Remove `search_civitai_prompts` and `search_civitai_tags`

### 3. Update `src/lib/server/agent/prompts/modules.json`

- Remove `search_civitai_prompts` and `search_civitai_tags`
- Add `search_civitai_images` (enabled)
- Keep `search_civitai_models` (change to enabled)

### 4. Rewrite `src/lib/server/agent/prompts/02-civitai-guidance.md`

Replace the current 3-line guidance with practical instructions on how to combine parameters for different query scenarios:
- Finding prompt references for a style/subject
- Browsing a specific model's gallery
- Exploring recent trends
- Studying a specific creator's prompting style
- Getting diverse results (use sort+period combinations, not Random)

### 5. Update guidance content

Teach the AI when to use which parameters, not just "don't copy prompts." Focus on query strategies:
- Narrow search: specific query + baseModels + sort=Most Reactions
- Broad exploration: short query + sort=Newest + period=Week
- Model-specific: modelId + sort=Most Reactions
- Creator study: username + sort=Newest

## Out of Scope

- **Local caching/indexing** - out of scope for this iteration; the API is responsive enough
- **Semantic search** - the Civitai API doesn't support it; for semantic needs, use the existing Danbooru knowledge base
- **Image analysis** - the tool returns URLs but doesn't analyze image content
- **Random sort** - verified unreliable, excluded from the design
