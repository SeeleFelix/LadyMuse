# Mobile Image Detail Unification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a unified `MobileImageSheet` component that replaces the draggable bottom sheet in Lightbox and the single-image action content in MobileActionSheet, used by both gallery and share pages.

**Architecture:** New `MobileImageSheet.svelte` component with a collapsed info bar (always visible) that taps open to a fixed overlay showing `ImageInfo` + optional action buttons. Lightbox imports this component instead of its inline sheet implementation. Gallery page passes action callbacks via Lightbox; share page uses default read-only mode.

**Tech Stack:** Svelte 5 (runes mode — `$state`, `$props`, `$derived`), Tailwind CSS

---

### Task 1: Create `MobileImageSheet.svelte`

**Files:**
- Create: `src/lib/components/gallery/MobileImageSheet.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script lang="ts">
  import ImageInfo from "./ImageInfo.svelte";

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
    showActions = false,
    onrate,
    oncolor,
    onflag,
    ondownload,
    ondelete,
    oncopylink,
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
    showActions?: boolean;
    onrate?: (rating: number) => void;
    oncolor?: (color: string | null) => void;
    onflag?: (flag: string | null) => void;
    ondownload?: () => void;
    ondelete?: () => void;
    oncopylink?: () => void;
  } = $props();

  let expanded = $state(false);

  function toggleExpanded() {
    expanded = !expanded;
  }
</script>

<!-- Collapsed bar (mobile only) -->
<button
  class="md:hidden flex items-center justify-between w-full px-4 py-2.5 bg-zinc-900/90 backdrop-blur border-t border-zinc-700/50"
  onclick={toggleExpanded}
>
  <div class="flex items-center gap-2.5 min-w-0">
    <span class="text-xs text-zinc-300 truncate max-w-[140px]">{filename}</span>
    {#if width && height}
      <span class="text-xs text-zinc-500 shrink-0">{width}x{height}</span>
    {/if}
    {#if (rating ?? 0) > 0}
      <span class="text-amber-400 text-xs shrink-0">{"★".repeat(rating ?? 0)}</span>
    {/if}
  </div>
  <svg
    class="w-4 h-4 text-zinc-500 shrink-0 transition-transform {expanded ? 'rotate-180' : ''}"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
  </svg>
</button>

<!-- Expanded overlay (mobile only) -->
{#if expanded}
  <button
    class="md:hidden fixed inset-0 z-[65] bg-black/60"
    onclick={toggleExpanded}
    aria-label="关闭详情"
  ></button>

  <div
    class="md:hidden fixed inset-x-0 bottom-0 z-[70] bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-700/50 rounded-t-2xl shadow-2xl max-h-[60vh] flex flex-col"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 shrink-0">
      <span class="text-sm font-medium text-zinc-300">{filename}</span>
      <button onclick={toggleExpanded} class="text-zinc-500 hover:text-zinc-300 p-1">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Scrollable content -->
    <div class="overflow-y-auto px-4 py-3 flex-1">
      <ImageInfo
        {filename}
        {fileSize}
        {width}
        {height}
        {fileFormat}
        {rating}
        {extractedModels}
        {extractedLoras}
        {extractedSamplers}
        {extractedSchedulers}
        {steps}
        {cfgScale}
        {seed}
        {positivePrompt}
        {negativePrompt}
      />

      <!-- Action buttons -->
      {#if showActions}
        <div class="mt-4 pt-4 border-t border-zinc-800 space-y-1">
          <!-- Rating -->
          <div class="flex items-center gap-3 px-1 py-2">
            <span class="text-zinc-500 text-xs w-8 shrink-0">评分</span>
            <div class="flex gap-0.5">
              {#each [1, 2, 3, 4, 5] as r}
                <button
                  onclick={() => onrate?.(r)}
                  class="text-lg px-0.5 {r <= (rating ?? 0) ? 'text-amber-400' : 'text-zinc-600'}"
                >★</button>
              {/each}
            </div>
          </div>

          <!-- Color -->
          <div class="flex items-center gap-3 px-1 py-2">
            <span class="text-zinc-500 text-xs w-8 shrink-0">颜色</span>
            <div class="flex gap-2">
              {#each [["red", "bg-red-500"], ["yellow", "bg-yellow-500"], ["green", "bg-green-500"], ["blue", "bg-blue-500"], ["purple", "bg-purple-500"]] as [key, cls]}
                <button
                  onclick={() => oncolor?.(key)}
                  class="w-6 h-6 rounded-full {cls}"
                ></button>
              {/each}
            </div>
          </div>

          <!-- Flag -->
          <div class="flex items-center gap-3 px-1 py-2">
            <span class="text-zinc-500 text-xs w-8 shrink-0">标记</span>
            <div class="flex gap-2">
              <button
                onclick={() => onflag?.("pick")}
                class="px-3 py-1 rounded text-xs border border-zinc-700 text-zinc-400 hover:bg-green-500/20 hover:text-green-400 hover:border-green-500/30 transition-colors"
              >Pick</button>
              <button
                onclick={() => onflag?.("reject")}
                class="px-3 py-1 rounded text-xs border border-zinc-700 text-zinc-400 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-colors"
              >Reject</button>
            </div>
          </div>

          <!-- Utility actions -->
          <div class="flex items-center gap-3 px-1 py-2">
            <span class="text-zinc-500 text-xs w-8 shrink-0">操作</span>
            <div class="flex gap-2">
              {#if oncopylink}
                <button
                  onclick={() => oncopylink()}
                  class="px-3 py-1 rounded text-xs border border-zinc-700 text-zinc-400 hover:bg-zinc-700/50 transition-colors"
                >复制链接</button>
              {/if}
              {#if ondownload}
                <button
                  onclick={() => ondownload()}
                  class="px-3 py-1 rounded text-xs border border-zinc-700 text-zinc-400 hover:bg-zinc-700/50 transition-colors"
                >下载</button>
              {/if}
              {#if ondelete}
                <button
                  onclick={() => ondelete()}
                  class="px-3 py-1 rounded text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                >删除</button>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/MobileImageSheet.svelte
git commit -m "feat: add MobileImageSheet component for unified mobile image detail"
```

