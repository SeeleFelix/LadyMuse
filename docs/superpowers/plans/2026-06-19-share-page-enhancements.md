# Share Page Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the share page for public internet exposure — strip image metadata, add download with clean images, show image info, add count stats, isolate network access via proxy, and merge duplicated components by reusing the main gallery's Lightbox and ThumbnailCard.

**Architecture:** A Node proxy limits public traffic to `/share` and `/api/share`. A new `/api/share/images/[...path]` endpoint strips ComfyUI metadata from full-size images using sharp. The share page drops its custom ShareLightbox/ShareCard in favor of the main gallery components, which gain feature-flag props and an extracted ImageInfo panel.

**Tech Stack:** SvelteKit, Svelte 5 (runes), sharp, Tailwind CSS, Node http module, TypeScript

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| **Create** | `proxy.js` | HTTP proxy filtering requests to `/share` and `/api/share` only |
| **Create** | `src/routes/api/share/images/[...path]/+server.ts` | Serve full-size images with metadata stripped (original format, no Exif/workflow data) |
| **Create** | `src/lib/components/gallery/ImageInfo.svelte` | Read-only display of filename, size, dimensions, format, rating, generation params |
| **Modify** | `src/lib/components/gallery/DetailPanel.svelte` | Replace inline file-info + metadata markup with `<ImageInfo>` |
| **Modify** | `src/lib/components/gallery/Lightbox.svelte` | Add `showZoom`, `showDownload`, `showCopyLink`, `showFilmstrip`, `showInfo`, `imageUrlBase` props; render `<ImageInfo>` in sidebar when `showInfo` |
| **Modify** | `src/lib/components/gallery/ThumbnailCard.svelte` | Add optional `thumbUrl` prop to override image source |
| **Modify** | `src/routes/share/+page.server.ts` | Return full image fields with `tags: []` and `collectionIds: []` for ImageResult compatibility |
| **Modify** | `src/routes/share/+page.svelte` | Use Lightbox + ThumbnailCard, add count display, add download handler, expanded ImageData |
| **Modify** | `package.json` | Parallel proxy startup in `dev` / `start` scripts |
| **Delete** | `src/lib/components/share/ShareLightbox.svelte` | Replaced by gallery/Lightbox |
| **Delete** | `src/lib/components/share/ShareCard.svelte` | Replaced by gallery/ThumbnailCard |

---

### Task 1: Create proxy.js

**Files:**
- Create: `proxy.js`

- [ ] **Step 1: Write the proxy script**

```js
import http from "node:http";

const TARGET_PORT = 3000;
const PROXY_PORT = 3001;

const ALLOWED = ["/share", "/api/share"];

const proxy = http.createServer((req, res) => {
  const allowed = ALLOWED.some((p) => req.url?.startsWith(p));
  if (!allowed) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const opts = {
    hostname: "127.0.0.1",
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  const upstream = http.request(opts, (upRes) => {
    res.writeHead(upRes.statusCode ?? 200, upRes.headers);
    upRes.pipe(res);
  });

  upstream.on("error", () => {
    res.writeHead(502);
    res.end("Bad Gateway");
  });

  req.pipe(upstream);
});

proxy.listen(PROXY_PORT, () => {
  console.log(`[proxy] :${PROXY_PORT} -> :${TARGET_PORT} (only /share, /api/share)`);
});
```

- [ ] **Step 2: Test the proxy manually**

Run: `node proxy.js` (keep running), then in another terminal:

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/share
# Expected: 200

curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/generations
# Expected: 403

curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/share/browse
# Expected: 200

curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/chat
# Expected: 403
```

Kill the proxy after testing.

- [ ] **Step 3: Commit**

```bash
git add proxy.js
git commit -m "feat: add proxy to restrict public access to share routes only"
```

---

### Task 2: Create /api/share/images/[...path] endpoint

**Files:**
- Create: `src/routes/api/share/images/[...path]/+server.ts`

- [ ] **Step 1: Create the stripped-image API route**

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { resolveImagePath } from "$lib/server/comfyui-browser";
import { existsSync, statSync, createReadStream } from "node:fs";
import sharp from "sharp";

export const GET: RequestHandler = async ({ params }) => {
  const relativePath = decodeURIComponent(params.path);
  const absPath = await resolveImagePath(relativePath);

  if (!absPath || !existsSync(absPath)) {
    return json({ error: "Not found" }, { status: 404 });
  }

  const ext = absPath.split(".").pop()?.toLowerCase() || "png";
  const mimeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  };
  const contentType = mimeMap[ext] || "image/png";

  // Strip all metadata, keep original pixel data and format
  const buffer = await sharp(absPath)
    .withMetadata({})
    .toFormat(ext === "jpg" || ext === "jpeg" ? "jpeg" : ext === "webp" ? "webp" : "png")
    .toBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": buffer.length.toString(),
      "Cache-Control": "public, max-age=604800",
    },
  });
};
```

- [ ] **Step 2: Test the endpoint**

Start the dev server, then:

```bash
# Replace with an actual image path from your DB
curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000/api/share/images/ComfyUI_01258_.png"
# Expected: 200 (or 404 if file doesn't exist at that path)
```

- [ ] **Step 3: Verify metadata stripping**

```bash
# Compare file sizes between raw and stripped
curl -s -o /tmp/stripped.png "http://127.0.0.1:3000/api/share/images/<actual-path>"
ls -la /tmp/stripped.png
# Stripped version should be slightly smaller (no embedded workflow data)
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/api/share/images/
git commit -m "feat: add share image API with metadata stripping"
```

---

### Task 3: Extract ImageInfo component from DetailPanel

**Files:**
- Create: `src/lib/components/gallery/ImageInfo.svelte`
- Modify: `src/lib/components/gallery/DetailPanel.svelte`

The ImageInfo component extracts the read-only file info + metadata display from DetailPanel. DetailPanel then imports and uses ImageInfo for that section, while keeping the interactive editing controls (StarRating, ColorLabel, FlagButtons, TagEditor, delete button, send-to-ComfyUI button).

- [ ] **Step 1: Create ImageInfo.svelte**

```svelte
<script lang="ts">
  import MetadataViewer from "./MetadataViewer.svelte";
  import StarRating from "./StarRating.svelte";

  let {
    filename,
    fileSize,
    width,
    height,
    fileFormat,
    rating,
    extractedModels = [],
    extractedLoras = [],
    extractedSamplers = [],
    extractedSchedulers = [],
    steps,
    cfgScale,
    seed,
    positivePrompt,
    negativePrompt,
  }: {
    filename: string;
    fileSize: number | null;
    width: number | null;
    height: number | null;
    fileFormat: string | null;
    rating: number | null;
    extractedModels?: string[];
    extractedLoras?: string[];
    extractedSamplers?: string[];
    extractedSchedulers?: string[];
    steps?: number | null;
    cfgScale?: number | null;
    seed?: string | null;
    positivePrompt?: string | null;
    negativePrompt?: string | null;
  } = $props();

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  function hasMetadata(): boolean {
    return !!(
      extractedModels.length > 0 ||
      extractedLoras.length > 0 ||
      extractedSamplers.length > 0 ||
      steps ||
      cfgScale ||
      seed ||
      positivePrompt ||
      negativePrompt
    );
  }

  function getMetadata() {
    return {
      models: extractedModels,
      loras: extractedLoras,
      samplers: extractedSamplers.map((name, i) => ({
        id: `sampler-${i}`,
        classType: name,
        seed: seed ? parseInt(seed, 10) : null,
        steps,
        cfg: cfgScale,
        samplerName: name,
        scheduler: extractedSchedulers[i] || null,
        denoise: null,
      })),
      positivePrompts: positivePrompt ? [positivePrompt] : [],
      negativePrompts: negativePrompt ? [negativePrompt] : [],
    };
  }
</script>

<div class="space-y-4">
  <!-- Rating (read-only) -->
  {#if (rating ?? 0) > 0}
    <div>
      <div class="text-xs text-zinc-500 mb-1">评分</div>
      <StarRating value={rating ?? 0} onchange={() => {}} />
    </div>
  {/if}

  <!-- File info -->
  <div class="space-y-1.5">
    <div class="text-xs text-zinc-500 mb-1">文件信息</div>
    <div class="text-xs">
      <span class="text-zinc-500">文件名:</span>
      <span class="text-zinc-300 ml-1">{filename}</span>
    </div>
    <div class="text-xs">
      <span class="text-zinc-500">大小:</span>
      <span class="text-zinc-300 ml-1">{formatFileSize(fileSize)}</span>
    </div>
    <div class="text-xs">
      <span class="text-zinc-500">尺寸:</span>
      <span class="text-zinc-300 ml-1"
        >{width && height ? `${width}×${height}` : "-"}</span
      >
    </div>
    <div class="text-xs">
      <span class="text-zinc-500">格式:</span>
      <span class="text-zinc-300 ml-1">{fileFormat || "-"}</span>
    </div>
  </div>

  <!-- Generation metadata -->
  {#if hasMetadata()}
    <div>
      <div class="text-xs text-zinc-500 mb-2">生成参数</div>
      <MetadataViewer
        metadata={getMetadata()}
        width={width}
        height={height}
      />
    </div>
  {/if}
</div>
```

