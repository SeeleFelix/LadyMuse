<script lang="ts">
  import DetailPanel from "./DetailPanel.svelte";
  import type {
    GalleryStore,
    ImageResult,
  } from "$lib/stores/gallery-store.svelte";

  interface Tag {
    id: number;
    name: string;
    slug: string;
  }

  let { store, allTags = [] }: { store: GalleryStore; allTags?: Tag[] } =
    $props();

  let leftDetailImage = $state<ImageResult | null>(null);
  let rightDetailImage = $state<ImageResult | null>(null);
  let gridDetailImage = $state<ImageResult | null>(null);

  // Zoom state
  let zoom = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let dragging = $state(false);
  let dragStartX = 0;
  let dragStartY = 0;
  let panStartX = 0;
  let panStartY = 0;

  // Get selected images (limit to 4)
  let selectedImages = $derived(
    store.images
      .filter((img) => store.selectedPaths.has(img.relativePath))
      .slice(0, 4),
  );

  let selectionCount = $derived(selectedImages.length);
  let isTwoImageMode = $derived(selectionCount === 2);

  function getImageUrl(image: ImageResult): string {
    return `/api/comfyui/images/${encodeURIComponent(image.relativePath)}`;
  }

  function handleImageClick(image: ImageResult, side?: "left" | "right") {
    if (isTwoImageMode) {
      if (side === "left") leftDetailImage = image;
      else if (side === "right") rightDetailImage = image;
    } else {
      gridDetailImage = image;
    }
  }

  function handleCloseDetail(side?: "left" | "right") {
    if (side === "left") leftDetailImage = null;
    else if (side === "right") rightDetailImage = null;
    else gridDetailImage = null;
  }

  function handleBack() {
    store.setViewMode("library");
  }

  function handleUpdate(path: string, updates: Record<string, unknown>) {
    store.updateAttributes(path, updates);
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoom = Math.max(0.1, Math.min(10, zoom + delta));
  }

  function fitToScreen() {
    zoom = 1;
    panX = 0;
    panY = 0;
  }

  function handleDragStart(e: MouseEvent) {
    if (zoom <= 1) return;
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    panStartX = panX;
    panStartY = panY;
  }

  function handleDragMove(e: MouseEvent) {
    if (!dragging) return;
    panX = panStartX + (e.clientX - dragStartX);
    panY = panStartY + (e.clientY - dragStartY);
  }

  function handleDragEnd() {
    dragging = false;
  }

  function handleDblClickImage() {
    zoom = zoom === 1 ? 2 : 1;
    if (zoom === 1) {
      panX = 0;
      panY = 0;
    }
  }
</script>

