# Civitai Query Tools Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3 existing Civitai tools (1 enabled, 2 disabled) with 2 flexible query tools that expose the full Civitai API to the AI.

**Architecture:** Rewrite the API client (`civitai.ts`) to accept parameter objects mapping directly to Civitai REST API params. Build two tool definitions on top: `search_civitai_images` (unified image search with prompts) and `search_civitai_models` (model lookup). Remove all fallback logic — the tool reports empty results honestly.

**Tech Stack:** TypeScript, SvelteKit server, AI SDK `tool()` with Zod schemas, Civitai REST API v1

**Spec:** `docs/superpowers/specs/2026-05-24-civitai-query-tools.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/server/civitai.ts` | **Rewrite** | API client: parameter types, `searchImages()`, `searchModels()`, HTTP infrastructure |
| `src/lib/server/agent/tools.ts` | **Modify** | Replace 3 Civitai tool definitions with 2 new ones, update `allToolDefinitions` |
| `src/lib/server/agent/prompts/modules.json` | **Modify** | Update tool name entries and enabled flags |
| `src/lib/server/agent/prompts/02-civitai-guidance.md` | **Rewrite** | Teach AI how to combine params for different query scenarios |

---

### Task 1: Rewrite `src/lib/server/civitai.ts`

**Files:**
- Rewrite: `src/lib/server/civitai.ts`

This task replaces the entire file. The HTTP infrastructure (retry, fallback URLs) stays; the API functions and types are rebuilt from scratch.

- [ ] **Step 1: Rewrite the file**

```typescript
const BASE_URLS = ["https://civitai.red", "https://civitai.com"];
const TIMEOUT = 15000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, retries = 3): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) await sleep(800 * Math.pow(2, attempt - 1));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e: any) {
      if (attempt === retries) throw e;
    }
  }
}

async function fetchWithFallback(path: string): Promise<any> {
  let lastError: any;
  for (const base of BASE_URLS) {
    try {
      return await fetchWithRetry(`${base}${path}`);
    } catch (e: any) {
      lastError = e;
      continue;
    }
  }
  throw lastError;
}

// --- Types ---

export interface CivitaiImage {
  id: number;
  url?: string;
  width?: number;
  height?: number;
  baseModel?: string;
  username?: string;
  createdAt?: string;
  stats?: { likeCount?: number; commentCount?: number; heartCount?: number };
  meta?: {
    prompt?: string;
    negativePrompt?: string;
    sampler?: string;
    cfgScale?: number;
    steps?: number;
    seed?: number;
    Size?: string;
    resources?: { name: string; type: string }[];
    [key: string]: any;
  };
}

export interface CivitaiModel {
  id: number;
  name: string;
  type?: string;
  baseModel?: string;
  description?: string;
  tags?: string[];
  stats?: { downloadCount?: number; thumbsUpCount?: number };
}

interface PageResult<T> {
  items: T[];
  nextCursor?: string;
}

// --- Image sort/period enums (mirrors Civitai API) ---

export const IMAGE_SORT_OPTIONS = [
  "Most Reactions",
  "Most Comments",
  "Most Collected",
  "Newest",
  "Oldest",
] as const;

export const IMAGE_PERIOD_OPTIONS = [
  "AllTime",
  "Year",
  "Month",
  "Week",
  "Day",
] as const;

export interface SearchImagesParams {
  query?: string;
  sort?: (typeof IMAGE_SORT_OPTIONS)[number];
  period?: (typeof IMAGE_PERIOD_OPTIONS)[number];
  baseModels?: string;
  modelId?: number;
  username?: string;
  limit?: number;
  cursor?: string;
}

export async function searchImages(
  params: SearchImagesParams,
): Promise<PageResult<CivitaiImage>> {
  const p = new URLSearchParams();
  if (params.query) p.set("query", params.query);
  if (params.sort) p.set("sort", params.sort);
  if (params.period) p.set("period", params.period);
  if (params.baseModels) p.set("baseModels", params.baseModels);
  if (params.modelId != null) p.set("modelId", String(params.modelId));
  if (params.username) p.set("username", params.username);
  if (params.limit != null) p.set("limit", String(params.limit));
  if (params.cursor) p.set("cursor", params.cursor);

  const data = await fetchWithFallback(`/api/v1/images?${p.toString()}`);
  return {
    items: data.items || [],
    nextCursor: data.metadata?.nextCursor,
  };
}

// --- Model sort/period enums ---

export const MODEL_SORT_OPTIONS = [
  "Highest Rated",
  "Most Downloaded",
  "Newest",
  "Most Liked",
] as const;

export const MODEL_PERIOD_OPTIONS = IMAGE_PERIOD_OPTIONS;

export interface SearchModelsParams {
  query: string;
  types?: string;
  baseModels?: string;
  sort?: (typeof MODEL_SORT_OPTIONS)[number];
  period?: (typeof MODEL_PERIOD_OPTIONS)[number];
  limit?: number;
}

export async function searchModels(
  params: SearchModelsParams,
): Promise<PageResult<CivitaiModel>> {
  const p = new URLSearchParams();
  if (params.query) p.set("query", params.query);
  if (params.types) p.set("types", params.types);
  if (params.baseModels) p.set("baseModels", params.baseModels);
  if (params.sort) p.set("sort", params.sort);
  if (params.period) p.set("period", params.period);
  if (params.limit != null) p.set("limit", String(params.limit));

  const data = await fetchWithFallback(
    `/api/v1/models?${p.toString()}`,
  );
  const items = (data.items || []).map((m: any) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    baseModel: m.modelVersions?.[0]?.baseModel,
    description: m.description,
    tags: m.tags?.map((t: any) => (typeof t === "string" ? t : t.name)),
    stats: m.stats,
  }));
  return {
    items,
    nextCursor: data.metadata?.nextCursor,
  };
}
```