- [ ] **Step 2: Refactor DetailPanel to use ImageInfo**

In `DetailPanel.svelte`, replace the file info section (lines 219-268) and rating/color/flag sections (lines 190-217) with an import of ImageInfo. Keep the interactive controls (StarRating with onchange, ColorLabel, FlagButtons, TagEditor), the image preview, the "Send to ComfyUI" button, and the delete button.

Key changes to `DetailPanel.svelte`:

1. Add import: `import ImageInfo from "./ImageInfo.svelte";`
2. Replace lines 190-268 (Rating through Metadata) with:

```svelte
    <!-- Rating (editable) -->
    <div class="mb-3">
      <div class="text-xs text-zinc-500 mb-1">评分</div>
      <StarRating value={image.rating ?? 0} {onrate} />
    </div>

    <!-- Color Label -->
    <div class="mb-3">
      <div class="text-xs text-zinc-500 mb-1">颜色标记</div>
      <ColorLabel value={image.colorLabel ?? null} {oncolor} />
    </div>

    <!-- Flag -->
    <div class="mb-3">
      <div class="text-xs text-zinc-500 mb-1">标记</div>
      <FlagButtons flag={image.flag ?? null} {onflag} />
    </div>

    <!-- Tags -->
    <div class="mb-4">
      <div class="text-xs text-zinc-500 mb-1">标签</div>
      <TagEditor tags={image.tags} {allTags} onadd={onaddtag} onremove={onremovetag} />
    </div>

    <!-- File info + metadata (read-only, extracted) -->
    <ImageInfo
      filename={getFilename()}
      fileSize={image.fileSize}
      width={image.width}
      height={image.height}
      fileFormat={image.fileFormat}
      rating={image.rating}
      extractedModels={image.extractedModels}
      extractedLoras={image.extractedLoras}
      extractedSamplers={image.extractedSamplers}
      extractedSchedulers={image.extractedSchedulers}
      steps={image.steps}
      cfgScale={image.cfgScale}
      seed={image.seed}
      positivePrompt={image.positivePrompt}
      negativePrompt={image.negativePrompt}
    />
```

