# ImageDetail Component — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a single `ImageDetail.svelte` component that handles all image detail display (desktop sidebar + mobile bottom sheet), replacing DetailPanel, MobileImageSheet, and ImageInfo.

**Architecture:** One component with responsive layout: desktop renders as sidebar panel, mobile renders as collapsed bar + expandable overlay. Content sections (rating, color, flag, tags, file info, params, actions) are controlled by props.

**Tech Stack:** Svelte 5 (runes), Tailwind CSS

---

### Task 1: Create ImageDetail.svelte

**Files:** Create `src/lib/components/gallery/ImageDetail.svelte`

This component absorbs the content of ImageInfo (file info + generation params), MobileImageSheet (mobile shell), and DetailPanel (editable controls). Content sections are rendered unconditionally — callbacks are optional, read/write is controlled by `readonly`.

- [ ] **Step 1: Write the component**

```svelte
<script lang="ts">
  import StarRating from "./StarRating.svelte";
  import ColorLabel from "./ColorLabel.svelte";
  import FlagButtons from "./FlagButtons.svelte";
  import TagEditor from "./TagEditor.svelte";
  import MetadataViewer from "./MetadataViewer.svelte";

  let {
    filename,
    fileSize,
    width,
    height,
    fileFormat,
    rating,
    colorLabel = null,
    flag = null,
    tags = [],
    allTags = [],
    extractedModels = [],
    extractedLoras = [],
    extractedSamplers = [],
    extractedSchedulers = [],
    steps,
    cfgScale,
    seed,
    positivePrompt,
    negativePrompt,
    readonly = false,
    showThumbnail = false,
    showDelete = false,
    closeable = false,
    thumbnailUrl = "",
    isMissing = false,
    onclose,
    onrate,
    oncolor,
    onflag,
    onaddtag,
    onremovetag,
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
    colorLabel?: string | null;
    flag?: string | null;
    tags?: { id: number; name: string; slug: string }[];
    allTags?: { id: number; name: string; slug: string }[];
    extractedModels?: string[];
    extractedLoras?: string[];
    extractedSamplers?: string[];
    extractedSchedulers?: string[];
    steps?: number | null;
    cfgScale?: number | null;
    seed?: string | null;
    positivePrompt?: string | null;
    negativePrompt?: string | null;
    readonly?: boolean;
    showThumbnail?: boolean;
    showDelete?: boolean;
    closeable?: boolean;
    thumbnailUrl?: string;
    isMissing?: boolean;
    onclose?: () => void;
    onrate?: (rating: number) => void;
    oncolor?: (color: string | null) => void;
    onflag?: (flag: string | null) => void;
    onaddtag?: (tagName: string) => void;
    onremovetag?: (tagId: number) => void;
    ondownload?: () => void;
    ondelete?: () => void;
    oncopylink?: () => void;
  } = $props();

  let expanded = $state(false);

  function toggleExpanded() {
    expanded = !expanded;
  }

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
</script>

<!-- ===== DESKTOP: sidebar panel ===== -->
<div class="hidden md:block w-80 shrink-0 border-l border-zinc-800 bg-zinc-900/80 overflow-y-auto p-4">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-sm font-medium text-zinc-300">图片详情</h3>
    {#if closeable}
      <button onclick={onclose} class="text-zinc-500 hover:text-zinc-300">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    {/if}
  </div>

  {#if showThumbnail && thumbnailUrl}
    <div class="rounded-lg overflow-hidden bg-zinc-800 mb-4">
      {#if isMissing}
        <div class="aspect-square flex items-center justify-center text-zinc-600 text-xs">文件已丢失</div>
      {:else}
        <img src={thumbnailUrl} alt="" class="w-full" style="aspect-ratio: 1; object-fit: contain;" />
      {/if}
    </div>
  {/if}

  <!-- Rating -->
  <div class="mb-3">
    <div class="text-xs text-zinc-500 mb-1">评分</div>
    <StarRating value={rating ?? 0} onchange={readonly ? () => {} : (r) => onrate?.(r)} />
  </div>

  <!-- Color Label -->
  <div class="mb-3">
    <div class="text-xs text-zinc-500 mb-1">颜色标记</div>
    <ColorLabel value={colorLabel} onchange={readonly ? () => {} : (c) => oncolor?.(c)} />
  </div>

  <!-- Flag -->
  <div class="mb-3">
    <div class="text-xs text-zinc-500 mb-1">标记</div>
    <FlagButtons {flag} onchange={readonly ? () => {} : (f) => onflag?.(f)} />
  </div>

  <!-- Tags -->
  <div class="mb-4">
    <div class="text-xs text-zinc-500 mb-1">标签</div>
    <TagEditor {tags} {allTags} onadd={readonly ? () => {} : (t) => onaddtag?.(t)} onremove={readonly ? () => {} : (id) => onremovetag?.(id)} />
  </div>

  <!-- File info -->
  <div class="space-y-1.5 mb-4">
    <div class="text-xs text-zinc-500 mb-1">文件信息</div>
    <div class="text-xs"><span class="text-zinc-500">文件名:</span><span class="text-zinc-300 ml-1">{filename}</span></div>
    <div class="text-xs"><span class="text-zinc-500">大小:</span><span class="text-zinc-300 ml-1">{formatFileSize(fileSize)}</span></div>
    <div class="text-xs"><span class="text-zinc-500">尺寸:</span><span class="text-zinc-300 ml-1">{width && height ? `${width}×${height}` : "-"}</span></div>
    <div class="text-xs"><span class="text-zinc-500">格式:</span><span class="text-zinc-300 ml-1">{fileFormat || "-"}</span></div>
  </div>

  <!-- Generation metadata -->
  {#if hasMetadata()}
    <div class="mb-4">
      <div class="text-xs text-zinc-500 mb-2">生成参数</div>
      <MetadataViewer
        metadata={{
          models: extractedModels,
          loras: extractedLoras,
          samplers: extractedSamplers.map((name, i) => ({
            id: `sampler-${i}`,
            classType: name,
            seed: seed ? parseInt(seed, 10) : null,
            steps: steps ?? null,
            cfg: cfgScale ?? null,
            samplerName: name,
            scheduler: extractedSchedulers[i] || null,
            denoise: null,
          })),
          positivePrompts: positivePrompt ? [positivePrompt] : [],
          negativePrompts: negativePrompt ? [negativePrompt] : [],
        }}
        {width}
        {height}
      />
    </div>
  {/if}

  <!-- Actions -->
  {#if ondownload || oncopylink}
    <div class="flex gap-2 mb-4">
      {#if oncopylink}
        <button onclick={oncopylink} class="px-3 py-1 rounded text-xs border border-zinc-700 text-zinc-400 hover:bg-zinc-700/50">复制链接</button>
      {/if}
      {#if ondownload}
        <button onclick={ondownload} class="px-3 py-1 rounded text-xs border border-zinc-700 text-zinc-400 hover:bg-zinc-700/50">下载</button>
      {/if}
    </div>
  {/if}

  <!-- Delete -->
  {#if showDelete && ondelete}
    <button onclick={ondelete} class="w-full rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10">删除图片</button>
  {/if}
</div>

<!-- ===== MOBILE: collapsed bar ===== -->
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
  <svg class="w-4 h-4 text-zinc-500 shrink-0 transition-transform {expanded ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
  </svg>
</button>

<!-- ===== MOBILE: expanded overlay ===== -->
{#if expanded}
  <button class="md:hidden fixed inset-0 z-[65] bg-black/60" onclick={toggleExpanded} aria-label="关闭详情"></button>

  <div class="md:hidden fixed inset-x-0 bottom-0 z-[70] bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-700/50 rounded-t-2xl shadow-2xl max-h-[60vh] flex flex-col">
    <div class="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 shrink-0">
      <span class="text-sm font-medium text-zinc-300">{filename}</span>
      <button onclick={toggleExpanded} class="text-zinc-500 hover:text-zinc-300 p-1">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <div class="overflow-y-auto px-4 py-3 flex-1">
      {#if showThumbnail && thumbnailUrl}
        <div class="rounded-lg overflow-hidden bg-zinc-800 mb-4">
          {#if isMissing}
            <div class="aspect-square flex items-center justify-center text-zinc-600 text-xs">文件已丢失</div>
          {:else}
            <img src={thumbnailUrl} alt="" class="w-full" style="aspect-ratio: 1; object-fit: contain;" />
          {/if}
        </div>
      {/if}

      <!-- Rating -->
      <div class="flex items-center gap-3 px-1 py-2">
        <span class="text-zinc-500 text-xs w-8 shrink-0">评分</span>
        <div class="flex gap-0.5">
          {#each [1, 2, 3, 4, 5] as r}
            <button
              onclick={() => !readonly && onrate?.(r)}
              class="text-lg px-0.5 {readonly ? '' : 'cursor-pointer'} {r <= (rating ?? 0) ? 'text-amber-400' : 'text-zinc-600'}"
              disabled={readonly}
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
              onclick={() => !readonly && oncolor?.(key)}
              class="w-6 h-6 rounded-full {cls}"
              disabled={readonly}
            ></button>
          {/each}
        </div>
      </div>

      <!-- Flag -->
      <div class="flex items-center gap-3 px-1 py-2">
        <span class="text-zinc-500 text-xs w-8 shrink-0">标记</span>
        <div class="flex gap-2">
          <button
            onclick={() => !readonly && onflag?.("pick")}
            class="px-3 py-1 rounded text-xs {readonly ? '' : 'border border-zinc-700 hover:bg-green-500/20 hover:text-green-400'} transition-colors {flag === 'pick' && !readonly ? 'bg-green-500/20 text-green-400' : 'text-zinc-400'}"
            disabled={readonly}
          >Pick</button>
          <button
            onclick={() => !readonly && onflag?.("reject")}
            class="px-3 py-1 rounded text-xs {readonly ? '' : 'border border-zinc-700 hover:bg-red-500/20 hover:text-red-400'} transition-colors {flag === 'reject' && !readonly ? 'bg-red-500/20 text-red-400' : 'text-zinc-400'}"
            disabled={readonly}
          >Reject</button>
        </div>
      </div>

      <!-- File info -->
      <div class="space-y-1.5 mt-3">
        <div class="text-xs text-zinc-500 mb-1">文件信息</div>
        <div class="text-xs"><span class="text-zinc-500">文件名:</span><span class="text-zinc-300 ml-1">{filename}</span></div>
        <div class="text-xs"><span class="text-zinc-500">大小:</span><span class="text-zinc-300 ml-1">{formatFileSize(fileSize)}</span></div>
        <div class="text-xs"><span class="text-zinc-500">尺寸:</span><span class="text-zinc-300 ml-1">{width && height ? `${width}×${height}` : "-"}</span></div>
        <div class="text-xs"><span class="text-zinc-500">格式:</span><span class="text-zinc-300 ml-1">{fileFormat || "-"}</span></div>
      </div>

      <!-- Generation metadata -->
      {#if hasMetadata()}
        <div class="mt-4">
          <div class="text-xs text-zinc-500 mb-2">生成参数</div>
          <MetadataViewer
            metadata={{
              models: extractedModels,
              loras: extractedLoras,
              samplers: extractedSamplers.map((name, i) => ({
                id: `sampler-${i}`,
                classType: name,
                seed: seed ? parseInt(seed, 10) : null,
                steps: steps ?? null,
                cfg: cfgScale ?? null,
                samplerName: name,
                scheduler: extractedSchedulers[i] || null,
                denoise: null,
              })),
              positivePrompts: positivePrompt ? [positivePrompt] : [],
              negativePrompts: negativePrompt ? [negativePrompt] : [],
            }}
            {width}
            {height}
          />
        </div>
      {/if}

      <!-- Actions -->
      {#if ondownload || oncopylink || ondelete}
        <div class="mt-4 pt-4 border-t border-zinc-800 flex gap-2">
          {#if oncopylink}
            <button onclick={oncopylink} class="px-3 py-1 rounded text-xs border border-zinc-700 text-zinc-400 hover:bg-zinc-700/50">复制链接</button>
          {/if}
          {#if ondownload}
            <button onclick={ondownload} class="px-3 py-1 rounded text-xs border border-zinc-700 text-zinc-400 hover:bg-zinc-700/50">下载</button>
          {/if}
          {#if showDelete && ondelete}
            <button onclick={ondelete} class="px-3 py-1 rounded text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10">删除</button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/ImageDetail.svelte
git commit -m "feat: add ImageDetail unified component"
```