Key changes from old version:
- `searchImages` now accepts a `SearchImagesParams` object with all Civitai API params exposed
- `searchModels` now accepts a `SearchModelsParams` object
- Removed `searchImagesWithFallback`, `fetchPopularImages`, `fetchModelImages`, `fetchTags`
- Removed standalone `CivitaiTag` interface
- Added `username`, `createdAt`, `resources` to `CivitaiImage`
- Exported sort/period const arrays so tools can reference them in descriptions
- `searchModels` now extracts `baseModel` from `modelVersions[0]` (the API returns it there)

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/lib/server/civitai.ts`
Expected: No errors. If there are import errors from `tools.ts` (expected, since old exports are gone), proceed to Task 2.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/civitai.ts
git commit -m "refactor: rewrite civitai API client with full parameter support"
```

---

### Task 2: Replace Civitai tool definitions in `tools.ts`

**Files:**
- Modify: `src/lib/server/agent/tools.ts`

This task:
1. Updates the import from `civitai.ts` (old had 6 imports, new needs 2)
2. Replaces 3 Civitai tool definitions with 2 new ones
3. Updates `allToolDefinitions` map

- [ ] **Step 1: Update the import**

In `src/lib/server/agent/tools.ts`, replace lines 22-28:

```typescript
// OLD:
import {
  searchModels,
  searchImages,
  searchImagesWithFallback,
  fetchModelImages,
  fetchPopularImages,
  fetchTags,
} from "../civitai";

// NEW:
import { searchImages, searchModels } from "../civitai";
```

- [ ] **Step 2: Replace the 3 Civitai tool definitions**

Delete `searchCivitaiModels` (lines ~281-302), `searchCivitaiPrompts` (lines ~304-353), and `searchCivitaiTags` (lines ~355-369) entirely. Replace with these two new tools:

```typescript
export const searchCivitaiImages = tool({
  description: `Search Civitai for AI-generated images with prompts and generation parameters. Use this to find real prompt references, study how others write prompts for specific styles/subjects, or browse a model's gallery.

