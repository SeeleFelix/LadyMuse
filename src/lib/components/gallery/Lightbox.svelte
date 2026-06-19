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

  let scale = $state(1);
  let translateX = $state(0);
  let translateY = $state(0);
  let isDragging = $state(false);
  let didDrag = $state(false);
  let dragStart = { x: 0, y: 0 };

  // Touch/swipe state
  let pointerStartX = $state(0);
  let pointerActive = $state(false);
  let swipeHandled = $state(false);

  // Pinch state
  let pinchStartDistance = $state(0);
  let pinchStartScale = $state(1);

  // Double-tap state
  let lastTapTime = $state(0);
  let lastTapPos = { x: 0, y: 0 };

  // Copy feedback
  let copied = $state(false);

  const MIN_SCALE = 0.1;
  const MAX_SCALE = 10;

  let currentImage = $derived(images[currentIndex]);

  function resetTransform() {
    scale = 1;
    translateX = 0;
    translateY = 0;
  }

  function getImageUrl(relativePath: string, modifiedAt?: string): string {
    const base = `/${imageUrlBase.replace(/^\/+/, "")}/${encodeURIComponent(relativePath)}`;
    return modifiedAt ? `${base}?t=${new Date(modifiedAt).getTime()}` : base;
  }

  function goNext() {
    if (currentIndex < images.length - 1) {
      resetTransform();
      onnavigate?.(currentIndex + 1);
    }
  }

  function goPrev() {
    if (currentIndex > 0) {
      resetTransform();
      onnavigate?.(currentIndex - 1);
    }
  }

  // === Desktop mouse handlers ===
  function handleWheel(e: WheelEvent) {
    if (!showZoom) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale + delta * scale));
    if (scale <= 1) {
      translateX = 0;
      translateY = 0;
    }
  }

  function handleMouseDown(e: MouseEvent) {
    if (!showZoom) return;
    if (scale > 1) {
      isDragging = true;
      didDrag = false;
      dragStart = { x: e.clientX - translateX, y: e.clientY - translateY };
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (!showZoom) return;
    if (isDragging && scale > 1) {
      const nx = e.clientX - dragStart.x;
      const ny = e.clientY - dragStart.y;
      if (Math.abs(nx - translateX) > 2 || Math.abs(ny - translateY) > 2)
        didDrag = true;
      translateX = nx;
      translateY = ny;
    }
  }

  function handleMouseUp() {
    isDragging = false;
  }

  function toggleZoom(e: MouseEvent) {
    if (!showZoom) return;
    if (didDrag) {
      didDrag = false;
      return;
    }
    if (scale > 1) {
      resetTransform();
    } else {
      scale = 3;
    }
  }

  // === Touch / pointer handlers ===
  function handlePointerDown(e: PointerEvent) {
    if (!showZoom) return;
    if (e.pointerType !== "touch" || scale > 1) return;
    pointerStartX = e.clientX;
    pointerActive = true;
    swipeHandled = false;

    // Double-tap detection
    const now = Date.now();
    const dist = Math.hypot(e.clientX - lastTapPos.x, e.clientY - lastTapPos.y);
    if (now - lastTapTime < 300 && dist < 30) {
      e.preventDefault();
      if (scale > 1) resetTransform();
      else scale = 3;
      lastTapTime = 0;
      return;
    }
    lastTapTime = now;
    lastTapPos = { x: e.clientX, y: e.clientY };
  }

  function handlePointerMove(e: PointerEvent) {
    if (!pointerActive) return;

    const dx = Math.abs(e.clientX - pointerStartX);
    if (!swipeHandled && dx > 30) {
      swipeHandled = true;
    }
  }

  function handlePointerUp(e: PointerEvent) {
    if (!pointerActive) return;
    pointerActive = false;

    if (swipeHandled) {
      const dx = e.clientX - pointerStartX;
      if (dx < -50) goNext();
      else if (dx > 50) goPrev();
    }
  }

  // Pinch zoom via touch events
  function handleTouchMovePinch(e: TouchEvent) {
    if (!showZoom) return;
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);

      if (pinchStartDistance === 0) {
        pinchStartDistance = dist;
        pinchStartScale = scale;
      } else {
        scale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, pinchStartScale * (dist / pinchStartDistance)),
        );
        if (scale <= 1) {
          translateX = 0;
          translateY = 0;
        }
      }
    }
  }

  function resetPinch() {
    pinchStartDistance = 0;
  }

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
    } else if (e.key === "ArrowRight") goNext();
    else if (e.key === "ArrowLeft") goPrev();
    else if (e.key === "+" || e.key === "=")
      scale = Math.min(MAX_SCALE, scale * 1.2);
    else if (e.key === "-") scale = Math.max(MIN_SCALE, scale / 1.2);
  }

  $effect(() => {
    resetTransform();
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 bg-black/95 flex flex-col"
  onwheel={handleWheel}
  onmousedown={handleMouseDown}
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
  onmouseleave={handleMouseUp}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  ontouchmove={handleTouchMovePinch}
  ontouchend={resetPinch}
  role="dialog"
>
  <!-- Toolbar -->
  <div class="flex items-center justify-between px-4 py-2 bg-black/50">
    <div class="text-sm text-zinc-300 truncate max-w-[200px] md:max-w-md">
      {currentImage?.filename || ""}
    </div>
    <div class="flex items-center gap-2 md:gap-3">
      {#if showZoom}
        <span class="text-xs text-zinc-500">{Math.round(scale * 100)}%</span>
        <span class="text-xs text-zinc-500"
          >{currentIndex + 1}/{images.length}</span
        >
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

  <!-- Image area + optional info panel -->
  <div class="flex-1 flex overflow-hidden">
    <div
      class="flex-1 flex items-center justify-center overflow-hidden relative"
    >
      {#if currentImage}
        <!-- Navigation arrows (hidden on mobile, replaced by swipe) -->
        {#if currentIndex > 0}
          <button
            onclick={goPrev}
            class="absolute left-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 hidden md:block"
          >
            <svg
              class="w-6 h-6"
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
        {/if}
        {#if currentIndex < images.length - 1}
          <button
            onclick={goNext}
            class="absolute right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 hidden md:block"
          >
            <svg
              class="w-6 h-6"
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
        {/if}

        <img
          src={getImageUrl(currentImage.relativePath, currentImage.modifiedAt)}
          alt=""
          onclick={(e) => toggleZoom(e)}
          oncontextmenu={(e) => {
            e.preventDefault();
            oncontextmenu?.(e);
          }}
          class="max-w-full max-h-full select-none {showZoom && scale <= 1
            ? 'object-contain cursor-zoom-in'
            : showZoom
              ? 'cursor-zoom-out'
              : 'object-contain'}"
          style="transform: scale({scale}) translate({translateX /
            scale}px, {translateY / scale}px); transition: {isDragging
            ? 'none'
            : 'transform 0.2s ease'}; touch-action: manipulation;"
          draggable="false"
        />
      {/if}
    </div>

    {#if showInfo && currentImage}
      <div
        class="w-80 shrink-0 border-l border-zinc-800 bg-zinc-900/80 overflow-y-auto p-4"
      >
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

  <!-- Filmstrip (hidden on mobile) -->
  {#if showFilmstrip && images.length > 1}
    <div
      class="h-16 bg-black/50 hidden md:flex items-center gap-1 px-4 overflow-x-auto"
    >
      {#each images as img, i}
        <button
          onclick={() => {
            resetTransform();
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
