<script lang="ts">
  import ImageDetail from "./ImageDetail.svelte";

  let {
    images = [],
    currentIndex = 0,
    contextMenuOpen = false,
    showZoom = true,
    showDownload = true,
    showCopyLink = true,
    showFilmstrip = true,
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
    images: {
      relativePath: string;
      filename: string;
      modifiedAt?: string;
      width?: number | null;
      height?: number | null;
      fileSize?: number | null;
      fileFormat?: string | null;
      rating?: number | null;
      colorLabel?: string | null;
      flag?: string | null;
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
    showActions?: boolean;
    imageUrlBase?: string;
    onclose: () => void;
    onnavigate?: (index: number) => void;
    oncontextmenu?: (e: MouseEvent) => void;
    onrate?: (rating: number) => void;
    oncolor?: (color: string | null) => void;
    onflag?: (flag: string | null) => void;
    ondelete?: () => void;
    ondownload?: (imageUrl: string, filename: string) => void;
  } = $props();

  let scale = $state(1);
  let translateX = $state(0);
  let translateY = $state(0);
  let isDragging = $state(false);
  let didDrag = $state(false);
  let dragStart = { x: 0, y: 0 };

  // === Touch state (single system for all mobile interactions) ===
  let touchStartX = $state(0);
  let touchStartY = $state(0);
  let touchStartScale = $state(1);
  let touchStartTX = $state(0);
  let touchStartTY = $state(0);
  let touchActive = $state(false);
  let touchMoved = $state(false);
  let touchIsPinch = $state(false);
  let pinchStartDist = $state(0);

  // Double-tap state
  let lastTapTime = $state(0);
  let lastTapPos = { x: 0, y: 0 };

  // Copy feedback
  let copied = $state(false);

  // Two-layer transform: wrapper(translate) + image(scale) — production standard
  let wrapperEl = $state<HTMLDivElement>();
  let imageEl = $state<HTMLImageElement>();

  function applyGestureTransform(sx: number, tx: number, ty: number) {
    if (!wrapperEl || !imageEl) return;
    wrapperEl.style.transform = `translate(${tx}px, ${ty}px)`;
    wrapperEl.style.transition = "none";
    imageEl.style.transform = `scale(${sx})`;
    imageEl.style.transition = "none";
  }

  function endGesture() {
    if (!wrapperEl || !imageEl) return;
    wrapperEl.style.transition = "transform 0.2s ease";
    imageEl.style.transition = "transform 0.2s ease";
    // sync $state from DOM for toolbar display
    const wm = new DOMMatrixReadOnly(getComputedStyle(wrapperEl).transform);
    const im = new DOMMatrixReadOnly(getComputedStyle(imageEl).transform);
    scale = Math.hypot(im.a, im.b);
    translateX = wm.e;
    translateY = wm.f;
  }

  function scheduleGestureTransform(s: number, tx: number, ty: number) {
    const sx = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
    const px = sx <= 1 ? 0 : tx;
    const py = sx <= 1 ? 0 : ty;
    applyGestureTransform(sx, px, py);
  }

  const MIN_SCALE = 0.1;
  const MAX_SCALE = 10;

  let currentImage = $derived(images[currentIndex]);

  function resetTransform() {
    if (wrapperEl) {
      wrapperEl.style.transform = "";
      wrapperEl.style.transition = "transform 0.2s ease";
    }
    if (imageEl) {
      imageEl.style.transform = "";
      imageEl.style.transition = "transform 0.2s ease";
    }
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
    const newScale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, scale + delta * scale),
    );
    const newTX = newScale <= 1 ? 0 : translateX;
    const newTY = newScale <= 1 ? 0 : translateY;
    applyGestureTransform(newScale, newTX, newTY);
    scale = newScale;
    translateX = newTX;
    translateY = newTY;
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
      scheduleGestureTransform(scale, nx, ny);
    }
  }

  function handleMouseUp() {
    isDragging = false;
    endGesture();
  }

  function toggleZoom(e: MouseEvent) {
    if (!showZoom) return;
    if (e.detail === 0) return; // synthetic click from touch — ignore
    if (didDrag) {
      didDrag = false;
      return;
    }
    if (scale > 1) {
      resetTransform();
    } else {
      // Zoom to click position — two-layer: wrapper translates, image scales
      const rect = wrapperEl?.getBoundingClientRect();
      const cx = rect ? e.clientX - rect.left : 0;
      const cy = rect ? e.clientY - rect.top : 0;
      const newScale = 3;
      const tx = cx * (1 - newScale);
      const ty = cy * (1 - newScale);
      if (wrapperEl && imageEl) {
        wrapperEl.style.transform = `translate(${tx}px, ${ty}px)`;
        wrapperEl.style.transition = "transform 0.2s ease";
        imageEl.style.transform = `scale(${newScale})`;
        imageEl.style.transition = "transform 0.2s ease";
      }
      scale = newScale;
      translateX = tx;
      translateY = ty;
    }
  }

  // === Touch handlers (mobile only — not shared with desktop) ===
  function handleTouchStart(e: TouchEvent) {
    if (!showZoom) return;

    const touches = e.touches;

    if (touches.length === 2) {
      // Pinch start — cancel any active single-finger tracking
      touchIsPinch = true;
      touchActive = false;
      e.preventDefault();

      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      pinchStartDist = Math.hypot(dx, dy);
      touchStartScale = scale;
      touchStartX = (touches[0].clientX + touches[1].clientX) / 2;
      touchStartY = (touches[0].clientY + touches[1].clientY) / 2;
      touchStartTX = translateX;
      touchStartTY = translateY;
      return;
    }

    if (touches.length === 1 && !touchIsPinch) {
      touchStartX = touches[0].clientX;
      touchStartY = touches[0].clientY;
      touchStartScale = scale;
      touchStartTX = translateX;
      touchStartTY = translateY;
      touchActive = true;
      touchMoved = false;

      // Double-tap detection
      const now = Date.now();
      const dist = Math.hypot(
        touches[0].clientX - lastTapPos.x,
        touches[0].clientY - lastTapPos.y,
      );
      if (now - lastTapTime < 300 && dist < 30) {
        e.preventDefault();
        if (scale > 1) {
          resetTransform();
        } else {
          // Zoom to tap position — two-layer
          const rect = wrapperEl?.getBoundingClientRect();
          const cx = rect ? touches[0].clientX - rect.left : 0;
          const cy = rect ? touches[0].clientY - rect.top : 0;
          const newScale = 3;
          const tx = cx * (1 - newScale);
          const ty = cy * (1 - newScale);
          if (wrapperEl && imageEl) {
            wrapperEl.style.transform = `translate(${tx}px, ${ty}px)`;
            wrapperEl.style.transition = "transform 0.2s ease";
            imageEl.style.transform = `scale(${newScale})`;
            imageEl.style.transition = "transform 0.2s ease";
          }
          scale = newScale;
          translateX = tx;
          translateY = ty;
        }
        lastTapTime = 0;
        touchActive = false;
        return;
      }
      lastTapTime = now;
      lastTapPos = {
        x: touches[0].clientX,
        y: touches[0].clientY,
      };
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!showZoom) return;

    const touches = e.touches;

    if (touchIsPinch && touches.length === 2) {
      e.preventDefault();
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const mx = (touches[0].clientX + touches[1].clientX) / 2;
      const my = (touches[0].clientY + touches[1].clientY) / 2;

      const ratio = dist / pinchStartDist;
      const newScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, touchStartScale * ratio),
      );
      const scaleRatio = newScale / touchStartScale;

      scheduleGestureTransform(
        newScale,
        mx * (1 - scaleRatio) + touchStartTX * scaleRatio,
        my * (1 - scaleRatio) + touchStartTY * scaleRatio,
      );
      return;
    }

    if (touchActive && touches.length === 1) {
      const dx = touches[0].clientX - touchStartX;
      const dy = touches[0].clientY - touchStartY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        touchMoved = true;
      }

      if (scale > 1) {
        e.preventDefault();
        scheduleGestureTransform(scale, touchStartTX + dx, touchStartTY + dy);
      }
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    if (!showZoom) return;

    if (touchIsPinch && e.touches.length < 2) {
      endGesture();
      // Pinch ended — transition to single-finger pan if one finger remains
      touchIsPinch = false;
      pinchStartDist = 0;
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTX = translateX;
        touchStartTY = translateY;
        touchActive = true;
        touchMoved = false;
        return;
      }
    }

    if (touchActive && touchMoved && scale <= 1) {
      const t = e.changedTouches[0];
      if (t) {
        const dx = t.clientX - touchStartX;
        if (dx < -50) goNext();
        else if (dx > 50) goPrev();
      }
    }

    if (e.touches.length === 0) {
      endGesture();
      touchActive = false;
      touchMoved = false;
    }
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
  style="touch-action: none;"
  onwheel={handleWheel}
  onmousedown={handleMouseDown}
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
  onmouseleave={handleMouseUp}
  ontouchstart={(e) => handleTouchStart(e)}
  ontouchmove={(e) => handleTouchMove(e)}
  ontouchend={(e) => handleTouchEnd(e)}
  ontouchcancel={(e) => handleTouchEnd(e)}
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

        <div bind:this={wrapperEl} style="transform-origin: 0 0;">
          <img
            bind:this={imageEl}
            src={getImageUrl(
              currentImage.relativePath,
              currentImage.modifiedAt,
            )}
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
            style="touch-action: manipulation; will-change: transform; transform-origin: 0 0;"
            draggable="false"
          />
        </div>
      {/if}
    </div>

    <!-- Desktop: ImageDetail sidebar -->
    {#if showInfo && currentImage}
      <div class="hidden md:block w-80 shrink-0 border-l border-zinc-800">
        <ImageDetail
          filename={currentImage.filename || ""}
          fileSize={currentImage.fileSize ?? null}
          width={currentImage.width ?? null}
          height={currentImage.height ?? null}
          fileFormat={currentImage.fileFormat ?? null}
          rating={currentImage.rating ?? null}
          colorLabel={currentImage.colorLabel ?? null}
          flag={currentImage.flag ?? null}
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
          {onrate}
          {oncolor}
          {onflag}
          ondownload={ondownload ? () => handleDownload() : undefined}
          {ondelete}
          oncopylink={showCopyLink ? () => handleCopyLink() : undefined}
        />
      </div>
    {/if}
  </div>

  <!-- Mobile: ImageDetail -->
  {#if showInfo && currentImage}
    <div class="md:hidden">
      <ImageDetail
        filename={currentImage.filename || ""}
        fileSize={currentImage.fileSize ?? null}
        width={currentImage.width ?? null}
        height={currentImage.height ?? null}
        fileFormat={currentImage.fileFormat ?? null}
        rating={currentImage.rating ?? null}
        colorLabel={currentImage.colorLabel ?? null}
        flag={currentImage.flag ?? null}
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
        {onrate}
        {oncolor}
        {onflag}
        ondownload={ondownload ? () => handleDownload() : undefined}
        {ondelete}
        oncopylink={showCopyLink ? () => handleCopyLink() : undefined}
      />
    </div>
  {/if}

  <!-- Filmstrip (desktop only) -->
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
  {/if}
</div>