3. Remove the `formatFileSize`, `hasMetadata`, `getMetadata` functions from DetailPanel as they're now in ImageInfo.
4. Remove the unused `MetadataViewer` import (it's now in ImageInfo).
5. Keep `formatDate`, `getFilename`, `getImageUrl`, `sendToComfyUI`, and the `showPrompt` toggle (if still needed for prompt visibility).

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/gallery/ImageInfo.svelte src/lib/components/gallery/DetailPanel.svelte
git commit -m "refactor: extract ImageInfo read-only component from DetailPanel"
```

---

### Task 4: Add feature-flag props to Lightbox

**Files:**
- Modify: `src/lib/components/gallery/Lightbox.svelte`

Add `showZoom`, `showDownload`, `showCopyLink`, `showFilmstrip`, `showInfo`, and `imageUrlBase` props. When `showInfo` is true, render an `<ImageInfo>` sidebar next to the image.

- [ ] **Step 1: Update the script section props and logic**

Replace the existing props block (lines 1-18) and add the `getImageUrl` logic change:

```svelte
<script lang="ts">
  import ImageInfo from "./ImageInfo.svelte";

  let {
    images = [],
    currentIndex = 0,
    contextMenuOpen = false,
    showZoom = true,
    showDownload = true,
    showCopyLink = true,
    showFilmstrip = true,
    showInfo = false,
    imageUrlBase = "/api/comfyui/images",
    onclose,
    onnavigate,
    oncontextmenu,
    ondownload,
  }: {
    images: {
      relativePath: string;
      filename: string;
      modifiedAt?: string;
      width?: number | null;
      height?: number | null;
      fileSize?: number | null;
      fileFormat?: string | null;
      rating?: number | null;
      extractedModels?: string[];
      extractedLoras?: string[];
      extractedSamplers?: string[];
      extractedSchedulers?: string[];
      steps?: number | null;
      cfgScale?: number | null;
      seed?: string | null;
      positivePrompt?: string | null;
      negativePrompt?: string | null;
    }[];
    currentIndex: number;
    contextMenuOpen?: boolean;
    showZoom?: boolean;
    showDownload?: boolean;
    showCopyLink?: boolean;
    showFilmstrip?: boolean;
    showInfo?: boolean;
    imageUrlBase?: string;
    onclose: () => void;
    onnavigate?: (index: number) => void;
    oncontextmenu?: (e: MouseEvent) => void;
    ondownload?: (imageUrl: string, filename: string) => void;
  } = $props();
```

Then update `getImageUrl` (line 54):

```typescript
  function getImageUrl(relativePath: string, modifiedAt?: string): string {
    const base = `/${imageUrlBase.replace(/^\/+/, "")}/${encodeURIComponent(relativePath)}`;
    return modifiedAt ? `${base}?t=${new Date(modifiedAt).getTime()}` : base;
  }
```

- [ ] **Step 2: Wrap toolbar elements in conditionals**

In the toolbar div (starting line 251), wrap the zoom-related elements:

```svelte
      {#if showZoom}
        <span class="text-xs text-zinc-500">{Math.round(scale * 100)}%</span>
        <button
          onclick={resetTransform}
          class="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-zinc-800"
          >适应</button
        >
        <button
          onclick={() => (scale = 1)}
          class="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-zinc-800 hidden md:block"
          >1:1</button
        >
      {/if}
```

Wrap copy link button in `{#if showCopyLink}...{/if}`.

Wrap download button in `{#if showDownload}...{/if}`.

- [ ] **Step 3: Wrap filmstrip in conditional**

Wrap the filmstrip section (lines 416-451) in `{#if showFilmstrip && images.length > 1}...{/if}`.

- [ ] **Step 4: Add ImageInfo sidebar when showInfo is true**

Change the main image area structure. Wrap the existing image area in a flex container that includes the sidebar:

```svelte
  <!-- Image area + optional info panel -->
  <div class="flex-1 flex overflow-hidden">
    <div class="flex-1 flex items-center justify-center overflow-hidden relative">
      <!-- existing image + nav arrows content (lines 352-413), unchanged -->
    </div>

    {#if showInfo && currentImage}
      <div class="w-80 shrink-0 border-l border-zinc-800 bg-zinc-900/80 overflow-y-auto p-4">
        <div class="text-xs text-zinc-500 mb-3">图片信息</div>
        <ImageInfo
          filename={currentImage.filename || ""}
          fileSize={currentImage.fileSize ?? null}
          width={currentImage.width ?? null}
          height={currentImage.height ?? null}
          fileFormat={currentImage.fileFormat ?? null}
          rating={currentImage.rating ?? null}
          extractedModels={currentImage.extractedModels ?? []}
          extractedLoras={currentImage.extractedLoras ?? []}
          extractedSamplers={currentImage.extractedSamplers ?? []}
          extractedSchedulers={currentImage.extractedSchedulers ?? []}
          steps={currentImage.steps ?? null}
          cfgScale={currentImage.cfgScale ?? null}
          seed={currentImage.seed ?? null}
          positivePrompt={currentImage.positivePrompt ?? null}
          negativePrompt={currentImage.negativePrompt ?? null}
        />
      </div>
    {/if}
  </div>
```

- [ ] **Step 5: Update image click behavior when zoom is disabled**

When `showZoom` is false, the image should not toggle zoom on click, and the wheel/mouse-drag/pointer handlers should be inactive. Add guard clauses:

```typescript
  function toggleZoom(e: MouseEvent) {
    if (!showZoom) return;
    // ... existing logic
  }

  function handleWheel(e: WheelEvent) {
    if (!showZoom) return;
    // ... existing logic
  }
```

Similarly for `handleMouseDown`, `handleMouseMove`, `handlePointerDown` etc. — add `if (!showZoom) return;` at the top.

The image CSS classes for cursor should conditionally include zoom cursors only when `showZoom`:

```svelte
        class="max-w-full max-h-full select-none {showZoom && scale <= 1
          ? 'object-contain cursor-zoom-in'
          : showZoom ? 'cursor-zoom-out' : 'object-contain'}"
```

- [ ] **Step 6: Verify build passes**

```bash
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/gallery/Lightbox.svelte
git commit -m "feat: add showZoom/showDownload/showCopyLink/showFilmstrip/showInfo props to Lightbox"
```

---

### Task 5: Add thumbUrl prop to ThumbnailCard

**Files:**
- Modify: `src/lib/components/gallery/ThumbnailCard.svelte`

- [ ] **Step 1: Add thumbUrl prop and use it**

Add the prop (after line 13, inside the props destructuring):

```typescript
  let {
    image,
    selected = false,
    active = false,
    thumbUrl = undefined,
    onselect,
    ondblclick,
    oncontextmenu,
    onlongpress,
    ondownload,
  }: {
    image: ImageResult;
    selected?: boolean;
    active?: boolean;
    thumbUrl?: string | undefined;
    onselect: (path: string, e: MouseEvent) => void;
    ondblclick: () => void;
    oncontextmenu: (path: string, e: MouseEvent) => void;
    onlongpress?: (path: string) => void;
    ondownload?: (path: string) => void;
  } = $props();
```

Update `getImageUrl` to use `thumbUrl` when provided:

```typescript
  function getImageUrl(): string {
    if (thumbUrl) return thumbUrl;
    return `/api/comfyui/images/${encodeURIComponent(image.relativePath)}`;
  }
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/gallery/ThumbnailCard.svelte
git commit -m "feat: add optional thumbUrl prop to ThumbnailCard"
```

---

### Task 6: Update share page server load to return full image data

**Files:**
- Modify: `src/routes/share/+page.server.ts`

- [ ] **Step 1: Add tags and collectionIds to returned images**

The share `+page.server.ts` currently spreads `...img` which includes all DB columns, then deletes `metadataJson`. Add `tags: []` and `collectionIds: []` so the returned shape matches `ImageResult`:

Replace the return block (lines 40-48) with:

```typescript
  return {
    authenticated: true as const,
    images: images.map((img) => ({
      relativePath: img.relativePath,
      rating: img.rating,
      colorLabel: img.colorLabel,
      flag: img.flag,
      notes: img.notes,
      stackId: img.stackId,
      width: img.width,
      height: img.height,
      aspectRatio: img.aspectRatio,
      fileSize: img.fileSize,
      fileFormat: img.fileFormat,
      hasAlpha: img.hasAlpha,
      createdAt: img.createdAt,
      updatedAt: img.updatedAt,
      fileModifiedAt: img.fileModifiedAt,
      isMissing: img.isMissing,
      extractedModels: img.extractedModels ?? [],
      extractedLoras: img.extractedLoras ?? [],
      extractedSamplers: img.extractedSamplers ?? [],
      extractedSchedulers: img.extractedSchedulers ?? [],
      steps: img.steps,
      cfgScale: img.cfgScale,
      seed: img.seed,
      positivePrompt: img.positivePrompt,
      negativePrompt: img.negativePrompt,
      tags: [] as { id: number; name: string; slug: string }[],
      collectionIds: [] as number[],
    })),
    nextCursor,
    hasMore: images.length >= 50,
  };
```

- [ ] **Step 2: Verify type-check and build**

```bash
npx svelte-check --tsconfig ./tsconfig.json
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/share/+page.server.ts
git commit -m "feat: return full image metadata from share server for component reuse"
```

---

### Task 7: Rewrite share page to use main gallery components

**Files:**
- Modify: `src/routes/share/+page.svelte`
- Delete: `src/lib/components/share/ShareLightbox.svelte`
- Delete: `src/lib/components/share/ShareCard.svelte`

- [ ] **Step 1: Rewrite the share page**

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import PasswordGate from "$lib/components/share/PasswordGate.svelte";
  import ThumbnailCard from "$lib/components/gallery/ThumbnailCard.svelte";
  import Lightbox from "$lib/components/gallery/Lightbox.svelte";
  import { downloadImage } from "$lib/utils/download-image";
  import type { ImageResult } from "$lib/stores/gallery-store.svelte";

  let { data } = $props();

  let images = $state<ImageResult[]>(data.images || []);
  let nextCursor = $state<string | null>(data.nextCursor || null);
  let hasMore = $state<boolean>(data.hasMore || false);
  let loading = $state(false);
  let loaded = $state(false);

  let lightboxOpen = $state(false);
  let lightboxIndex = $state(0);

  let sentinelEl = $state<HTMLDivElement>();
  let observer = $state<IntersectionObserver>();

  let totalCount = $derived(images.length);

  function handleCardClick(path: string) {
    const idx = images.findIndex((img) => img.relativePath === path);
    if (idx !== -1) {
      lightboxIndex = idx;
      lightboxOpen = true;
    }
  }

  function closeLightbox() {
    lightboxOpen = false;
  }

  function handleLightboxNavigate(index: number) {
    lightboxIndex = index;
  }

  async function handleDownload(imageUrl: string, filename: string) {
    await downloadImage(imageUrl, filename);
  }

  async function loadMore() {
    if (loading || !hasMore || !nextCursor) return;
    loading = true;

    try {
      const params = new URLSearchParams({ cursor: nextCursor, limit: "50" });
      const res = await fetch(`/api/share/browse?${params}`);
      const result = await res.json();
      images = [...images, ...result.images];
      nextCursor = result.nextCursor;
      hasMore = result.hasMore;
    } finally {
      loading = false;
    }
  }

  function clearAuth() {
    document.cookie =
      "share_auth=; path=/share; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.reload();
  }

  onMount(() => {
    loaded = true;

    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore) {
          loadMore();
        }
      },
      { rootMargin: "200px" },
    );

    return () => observer?.disconnect();
  });

  $effect(() => {
    if (observer && sentinelEl) {
      observer.disconnect();
      observer.observe(sentinelEl);
    }
  });
