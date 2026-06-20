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
                  class="text-lg px-0.5 {r <= (rating ?? 0)
                    ? 'text-amber-400'
                    : 'text-zinc-600'}">★</button
                >
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
                >Pick</button
              >
              <button
                onclick={() => onflag?.("reject")}
                class="px-3 py-1 rounded text-xs border border-zinc-700 text-zinc-400 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-colors"
                >Reject</button
              >
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
                  >复制链接</button
                >
              {/if}
              {#if ondownload}
                <button
                  onclick={() => ondownload()}
                  class="px-3 py-1 rounded text-xs border border-zinc-700 text-zinc-400 hover:bg-zinc-700/50 transition-colors"
                  >下载</button
                >
              {/if}
              {#if ondelete}
                <button
                  onclick={() => ondelete()}
                  class="px-3 py-1 rounded text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                  >删除</button
                >
              {/if}
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