Tips:
- query must be English keywords
- Use different sort+period combinations for variety: sort="Newest" period="Week" for recent trends, sort="Most Comments" for discussion-worthy works
- Use modelId to browse a specific model or LoRA's gallery
- Use baseModels to filter by target architecture (e.g. "Illustrious", "SDXL 1.0", "Flux.1 D")
- Use username to study a specific creator's prompting style
- Use cursor to paginate through more results
- Results include image URLs`,
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe(
        "Search keywords, English, e.g. 'crying girl', 'landscape sunset'. Don't pass this when browsing by modelId or username.",
      ),
    sort: z
      .enum(["Most Reactions", "Most Comments", "Most Collected", "Newest", "Oldest"])
      .optional()
      .describe("Sort order, default 'Most Reactions'"),
    period: z
      .enum(["AllTime", "Year", "Month", "Week", "Day"])
      .optional()
      .describe("Time window, default 'AllTime'"),
    baseModels: z
      .string()
      .optional()
      .describe(
        "Filter by base model: Illustrious, SDXL 1.0, SD 1.5, Pony, Flux.1 D, etc.",
      ),
    modelId: z
      .number()
      .optional()
      .describe("Images from a specific model's gallery"),
    username: z
      .string()
      .optional()
      .describe("Images from a specific creator"),
    limit: z
      .number()
      .min(1)
      .max(20)
      .optional()
      .describe("Results per page, default 10, max 20"),
    cursor: z
      .string()
      .optional()
      .describe("Pagination cursor from previous response"),
  }),
  execute: async (params) => {
    try {
      const result = await searchImages({
        query: params.query,
        sort: params.sort,
        period: params.period,
        baseModels: params.baseModels,
        modelId: params.modelId,
        username: params.username,
        limit: params.limit ?? 10,
        cursor: params.cursor,
      });

      const images = result.items.map((img) => ({
        id: img.id,
        url: img.url,
        width: img.width,
        height: img.height,
        baseModel: img.baseModel,
        likes: img.stats?.likeCount,
        username: img.username,
        createdAt: img.createdAt,
        meta: img.meta
          ? {
              prompt: img.meta.prompt,
              negativePrompt: img.meta.negativePrompt || undefined,
              sampler: img.meta.sampler,
              cfgScale: img.meta.cfgScale,
              steps: img.meta.steps,
              size: img.meta.Size,
              resources: img.meta.resources,
            }
          : null,
      }));

      const withPrompt = images.filter((i) => i.meta?.prompt).length;

      return {
        images,
        nextCursor: result.nextCursor,
        meta: {
          returned: images.length,
          withPrompt,
          withoutPrompt: images.length - withPrompt,
        },
      };
    } catch (e: any) {
      return {
        error: `Civitai search failed: ${e.message}`,
        notice: "Please generate prompts based on your professional knowledge.",
      };
    }
  },
});

export const searchCivitaiModels = tool({
  description: `Search Civitai for AI image models (checkpoints, LoRAs, etc.). Returns model info: name, type, base model, tags, stats, description. To see a model's generated images with prompts, use search_civitai_images with that model's ID.`,
  inputSchema: z.object({
    query: z.string().describe("Search by model name, English"),
    types: z
      .string()
      .optional()
      .describe(
        "Model type filter: Checkpoint, LORA, DoRA, Controlnet, Upscaler, etc.",
      ),
    baseModels: z
      .string()
      .optional()
      .describe("Filter by base model: Illustrious, SDXL 1.0, SD 1.5, etc."),
    sort: z
      .enum(["Highest Rated", "Most Downloaded", "Newest", "Most Liked"])
      .optional()
      .describe("Sort order, default 'Highest Rated'"),
    period: z
      .enum(["AllTime", "Year", "Month", "Week", "Day"])
      .optional()
      .describe("Time window, default 'AllTime'"),
    limit: z
      .number()
      .min(1)
      .max(10)
      .optional()
      .describe("Results count, default 5, max 10"),
  }),
  execute: async (params) => {
    try {
      const result = await searchModels({
        query: params.query,
        types: params.types,
        baseModels: params.baseModels,
        sort: params.sort,
        period: params.period,
        limit: params.limit ?? 5,
      });

      return {
        models: result.items.map((m) => ({
          id: m.id,
          name: m.name,
          type: m.type,
          baseModel: m.baseModel,
          tags: m.tags?.slice(0, 15),
          downloads: m.stats?.downloadCount,
          likes: m.stats?.thumbsUpCount,
          description: m.description?.slice(0, 300),
        })),
      };
    } catch (e: any) {
      return {
        error: `Civitai model search failed: ${e.message}`,
        notice: "Please proceed without model information.",
      };
    }
  },
});
```

