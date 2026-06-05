<script lang="ts">
  import DetailPanel from "./DetailPanel.svelte";
  import type { GalleryStore, ImageResult } from "$lib/stores/gallery-store";
  import type { ViewMode } from "$lib/stores/gallery-store";

  interface Tag {
    id: number;
    name: string;
    slug: string;
  }

  let { store, allTags = [] }: { store: GalleryStore; allTags?: Tag[] } =
    $props();

  type ZoomMode = "fit" | "100";

  let zoomMode = $state<ZoomMode>("fit");

  // Current image index for navigation
  let currentIndex = $derived(
    store.activeImage
      ? store.images.findIndex(
          (img) => img.relativePath === store.activeImage!.relativePath,
        )
      : -1,
  );

  function getImageUrl(image: ImageResult): string {
    return `/api/comfyui/image/${encodeURIComponent(image.relativePath)}`;
  }

  function handleThumbnailClick(path: string) {
    store.select(path, false, false);
  }

  function navigateNext() {
    if (currentIndex < store.images.length - 1) {
      store.select(store.images[currentIndex + 1].relativePath, false, false);
    }
  }

  function navigatePrev() {
    if (currentIndex > 0) {
      store.select(store.images[currentIndex - 1].relativePath, false, false);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowLeft") navigatePrev();
    else if (e.key === "ArrowRight") navigateNext();
    else if (e.key === "Escape") store.setViewMode("library");
  }

  // Keyboard navigation
  $effect(() => {
    const handler = (e: KeyboardEvent) => handleKeydown(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
</script>

<svelte:window />

<div class="flex flex-col h-full bg-zinc-950">
  <!-- Main preview area + detail panel -->
  <div class="flex-1 flex min-h-0">
    <!-- Large preview area -->
    <div class="flex-1 flex flex-col bg-zinc-900/30 relative">
      <!-- Toolbar -->
      <div
        class="flex items-center justify-between px-4 py-2 border-b border-zinc-800"
      >
        <div class="flex items-center gap-2">
          <button
            onclick={() => store.setViewMode("library")}
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
            {currentIndex >= 0 ? currentIndex + 1 : 0} / {store.images.length}
          </span>
        </div>

        <!-- Zoom controls -->
        <div class="flex items-center gap-1">
          <button
            onclick={() => (zoomMode = "fit")}
            class="text-xs px-2 py-1 rounded {zoomMode === 'fit'
              ? 'bg-violet-500/20 text-violet-300'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}"
          >
            适应
          </button>
          <button
            onclick={() => (zoomMode = "100")}
            class="text-xs px-2 py-1 rounded {zoomMode === '100'
              ? 'bg-violet-500/20 text-violet-300'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}"
          >
            100%
          </button>
        </div>

        <!-- Navigation -->
        <div class="flex items-center gap-1">
          <button
            onclick={navigatePrev}
            disabled={currentIndex <= 0}
            class="p-1 rounded {currentIndex > 0
              ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              : 'text-zinc-700 cursor-not-allowed'}"
          >
            <svg
              class="w-4 h-4"
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
          </button>
          <button
            onclick={navigateNext}
            disabled={currentIndex >= store.images.length - 1}
            class="p-1 rounded {currentIndex < store.images.length - 1
              ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              : 'text-zinc-700 cursor-not-allowed'}"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- Preview image -->
      <div class="flex-1 flex items-center justify-center overflow-hidden p-4">
        {#if store.activeImage && !store.activeImage.isMissing}
          <img
            src={getImageUrl(store.activeImage)}
            alt=""
            class="max-w-full max-h-full"
            class:object-contain={zoomMode === "fit"}
            class:object-none={zoomMode === "100"}
            draggable="false"
          />
        {:else if store.activeImage?.isMissing}
          <div class="text-center">
            <svg
              class="w-16 h-16 text-zinc-600 mx-auto mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 2.502-3.618V13.38c0-1.951-.962-3.618-2.502-3.618H5.114c-1.54 0-2.502 1.667-2.502 3.618v1.414c0 1.951.962 3.618 2.502 3.618z"
              />
            </svg>
            <p class="text-sm text-zinc-600">文件已丢失</p>
          </div>
        {:else}
          <div class="text-center">
            <p class="text-sm text-zinc-600">请选择一张图片</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- Detail Panel -->
    {#if store.activeImage}
      <DetailPanel
        image={store.activeImage}
        {allTags}
        onrate={(r) =>
          store.updateAttributes(store.activeImage!.relativePath, {
            rating: r,
          })}
        oncolor={(c) =>
          store.updateAttributes(store.activeImage!.relativePath, {
            colorLabel: c,
          })}
        onflag={(f) =>
          store.updateAttributes(store.activeImage!.relativePath, { flag: f })}
        onaddtag={(t) => {
          /* TODO: Implement tag add */
        }}
        onremovetag={(id) => {
          /* TODO: Implement tag remove */
        }}
        onclose={() => (store.activeImage = null)}
      />
    {/if}
  </div>

  <!-- Filmstrip -->
  <div class="h-14 border-t border-zinc-800 bg-zinc-900/50 overflow-x-auto">
    <div class="flex gap-2 px-2 py-1 h-full items-center">
      {#each store.images as image}
        <button
          onclick={() => handleThumbnailClick(image.relativePath)}
          class="shrink-0 h-10 rounded overflow-hidden border-2 transition-colors {store
            .activeImage?.relativePath === image.relativePath
            ? 'border-violet-500'
            : 'border-transparent hover:border-zinc-600'}"
          title={image.relativePath}
        >
          <img
            src={getImageUrl(image)}
            alt=""
            class="h-full w-auto object-cover"
            draggable="false"
          />
        </button>
      {/each}
    </div>
  </div>
</div>
