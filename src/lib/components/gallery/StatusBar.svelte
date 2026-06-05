<script lang="ts">
  import type { ViewMode } from "$lib/stores/gallery-store";

  let {
    totalImages = 0,
    selectedCount = 0,
    filteredCount = 0,
    loading = false,
    viewMode = "library",
  }: {
    totalImages?: number;
    selectedCount?: number;
    filteredCount?: number;
    loading?: boolean;
    viewMode?: ViewMode;
  } = $props();

  function getCountText(): string {
    if (filteredCount > 0 && filteredCount !== totalImages) {
      return `${filteredCount} / ${totalImages}`;
    }
    return `${totalImages}`;
  }

  function getSelectionText(): string {
    if (selectedCount === 0) return "";
    if (selectedCount === 1) return "1 张已选";
    return `${selectedCount} 张已选`;
  }
</script>

<div
  class="border-t border-zinc-800 px-4 py-2 flex items-center justify-between bg-zinc-900/50"
>
  <!-- Left: Image count -->
  <div class="text-xs text-zinc-500">
    {getCountText()} 张图片
  </div>

  <!-- Center: Selection count -->
  {#if selectedCount > 0}
    <div class="text-xs text-violet-400 font-medium">
      {getSelectionText()}
    </div>
  {/if}

  <!-- Right: View mode and loading indicator -->
  <div class="flex items-center gap-3">
    <span class="text-xs text-zinc-600 capitalize">
      {viewMode}
    </span>
    {#if loading}
      <div class="flex items-center gap-1">
        <svg
          class="w-3 h-3 text-zinc-500 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span class="text-xs text-zinc-500">加载中...</span>
      </div>
    {/if}
  </div>
</div>