- [ ] **Step 3: Update `allToolDefinitions` map**

In the same file, update the `allToolDefinitions` object (around line 1014). Replace the three Civitai entries:

```typescript
// OLD:
  search_civitai_models: searchCivitaiModels,
  search_civitai_prompts: searchCivitaiPrompts,
  search_civitai_tags: searchCivitaiTags,

// NEW:
  search_civitai_images: searchCivitaiImages,
  search_civitai_models: searchCivitaiModels,
```

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No Civitai-related errors. Other pre-existing errors are out of scope.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/agent/tools.ts
git commit -m "feat: replace 3 civitai tools with search_civitai_images + search_civitai_models"
```

---

### Task 3: Update `modules.json`

**Files:**
- Modify: `src/lib/server/agent/prompts/modules.json`

- [ ] **Step 1: Update tool entries**

In the `"tools"` array, remove `search_civitai_prompts` and `search_civitai_tags`, add `search_civitai_images`, enable `search_civitai_models`:

```json
    { "name": "search_civitai_models", "enabled": true },
    { "name": "search_civitai_images", "enabled": true },
```

The other tool entries stay unchanged.

- [ ] **Step 2: Verify JSON is valid**

Run: `python3 -c "import json; json.load(open('src/lib/server/agent/prompts/modules.json')); print('valid')"`
Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/agent/prompts/modules.json
git commit -m "config: update modules.json for new civitai tools"
```

---

### Task 4: Rewrite Civitai guidance prompt

**Files:**
- Rewrite: `src/lib/server/agent/prompts/02-civitai-guidance.md`

- [ ] **Step 1: Rewrite the file**

```markdown
## Civitai Query Guide

You have two Civitai tools. Use them flexibly based on what information you need.

### search_civitai_images — finding prompt references

Common query strategies:

**Find prompts for a style/subject:**
- query="cyberpunk city" + sort="Most Reactions" → proven, high-quality prompts
- query="cyberpunk city" + sort="Newest" + period="Month" → fresh approaches, less homogenized

**Browse a model/LoRA's gallery:**
- First use search_civitai_models to find the model ID
- Then search_civitai_images with modelId=12345 → see how others prompt with that model

**Study a creator's style:**
- search_civitai_images with username="artist_name" + sort="Most Reactions" → their best work

**Filter by architecture:**
- Add baseModels="Illustrious" (or "SDXL 1.0", "SD 1.5", etc.) to ensure prompts are relevant to the user's setup

**Paginate for more:**
- If the first page has few usable prompts, use the returned nextCursor to fetch more

### search_civitai_models — finding models

Use when the user asks about available models for a style, or wants to find a specific LoRA/checkpoint.
To see a model's images, take the model ID and use search_civitai_images with modelId.

### Working with results

- Images with meta.prompt contain real generation parameters — extract keywords, patterns, parameter configurations
- Images without prompt still have url/likes — useful for visual reference but not prompt study
- The meta.withPrompt count tells you how many results are actually useful for prompt analysis
- Don't copy prompts directly — extract effective patterns and recombine with your own understanding
- If search returns 0 results, tell the user honestly and generate based on your professional knowledge
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/agent/prompts/02-civitai-guidance.md
git commit -m "docs: rewrite civitai guidance for new query tools"
```

---

### Task 5: End-to-end verification

- [ ] **Step 1: Start the dev server and verify no runtime errors**

Run: `npm run dev` (or the project's dev command)

Open the app and trigger a chat with the AI. Ask something like "帮我找一些 cyberpunk 风格的提示词参考". Verify:
- The AI calls `search_civitai_images` (not the old `search_civitai_prompts`)
- Results include image URLs, prompts, and structured metadata
- No crashes or import errors

- [ ] **Step 2: Test a few query scenarios**

Try these in chat:
1. "搜一下 Illustrious 模型最近一周有什么好图" → should use sort="Newest" period="Week" baseModels="Illustrious"
2. "帮我找 cyberpunk city 的提示词" → should use query="cyberpunk city"
3. "有哪些好的 anime checkpoint" → should call search_civitai_models

If all pass, the implementation is complete.