</script>

{#if !data.authenticated && loaded}
  <PasswordGate />
{:else if data.authenticated}
  <div class="min-h-screen bg-zinc-950">
    <!-- Top bar -->
    <div
      class="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur border-b border-zinc-800"
    >
      <div class="flex items-center justify-between px-4 py-3 max-w-none">
        <div class="flex items-center gap-3">
          <h1 class="text-lg font-semibold text-zinc-100">分享图库</h1>
          <span class="text-sm text-zinc-500">{totalCount} 张图片</span>
        </div>
        <button
          onclick={clearAuth}
          class="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
        >
          退出登录
        </button>
      </div>
    </div>

    <!-- Grid -->
    <div class="px-2 py-2">
      <div
        class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 md:gap-3"
      >
        {#each images as image}
          <ThumbnailCard
            {image}
            thumbUrl={`/api/share/thumbnails/${encodeURIComponent(image.relativePath)}`}
            onselect={(path: string) => handleCardClick(path)}
            ondblclick={() => handleCardClick(image.relativePath)}
            oncontextmenu={() => {}}
            ondownload={(path: string) => {
              const filename = path.split("/").pop() || "image";
              downloadImage(
                `/api/share/images/${encodeURIComponent(path)}`,
                filename,
              );
            }}
          />
        {/each}
      </div>

      <!-- Sentinel for infinite scroll -->
      {#if hasMore}
        <div
          bind:this={sentinelEl}
          class="h-20 flex items-center justify-center"
        >
          {#if loading}
            <div class="text-zinc-500 text-sm">加载中...</div>
          {/if}
        </div>
      {/if}

      {#if !hasMore && images.length > 0}
        <div class="h-20 flex items-center justify-center text-zinc-600 text-sm">
          已加载全部图片
        </div>
      {/if}

      {#if images.length === 0}
        <div class="h-60 flex items-center justify-center text-zinc-500">
          暂无分享内容
        </div>
      {/if}
    </div>
  </div>

  <!-- Lightbox -->
  {#if lightboxOpen}
    <Lightbox
      images={images.map((img) => ({
        relativePath: img.relativePath,
        filename: img.relativePath.split("/").pop() || img.relativePath,
        modifiedAt: img.fileModifiedAt ?? undefined,
        width: img.width,
        height: img.height,
        fileSize: img.fileSize,
        fileFormat: img.fileFormat,
        rating: img.rating,
        extractedModels: img.extractedModels,
        extractedLoras: img.extractedLoras,
        extractedSamplers: img.extractedSamplers,
        extractedSchedulers: img.extractedSchedulers,
        steps: img.steps,
        cfgScale: img.cfgScale,
        seed: img.seed,
        positivePrompt: img.positivePrompt,
        negativePrompt: img.negativePrompt,
      }))}
      currentIndex={lightboxIndex}
      showZoom={false}
      showCopyLink={false}
      showFilmstrip={false}
      showInfo={true}
      imageUrlBase="/api/share/images"
      onclose={closeLightbox}
      onnavigate={handleLightboxNavigate}
      ondownload={handleDownload}
    />
  {/if}
{/if}
```

- [ ] **Step 2: Delete ShareLightbox.svelte and ShareCard.svelte**

```bash
rm src/lib/components/share/ShareLightbox.svelte
rm src/lib/components/share/ShareCard.svelte
```

- [ ] **Step 3: Verify type-check and build**

```bash
npx svelte-check --tsconfig ./tsconfig.json && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/share/+page.svelte src/lib/components/share/ShareLightbox.svelte src/lib/components/share/ShareCard.svelte
git commit -m "feat: reuse main Lightbox and ThumbnailCard in share page, add download and image info"
```

---

### Task 8: Update package.json scripts for parallel proxy

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update dev and add start script**

Change:

```json
    "dev": "vite dev",
```

To:

```json
    "dev": "node proxy.js & vite dev",
```

And add under the `preview` script:

```json
    "start": "node proxy.js & node build",
```

- [ ] **Step 2: Verify startup**

```bash
npm run dev
# Check both processes start (vite on :3000, proxy on :3001)
```

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat: run proxy alongside dev server for share route isolation"
```

---

### Task 9: Update existing share design spec with changes

**Files:**
- Modify: `docs/superpowers/specs/2026-06-18-share-gallery-design.md`

- [ ] **Step 1: Add note at top of existing spec**

Prepend to the old spec file:

```markdown
> **Note:** This spec has been superseded by `2026-06-19-share-page-enhancements-design.md`.
> The architecture, components, and APIs described below have been significantly revised.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-06-18-share-gallery-design.md
git commit -m "docs: mark original share spec as superseded"
```

---

## Verification Checklist

After all tasks complete:

1. `npm run build` passes
2. `node proxy.js` starts and filters correctly (test with curl)
3. Visit `/share` → password form shown
4. Enter password → gallery loads, top bar shows "N 张图片"
5. ThumbnailCards display with rating stars and filename (reused from main gallery)
6. Click card → Lightbox opens, image loaded from `/api/share/images/...`
7. Lightbox shows ImageInfo sidebar with filename, size, dimensions, format, rating, generation params
8. Download button in Lightbox works, downloaded file has no ComfyUI metadata
9. Zoom/copy-link/filmstrip are hidden in share lightbox
10. Proxy blocks non-share routes (test `curl localhost:3001/generations` → 403)
11. Main gallery still works correctly — DetailPanel shows full editing controls, Lightbox has all features
12. Delete/trash still works in main gallery (DetailPanel delete button preserved)