---

### Task 2: Integrate `MobileImageSheet` into `Lightbox.svelte`

**Files:**
- Modify: `src/lib/components/gallery/Lightbox.svelte`

- [ ] **Step 1: Import MobileImageSheet and add new props**

```svelte
<script lang="ts">
  import ImageInfo from "./ImageInfo.svelte";
  import MobileImageSheet from "./MobileImageSheet.svelte";
```

Add new props to the destructured `$props()` call — insert after `oncontextmenu` and before `ondownload`:

```svelte
    showInfo = false,
    showActions = false,
    imageUrlBase = "/api/comfyui/images",
    onclose,
    onnavigate,
    oncontextmenu,
    onrate,
    oncolor,
    onflag,
    ondelete,
    ondownload,
  }: {
    // ... existing fields ...
    showInfo?: boolean;
    showActions?: boolean;
    // ... existing callback types ...
    onrate?: (rating: number) => void;
    oncolor?: (color: string | null) => void;
    onflag?: (flag: string | null) => void;
    ondelete?: () => void;
```

- [ ] **Step 2: Add copy link handler for mobile sheet**

After the existing `handleDownload` function, add a function that triggers copy and can be passed to MobileImageSheet:

```ts
  function handleMobileCopyLink() {
    handleCopyLink();
  }
```

- [ ] **Step 3: Replace the draggable bottom sheet with MobileImageSheet**

Remove everything from `<!-- Mobile: draggable bottom sheet for image info -->` (line 608) through `{/if}` (line 674). Replace with:

