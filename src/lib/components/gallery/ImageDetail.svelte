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

<!-- Desktop: sidebar panel -->
<div class="hidden md:block w-full overflow-y-auto p-4 h-full">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-sm font-medium text-zinc-300">图片详情</h3>
    {#if closeable}
      <button onclick={onclose} class="text-zinc-500 hover:text-zinc-300">
        <svg
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    {/if}
  </div>

  {#if showThumbnail && thumbnailUrl}
    <div class="rounded-lg overflow-hidden bg-zinc-800 mb-4">
      {#if isMissing}
        <div
          class="aspect-square flex items-center justify-center text-zinc-600 text-xs"
        >
          文件已丢失
        </div>
      {:else}
        <img
          src={thumbnailUrl}
          alt=""
          class="w-full"
          style="aspect-ratio: 1; object-fit: contain;"
        />
      {/if}
    </div>
  {/if}

  <div class="mb-3">
    <div class="text-xs text-zinc-500 mb-1">评分</div>
    <StarRating
      value={rating ?? 0}
      onchange={readonly ? () => {} : (r) => onrate?.(r)}
    />
  </div>

  <div class="mb-3">
    <div class="text-xs text-zinc-500 mb-1">颜色标记</div>
    <ColorLabel
      value={colorLabel}
      onchange={readonly ? () => {} : (c) => oncolor?.(c)}
    />
  </div>

  <div class="mb-3">
    <div class="text-xs text-zinc-500 mb-1">标记</div>
    <FlagButtons {flag} onchange={readonly ? () => {} : (f) => onflag?.(f)} />
  </div>

  <div class="mb-4">
    <div class="text-xs text-zinc-500 mb-1">标签</div>
    <TagEditor
      {tags}
      {allTags}
      onadd={readonly ? () => {} : (t) => onaddtag?.(t)}
      onremove={readonly ? () => {} : (id) => onremovetag?.(id)}
    />
  </div>

  <div class="space-y-1.5 mb-4">
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

  {#if ondownload || oncopylink}
    <div class="flex gap-2 mb-4">
      {#if oncopylink}
        <button
          onclick={oncopylink}
          class="px-3 py-1 rounded text-xs border border-zinc-700 text-zinc-400 hover:bg-zinc-700/50"
          >复制链接</button
        >
      {/if}
      {#if ondownload}
        <button
          onclick={ondownload}
          class="px-3 py-1 rounded text-xs border border-zinc-700 text-zinc-400 hover:bg-zinc-700/50"
          >下载</button
        >
      {/if}
    </div>
  {/if}

  {#if showDelete && ondelete}
    <button
      onclick={ondelete}
      class="w-full rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10"
      >删除图片</button
    >
  {/if}
</div>

<!-- Mobile: collapsed bar -->
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
      <span class="text-amber-400 text-xs shrink-0"
        >{"★".repeat(rating ?? 0)}</span
      >
    {/if}
  </div>
  <svg
    class="w-4 h-4 text-zinc-500 shrink-0 transition-transform {expanded
      ? 'rotate-180'
      : ''}"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M5 15l7-7 7 7"
    />
  </svg>
</button>

<!-- Mobile: expanded overlay -->
{#if expanded}
  <button
    class="md:hidden fixed inset-0 z-[65] bg-black/60"
    onclick={toggleExpanded}
    aria-label="关闭详情"
  ></button>

  <div
    class="md:hidden fixed inset-x-0 bottom-0 z-[70] bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-700/50 rounded-t-2xl shadow-2xl max-h-[60vh] flex flex-col"
  >
    <div
      class="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 shrink-0"
    >
      <span class="text-sm font-medium text-zinc-300">{filename}</span>
      <button
        onclick={toggleExpanded}
        class="text-zinc-500 hover:text-zinc-300 p-1"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>

    <div class="overflow-y-auto px-4 py-3 flex-1">
      {#if showThumbnail && thumbnailUrl}
        <div class="rounded-lg overflow-hidden bg-zinc-800 mb-4">
          {#if isMissing}
            <div
              class="aspect-square flex items-center justify-center text-zinc-600 text-xs"
            >
              文件已丢失
            </div>
          {:else}
            <img
              src={thumbnailUrl}
              alt=""
              class="w-full"
              style="aspect-ratio: 1; object-fit: contain;"
            />
          {/if}
        </div>
      {/if}

      <div class="flex items-center gap-3 px-1 py-2">
        <span class="text-zinc-500 text-xs w-8 shrink-0">评分</span>
        <div class="flex gap-0.5">
          {#each [1, 2, 3, 4, 5] as r}
            <button
              onclick={() => !readonly && onrate?.(r)}
              class="text-lg px-0.5 {r <= (rating ?? 0)
                ? 'text-amber-400'
                : 'text-zinc-600'}"
              disabled={readonly}>★</button
            >
          {/each}
        </div>
      </div>

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

      <div class="flex items-center gap-3 px-1 py-2">
        <span class="text-zinc-500 text-xs w-8 shrink-0">标记</span>
        <div class="flex gap-2">
          <button
            onclick={() => !readonly && onflag?.("pick")}
            class="px-3 py-1 rounded text-xs border border-zinc-700 text-zinc-400 hover:bg-green-500/20 hover:text-green-400 transition-colors {flag ===
              'pick' && !readonly
              ? 'bg-green-500/20 text-green-400'
              : ''}"
            disabled={readonly}>Pick</button
          >
          <button
            onclick={() => !readonly && onflag?.("reject")}
            class="px-3 py-1 rounded text-xs border border-zinc-700 text-zinc-400 hover:bg-red-500/20 hover:text-red-400 transition-colors {flag ===
              'reject' && !readonly
              ? 'bg-red-500/20 text-red-400'
              : ''}"
            disabled={readonly}>Reject</button
          >
        </div>
      </div>

      <div class="space-y-1.5 mt-3">
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

      {#if ondownload || oncopylink || ondelete}
        <div class="mt-4 pt-4 border-t border-zinc-800 flex gap-2">
          {#if oncopylink}
            <button
              onclick={oncopylink}
              class="px-3 py-1 rounded text-xs border border-zinc-700 text-zinc-400 hover:bg-zinc-700/50"
              >复制链接</button
            >
          {/if}
          {#if ondownload}
            <button
              onclick={ondownload}
              class="px-3 py-1 rounded text-xs border border-zinc-700 text-zinc-400 hover:bg-zinc-700/50"
              >下载</button
            >
          {/if}
          {#if showDelete && ondelete}
            <button
              onclick={ondelete}
              class="px-3 py-1 rounded text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10"
              >删除</button
            >
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}