<div class="flex flex-col h-full bg-zinc-950">
  <!-- Toolbar -->
  <div
    class="flex items-center justify-between px-4 py-2 border-b border-zinc-800"
  >
    <div class="flex items-center gap-2">
      <button
        onclick={handleBack}
        class="text-zinc-400 hover:text-zinc-200 text-xs px-2 py-1 rounded hover:bg-zinc-800 flex items-center gap-1"
      >
        <svg
          class="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        返回
      </button>
      <span class="text-xs text-zinc-500">
        对比视图 ({selectionCount} 张)
      </span>
    </div>

    <div class="flex items-center gap-1">
      <button
        onclick={fitToScreen}
        class="text-xs px-2 py-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
        >适应</button
      >
      <span class="text-xs text-zinc-600">{Math.round(zoom * 100)}%</span>
      <button
        onclick={() => {
          zoom = Math.min(10, zoom + 0.5);
        }}
        class="text-xs px-2 py-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
        >+</button
      >
      <button
        onclick={() => {
          zoom = Math.max(0.1, zoom - 0.5);
        }}
        class="text-xs px-2 py-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
        >&minus;</button
      >
    </div>
  </div>

  <!-- Main content -->
  <div class="flex-1 flex min-h-0">
    {#if selectionCount < 2}
      <!-- Not enough images selected -->
      <div class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <svg
            class="w-12 h-12 text-zinc-600 mx-auto mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            />
          </svg>
          <p class="text-sm text-zinc-600">请选择 2-4 张图片进行对比</p>
          <p class="text-xs text-zinc-700 mt-1">按住 Shift 或 Ctrl 点击多选</p>
        </div>
      </div>
    {:else if isTwoImageMode}
      <!-- 2-image mode: DetA | ImageA | ImageB | DetB -->
      <div class="flex-1 flex">
        <!-- Left detail panel -->
        <div class="w-64 shrink-0 border-r border-zinc-800">
          {#if leftDetailImage}
            <DetailPanel
              image={leftDetailImage}
              {allTags}
              onrate={(r) =>
                handleUpdate(leftDetailImage!.relativePath, { rating: r })}
              oncolor={(c) =>
                handleUpdate(leftDetailImage!.relativePath, { colorLabel: c })}
              onflag={(f) =>
                handleUpdate(leftDetailImage!.relativePath, { flag: f })}
              onaddtag={(t) => {
                /* TODO */
              }}
              onremovetag={(id) => {
                /* TODO */
              }}
              onclose={() => handleCloseDetail("left")}
            />
          {:else}
            <div
              class="h-full flex items-center justify-center text-zinc-600 text-xs"
            >
              点击左侧图片查看详情
            </div>
          {/if}
        </div>

        <!-- Images (center) -->
        <div
          class="flex-1 flex bg-zinc-900/30"
          onwheel={handleWheel}
          onmousedown={handleDragStart}
          onmousemove={handleDragMove}
          onmouseup={handleDragEnd}
          onmouseleave={handleDragEnd}
        >
          {#each selectedImages as image, i}
            <div
              class="flex-1 flex items-center justify-center p-4 overflow-hidden {i ===
              0
                ? 'border-r border-zinc-800'
                : ''}"
            >
              <button
                onclick={() =>
                  handleImageClick(image, i === 0 ? "left" : "right")}
                class="relative max-w-full max-h-full"
                style="transform: scale({zoom}) translate({panX /
                  zoom}px, {panY / zoom}px)"
                ondblclick={handleDblClickImage}
              >
                <img
                  src={getImageUrl(image)}
                  alt={image.relativePath}
                  class="max-w-full max-h-full object-contain select-none"
                  draggable="false"
                />
                <div
                  class="absolute bottom-0 left-0 right-0 bg-black/60 text-xs text-zinc-300 px-2 py-1 truncate"
                >
                  {image.relativePath.split("/").pop()}
                </div>
              </button>
            </div>
          {/each}
        </div>

        <!-- Right detail panel -->
        <div class="w-64 shrink-0 border-l border-zinc-800">
          {#if rightDetailImage}
            <DetailPanel
              image={rightDetailImage}
              {allTags}
              onrate={(r) =>
                handleUpdate(rightDetailImage!.relativePath, { rating: r })}
              oncolor={(c) =>
                handleUpdate(rightDetailImage!.relativePath, { colorLabel: c })}
              onflag={(f) =>
                handleUpdate(rightDetailImage!.relativePath, { flag: f })}
              onaddtag={(t) => {
                /* TODO */
              }}
              onremovetag={(id) => {
                /* TODO */
              }}
              onclose={() => handleCloseDetail("right")}
            />
          {:else}
            <div
              class="h-full flex items-center justify-center text-zinc-600 text-xs"
            >
              点击右侧图片查看详情
            </div>
          {/if}
        </div>
      </div>
    {:else}
      <!-- 3-4 image mode: Grid (2x2) | Detail -->
      <div class="flex-1 flex">
        <!-- Grid -->
        <div
          class="flex-1 bg-zinc-900/30 p-4"
          onwheel={handleWheel}
          onmousedown={handleDragStart}
          onmousemove={handleDragMove}
          onmouseup={handleDragEnd}
          onmouseleave={handleDragEnd}
        >
          <div class="grid grid-cols-2 gap-4 h-full">
            {#each selectedImages as image}
              <div
                class="flex items-center justify-center border border-zinc-800 rounded overflow-hidden"
              >
                <button
                  onclick={() => handleImageClick(image)}
                  class="relative max-w-full max-h-full"
                  style="transform: scale({zoom}) translate({panX /
                    zoom}px, {panY / zoom}px)"
                  ondblclick={handleDblClickImage}
                >
                  <img
                    src={getImageUrl(image)}
                    alt={image.relativePath}
                    class="max-w-full max-h-full object-contain select-none"
                    draggable="false"
                  />
                  <div
                    class="absolute bottom-0 left-0 right-0 bg-black/60 text-xs text-zinc-300 px-2 py-1 truncate"
                  >
                    {image.relativePath.split("/").pop()}
                  </div>
                </button>
              </div>
            {/each}
          </div>
        </div>

        <!-- Single detail panel -->
        <div class="w-64 shrink-0 border-l border-zinc-800">
          {#if gridDetailImage}
            <DetailPanel
              image={gridDetailImage}
              {allTags}
              onrate={(r) =>
                handleUpdate(gridDetailImage!.relativePath, { rating: r })}
              oncolor={(c) =>
                handleUpdate(gridDetailImage!.relativePath, { colorLabel: c })}
              onflag={(f) =>
                handleUpdate(gridDetailImage!.relativePath, { flag: f })}
              onaddtag={(t) => {
                /* TODO */
              }}
              onremovetag={(id) => {
                /* TODO */
              }}
              onclose={() => handleCloseDetail()}
            />
          {:else}
            <div
              class="h-full flex items-center justify-center text-zinc-600 text-xs p-4 text-center"
            >
              点击图片查看详情
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
