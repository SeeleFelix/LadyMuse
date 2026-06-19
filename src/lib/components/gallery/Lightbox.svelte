<script lang="ts">
  import { untrack } from "svelte";
  import ImageInfo from "./ImageInfo.svelte";
  import PhotoSwipe from "photoswipe";
  import "photoswipe/style.css";

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

  // Copy feedback
  let copied = $state(false);

  // PhotoSwipe
  let pswp = $state<PhotoSwipe | null>(null);
  let currentZoom = $state(1);

  // Mobile info sheet — single pixel-offset system
  let sheetOpen = $state(false);
  let sheetDragPx = $state(0);
  let sheetDragging = $state(false);
  let sheetStartY = $state(0);
  let sheetStartPx = $state(0);

  const SHEET_HANDLE_H = 48;

  function sheetPanelH() {
    return Math.round(window.innerHeight * 0.5);
  }

  function sheetClosedOffset() {
    return sheetPanelH() - SHEET_HANDLE_H;
  }

  function sheetYpx(): number {
    if (sheetDragging) {
      return Math.max(0, Math.min(sheetClosedOffset(), sheetDragPx));
    }
    return sheetOpen ? 0 : sheetClosedOffset();
  }

  function toggleSheet() {
    sheetOpen = !sheetOpen;
  }

  function handleSheetPointerDown(e: PointerEvent) {
    sheetDragging = true;
    sheetStartY = e.clientY;
    sheetStartPx = sheetOpen ? 0 : sheetClosedOffset();
    (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
  }

  function handleSheetPointerMove(e: PointerEvent) {
    if (!sheetDragging) return;
    sheetDragPx = sheetStartPx + (e.clientY - sheetStartY);
  }

  function handleSheetPointerUp(_e: PointerEvent) {
    sheetDragging = false;
    const threshold = sheetClosedOffset() * 0.45;
    sheetOpen = sheetDragPx < threshold;
    sheetDragPx = 0;
  }

  let currentImage = $derived(images[currentIndex]);

  function getImageUrl(relativePath: string, modifiedAt?: string): string {
    const base = `/${imageUrlBase.replace(/^\/+/, "")}/${encodeURIComponent(relativePath)}`;
    return modifiedAt ? `${base}?t=${new Date(modifiedAt).getTime()}` : base;
  }

  // === PhotoSwipe lifecycle ===
  function buildDataSource() {
    return images.map((img) => ({
      src: getImageUrl(img.relativePath, img.modifiedAt),
      width: img.width || 1600,
      height: img.height || 900,
    }));
  }

  function createPswp(index: number) {
    destroyPswp();

    pswp = new PhotoSwipe({
      dataSource: buildDataSource(),
      index,
      bgOpacity: 0.85,
      arrowKeys: false,
      escKey: false,
      closeOnVerticalDrag: false,
      pinchToClose: false,
      clickToCloseNonZoomable: false,
      preload: [1, 1],
    });

    pswp.init();

    pswp.on("change", () => {
      if (!pswp?.currSlide) return;
      onnavigate?.(pswp.currSlide.index);
    });

    pswp.on("close", () => {
      onclose();
    });

    pswp.on("imageSizeChange", () => {
      if (pswp?.currSlide) currentZoom = pswp.currSlide.currZoomLevel;
    });
  }

  function destroyPswp() {
    if (pswp) {
      pswp.destroy();
      pswp = null;
    }
  }

  function pswpGoNext() {
    if (!pswp?.currSlide || currentIndex >= images.length - 1) return;
    pswp.next();
  }

  function pswpGoPrev() {
    if (!pswp?.currSlide || currentIndex <= 0) return;
    pswp.prev();
  }

  function pswpZoomFit() {
    if (!pswp?.currSlide) return;
    pswp.currSlide.zoomTo(
      pswp.currSlide.zoomLevels.initial,
      { x: 0, y: 0 },
      333,
    );
  }

  function pswpZoomOne() {
    if (!pswp?.currSlide) return;
    pswp.currSlide.zoomTo(1, { x: 0, y: 0 }, 333);
  }

  // Create PS on mount, destroy on unmount
  $effect(() => {
    createPswp(untrack(() => currentIndex));
    return () => destroyPswp();
  });

  // Navigate PS when parent changes currentIndex (filmstrip, etc.)
  $effect(() => {
    if (pswp?.currSlide && pswp.currSlide.index !== currentIndex) {
      pswp.goTo(currentIndex);
    }
  });

  // === Download and copy ===
  function getFullImageUrl(): string {
    if (!currentImage) return "";
    return new URL(
      getImageUrl(currentImage.relativePath, currentImage.modifiedAt),
      window.location.origin,
    ).toString();
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(getFullImageUrl());
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {}
  }

  function handleDownload() {
    if (!currentImage) return;
    const filename =
      currentImage.filename ||
      currentImage.relativePath.split("/").pop() ||
      "image";
    ondownload?.(
      getImageUrl(currentImage.relativePath, currentImage.modifiedAt),
      filename,
    );
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (contextMenuOpen) return;
      onclose();
    } else if (e.key === "ArrowRight") pswpGoNext();
    else if (e.key === "ArrowLeft") pswpGoPrev();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-[1600] flex flex-col pointer-events-none"
  role="dialog"
>
  <!-- Toolbar -->
  <div
    class="flex items-center justify-between px-4 py-2 bg-black/50 pointer-events-auto"
  >
    <div class="text-sm text-zinc-300 truncate max-w-[200px] md:max-w-md">
      {currentImage?.filename || ""}
    </div>
    <div class="flex items-center gap-2 md:gap-3">
      {#if showZoom}
        <span class="text-xs text-zinc-500"
          >{Math.round(currentZoom * 100)}%</span
        >
        <span class="text-xs text-zinc-500"
          >{currentIndex + 1}/{images.length}</span
        >
        <button
          onclick={pswpZoomFit}
          class="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-zinc-800"
          >适应</button
        >
        <button
          onclick={pswpZoomOne}
          class="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-zinc-800 hidden md:block"
          >1:1</button
        >
      {:else}
        <span class="text-xs text-zinc-500"
          >{currentIndex + 1}/{images.length}</span
        >
      {/if}

      <!-- Copy link -->
      {#if showCopyLink}
        <button
          onclick={handleCopyLink}
          class="text-zinc-400 hover:text-white p-1.5 rounded hover:bg-zinc-800"
          title="复制链接"
        >
          {#if copied}
            <svg
              class="w-4 h-4 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          {:else}
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
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          {/if}
        </button>
      {/if}

      <!-- Download -->
      {#if showDownload}
        <button
          onclick={handleDownload}
          class="text-zinc-400 hover:text-white p-1.5 rounded hover:bg-zinc-800"
          title="下载"
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
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        </button>
      {/if}

      <button
        onclick={onclose}
        class="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800"
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
  </div>

  <!-- PS handles image display full-screen behind us -->
  <div class="flex-1"></div>

  <!-- Desktop: sidebar overlay -->
  {#if showInfo && currentImage}
    <div
      class="hidden md:block fixed right-0 top-0 bottom-0 w-80 border-l border-zinc-800 bg-zinc-900/90 overflow-y-auto p-4 pointer-events-auto z-[1610]"
    >
      <div class="text-xs text-zinc-500 mb-3 mt-12">图片信息</div>
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

  <!-- Mobile: draggable bottom sheet for image info -->
  {#if showInfo && currentImage}
    <div
      class="md:hidden fixed inset-x-0 bottom-0 z-[60] bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-700/50 rounded-t-2xl shadow-2xl"
      onpointerdown={(e) => e.stopPropagation()}
      onpointermove={(e) => e.stopPropagation()}
      onpointerup={(e) => e.stopPropagation()}
      ontouchstart={(e) => e.stopPropagation()}
      ontouchmove={(e) => e.stopPropagation()}
      ontouchend={(e) => e.stopPropagation()}
      style="height: 50vh; transform: translateY({sheetYpx()}px); transition: {sheetDragging
        ? 'none'
        : 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'};"
    >
      <!-- Handle area (48px, always visible) -->
      <div
        class="flex flex-col items-center pt-3 pb-2 cursor-pointer select-none touch-none"
        onclick={toggleSheet}
        onpointerdown={handleSheetPointerDown}
        onpointermove={handleSheetPointerMove}
        onpointerup={handleSheetPointerUp}
        role="button"
        tabindex="0"
      >
        <div class="w-8 h-1 rounded-full bg-zinc-500/60 mb-2"></div>
        <div class="flex items-center gap-2 text-xs">
          <span class="text-zinc-400"
            >{sheetOpen ? "下滑收起" : "图片信息"}</span
          >
          {#if (currentImage.rating ?? 0) > 0}
            <span class="text-amber-400 text-xs">
              {"★".repeat(currentImage.rating ?? 0)}
            </span>
          {/if}
          {#if currentImage.width && currentImage.height}
            <span class="text-zinc-500"
              >{currentImage.width}×{currentImage.height}</span
            >
          {/if}
        </div>
      </div>

      <!-- Sheet content (scrollable) -->
      <div
        class="overflow-y-auto px-4 pb-6"
        style="height: calc(50vh - {SHEET_HANDLE_H}px); touch-action: pan-y;"
      >
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
    </div>
  {/if}

  <!-- Filmstrip (hidden on mobile) -->
  {#if showFilmstrip && images.length > 1}
    <div
      class="h-16 bg-black/50 hidden md:flex items-center gap-1 px-4 overflow-x-auto pointer-events-auto"
    >
      {#each images as img, i}
        <button
          onclick={() => {
            onnavigate?.(i);
          }}
          class="shrink-0 w-12 h-12 rounded {i === currentIndex
            ? 'ring-2 ring-violet-500'
            : 'opacity-60 hover:opacity-100'} overflow-hidden"
        >
          <img
            src={getImageUrl(img.relativePath, img.modifiedAt)}
            alt=""
            class="w-full h-full object-cover"
            loading="lazy"
          />
        </button>
      {/each}
    </div>
    <!-- Mobile page dots -->
    <div
      class="flex md:hidden justify-center items-center gap-1.5 py-2 bg-black/50"
    >
      {#each images as _, i}
        <div
          class="w-1.5 h-1.5 rounded-full {i === currentIndex
            ? 'bg-violet-400'
            : 'bg-zinc-600'}"
        ></div>
      {/each}
    </div>
  {/if}
</div>

<style>
  :global(.pswp__ui) {
    display: none !important;
  }
</style>