---

### Task 2: Replace DetailPanel internals with ImageDetail

**Files:** Modify `src/lib/components/gallery/DetailPanel.svelte`

DetailPanel currently imports ImageInfo, StarRating, ColorLabel, FlagButtons, TagEditor. Replace all of that with a single ImageDetail import, forwarding props.

- [ ] **Step 1: Rewrite DetailPanel to use ImageDetail**

```svelte
<script lang="ts">
  import ImageDetail from "./ImageDetail.svelte";
  import type { ImageResult } from "$lib/stores/gallery-store.svelte";

  interface Tag {
    id: number;
    name: string;
    slug: string;
  }

  let {
    image,
    allTags = [],
    onrate,
    oncolor,
    onflag,
    onaddtag,
    onremovetag,
    onclose,
    ondelete,
  }: {
    image: ImageResult | null;
    allTags?: Tag[];
    onrate: (rating: number) => void;
    oncolor: (color: string | null) => void;
    onflag: (flag: string | null) => void;
    onaddtag: (tagName: string) => void;
    onremovetag: (tagId: number) => void;
    onclose: () => void;
    ondelete: () => void;
  } = $props();

  function getImageUrl(relativePath: string): string {
    return `/api/comfyui/images/${encodeURIComponent(relativePath)}`;
  }
</script>

<div class="w-96 shrink-0 border-l border-zinc-800 bg-zinc-900/50 overflow-y-auto p-4">
  {#if !image}
    <div class="flex flex-col items-center justify-center h-64 text-center">
      <svg class="w-10 h-10 text-zinc-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
      <p class="text-sm text-zinc-600">点击或选择图片</p>
      <p class="text-xs text-zinc-700 mt-1">查看详情和元数据</p>
    </div>
  {:else}
    <ImageDetail
      filename={image.relativePath.split("/").pop() || image.relativePath}
      fileSize={image.fileSize}
      width={image.width}
      height={image.height}
      fileFormat={image.fileFormat}
      rating={image.rating}
      colorLabel={image.colorLabel}
      flag={image.flag}
      tags={image.tags}
      {allTags}
      extractedModels={image.extractedModels}
      extractedLoras={image.extractedLoras}
      extractedSamplers={image.extractedSamplers}
      extractedSchedulers={image.extractedSchedulers}
      steps={image.steps}
      cfgScale={image.cfgScale}
      seed={image.seed}
      positivePrompt={image.positivePrompt}
      negativePrompt={image.negativePrompt}
      readonly={false}
      showThumbnail={true}
      showDelete={true}
      closeable={true}
      thumbnailUrl={image.isMissing ? "" : getImageUrl(image.relativePath)}
      isMissing={image.isMissing ?? false}
      {onclose}
      {onrate}
      {oncolor}
      {onflag}
      {onaddtag}
      {onremovetag}
      {ondelete}
    />
  {/if}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/DetailPanel.svelte
git commit -m "refactor: replace DetailPanel internals with ImageDetail"
```