```svelte
  <!-- Mobile: unified image info sheet -->
  {#if showInfo && currentImage}
    <div class="md:hidden">
      <MobileImageSheet
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
        showActions={showActions}
        onrate={onrate}
        oncolor={oncolor}
        onflag={onflag}
        ondownload={ondownload ? () => handleDownload() : undefined}
        ondelete={ondelete}
        oncopylink={showCopyLink ? () => handleCopyLink() : undefined}
      />
    </div>
  {/if}
```

- [ ] **Step 4: Remove now-unused sheet state and functions**

Delete these lines from the `<script>` block (currently lines 77-122):

The sheet state block:
```ts
  // Mobile info sheet — single pixel-offset system
  let sheetOpen = $state(false);
  let sheetDragPx = $state(0);
  let sheetDragging = $state(false);
  let sheetStartY = $state(0);
  let sheetStartPx = $state(0);
```

The SHEET_HANDLE_H constant and sheet functions:
```ts
  const SHEET_HANDLE_H = 48;

  function sheetPanelH() { ... }
  function sheetClosedOffset() { ... }
  function sheetYpx(): number { ... }
  function toggleSheet() { ... }
  function handleSheetPointerDown(e: PointerEvent) { ... }
  function handleSheetPointerMove(e: PointerEvent) { ... }
  function handleSheetPointerUp(_e: PointerEvent) { ... }
```