---

### Task 3: Replace Lightbox desktop sidebar and MobileImageSheet with ImageDetail

**Files:** Modify `src/lib/components/gallery/Lightbox.svelte`

Remove imports of ImageInfo and MobileImageSheet. Replace desktop sidebar and mobile section with ImageDetail.

- [ ] **Step 1: Update imports and replace both sections**

Remove:
```ts
import ImageInfo from "./ImageInfo.svelte";
import MobileImageSheet from "./MobileImageSheet.svelte";
```

Add:
```ts
import ImageDetail from "./ImageDetail.svelte";
```

Replace the desktop sidebar `ImageInfo` usage (currently inside `{#if showInfo && currentImage}` div) with an `ImageDetail` component.

Replace the mobile section `MobileImageSheet` usage with `ImageDetail`.

Use the existing `showInfo`, `showActions`, `onrate`, `oncolor`, `onflag`, `ondelete`, `ondownload`, `showCopyLink` props from Lightbox to drive ImageDetail's `readonly` and callbacks.

For the desktop sidebar:
```svelte
{#if showInfo && currentImage}
  <div class="hidden md:block w-80 shrink-0 border-l border-zinc-800 bg-zinc-900/80 overflow-y-auto p-4">
    <ImageDetail
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
      readonly={true}
      showDelete={false}
    />
  </div>
{/if}
```

For mobile, replace the `{#if showInfo && currentImage}` block containing `MobileImageSheet` with just the inner content wrapped in a `md:hidden` div, using `ImageDetail`:
```svelte
{#if showInfo && currentImage}
  <div class="md:hidden">
    <ImageDetail
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
      readonly={!showActions}
      showDelete={!!ondelete}
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

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/Lightbox.svelte
git commit -m "refactor: replace Lightbox sidebar and MobileImageSheet with ImageDetail"
```

---

### Task 4: Delete unused components

**Files:** Delete `src/lib/components/gallery/MobileImageSheet.svelte`, `src/lib/components/gallery/ImageInfo.svelte`, `src/lib/components/gallery/GalleryDetail.svelte`

- [ ] **Step 1: Delete files and verify no imports remain**

```bash
git rm src/lib/components/gallery/MobileImageSheet.svelte \
       src/lib/components/gallery/ImageInfo.svelte \
       src/lib/components/gallery/GalleryDetail.svelte

grep -rn "MobileImageSheet\|ImageInfo\|GalleryDetail" src/ --include="*.svelte" --include="*.ts" | grep -v node_modules
# Expected: no matches
```

- [ ] **Step 2: Commit**

```bash
git commit -m "refactor: remove MobileImageSheet, ImageInfo, GalleryDetail — replaced by ImageDetail"
```

---

### Task 5: Verify

- [ ] **Step 1: Build check**

```bash
rm -rf .svelte-kit build && npm run build 2>&1 | tail -5
```

Expected: build succeeds.

- [ ] **Step 2: Type check**

```bash
npm run check 2>&1 | grep "ERROR" | grep -v "chat/\|knowledge/\|share/images/\|FilterPanel\|CompareView" | head -10
```

Expected: no new errors from our changed files.