Delete lines 77-122 (from `// Mobile info sheet` comment through the closing `}` of `handleSheetPointerUp`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/gallery/Lightbox.svelte
git commit -m "refactor: replace Lightbox draggable sheet with MobileImageSheet component"
```

---

### Task 3: Update `generations/+page.svelte` to pass action props and metadata to Lightbox

**Files:**
- Modify: `src/routes/generations/+page.svelte`

- [ ] **Step 1: Expand `lightboxImages` to include full metadata**

Replace the current `lightboxImages` derived (line 149-155):

```ts
  let lightboxImages = $derived(
    store.images.map((img) => ({
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
    })),
  );
```

- [ ] **Step 2: Add action callbacks for Lightbox**

Add these functions after the existing `handleLightboxDownload` function:

```ts
  function handleLightboxRate(rating: number) {
    const img = store.images[lightboxIndex];
    if (img) store.updateAttributes(img.relativePath, { rating });
  }

  function handleLightboxColor(color: string | null) {
    const img = store.images[lightboxIndex];
    if (img) store.updateAttributes(img.relativePath, { colorLabel: color });
  }

  function handleLightboxFlag(flag: string | null) {
    const img = store.images[lightboxIndex];
    if (img) store.updateAttributes(img.relativePath, { flag });
  }

  function handleLightboxDelete() {
    const img = store.images[lightboxIndex];
    if (img) {
      deleteConfirm = {
        paths: [img.relativePath],
        message: `确定要删除 "${img.relativePath.split("/").pop()}" 吗？`,
      };
    }
  }
```

- [ ] **Step 3: Pass new props to Lightbox component**

Update the Lightbox usage (line 605-615) to add the new props:

```svelte
  <Lightbox
    images={lightboxImages}
    currentIndex={lightboxIndex}
    contextMenuOpen={contextMenuVisible}
    showInfo={true}
    showActions={true}
    onclose={() => (lightboxOpen = false)}
    onnavigate={handleLightboxNavigate}
    oncontextmenu={handleLightboxContextmenu}
    ondownload={handleLightboxDownload}
    onrate={handleLightboxRate}
    oncolor={handleLightboxColor}
    onflag={handleLightboxFlag}
    ondelete={handleLightboxDelete}
  />
```

- [ ] **Step 4: Update `handleLongPress` to open Lightbox for single image**

Since single-image actions now live in Lightbox's MobileImageSheet, long-press on a single image should open the Lightbox directly. Multi-select batch actions still use MobileActionSheet.

Replace the existing `handleLongPress` function:

```ts
  function handleLongPress(path: string) {
    const image = store.images.find((img) => img.relativePath === path);
    if (!image) return;
    if (store.selectedPaths.size > 1 && store.selectedPaths.has(path)) {
      // Multi-select: show batch action sheet
      mobileSheetImage = null;
      mobileSheetVisible = true;
    } else {
      // Single image: open Lightbox directly
      mobileSheetImage = null;
      openLightboxForImage(image);
    }
  }
```

- [ ] **Step 5: Remove single-image actions from MobileActionSheet**

In the MobileActionSheet usage (lines 639-870), remove the `{#if mobileSheetImage}` block (lines 644-817) — the single-image actions. Keep only the `{:else}` multi-select block (lines 818-869) since batch operations still use MobileActionSheet.

The remaining MobileActionSheet block should be:

```svelte
<MobileActionSheet
  visible={mobileSheetVisible}
  onclose={() => (mobileSheetVisible = false)}
>
  {#if !mobileSheetImage}
    <!-- Multi-select actions -->
    <div class="px-1 py-3 text-sm text-zinc-500 border-b border-zinc-700/50">
      {store.selectedPaths.size} 张已选
    </div>

    <!-- Rate batch -->
    <div
      class="flex items-center gap-3 w-full px-1 py-3 text-sm text-zinc-200 border-b border-zinc-700/50"
    >
      <span class="text-zinc-500 text-xs w-5 text-center">★</span>
      <div class="flex gap-1">
        {#each [1, 2, 3, 4, 5] as r}
          <button
            onclick={() => {
              for (const path of store.selectedPaths)
                store.updateAttributes(path, { rating: r });
              mobileSheetVisible = false;
            }}
            class="text-lg text-amber-400">★</button
          >
        {/each}
      </div>
    </div>

    <!-- Batch delete -->
    <button
      onclick={() => {
        mobileSheetVisible = false;
        deleteConfirm = {
          paths: [...store.selectedPaths],
          message: `确定要删除 ${store.selectedPaths.size} 张图片？`,
        };
      }}
      class="flex items-center gap-3 w-full px-1 py-3 text-sm text-red-400"
    >
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
      </svg>
      删除 ({store.selectedPaths.size})
    </button>
  {/if}
</MobileActionSheet>
```

- [ ] **Step 6: Commit**

```bash
git add src/routes/generations/+page.svelte
git commit -m "feat: integrate MobileImageSheet into gallery Lightbox with action props"
```

---

### Task 4: Update `share/+page.svelte` for explicit read-only mode

**Files:**
- Modify: `src/routes/share/+page.svelte`

- [ ] **Step 1: Set `showInfo=true` on Lightbox and ensure `showActions` defaults to false**

Update the Lightbox usage (lines 165-195). The current code already has `showInfo={true}` — good. `showActions` defaults to `false` so no change is needed, but add it explicitly for clarity:

```svelte
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
      showZoom={true}
      showCopyLink={false}
      showFilmstrip={false}
      showInfo={true}
      showActions={false}
      imageUrlBase="/api/share/images"
      onclose={closeLightbox}
      onnavigate={handleLightboxNavigate}
      ondownload={handleDownload}
    />
  {/if}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/share/+page.svelte
git commit -m "feat: set explicit showActions=false on share page Lightbox"
```

---

### Task 5: Verification

- [ ] **Step 1: Build check**

```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | head -40
```

Expected: no new TypeScript errors.

- [ ] **Step 2: Verify no leftover dead code**

```bash
grep -n "sheetOpen\|sheetDragPx\|sheetDragging\|sheetStartY\|sheetStartPx\|SHEET_HANDLE_H\|toggleSheet\|handleSheetPointer" src/lib/components/gallery/Lightbox.svelte
```

Expected: no matches (all old sheet code removed).

- [ ] **Step 3: Verify MobileActionSheet single-image content removed and handleLongPress updated**

```bash
grep -n "mobileSheetImage" src/routes/generations/+page.svelte
```

Expected: `mobileSheetImage` only appears in `handleLongPress` (setting to null) and in the `{#if !mobileSheetImage}` guard. No single-image action blocks remain.

- [ ] **Step 4: Commit any cleanup**

```bash
git add -A
git diff --cached --stat
# Only commit if there are changes from verification fixes
```
