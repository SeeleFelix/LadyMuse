<script lang="ts">
  import ImageDetail from "./ImageDetail.svelte";
  import Panzoom from "@panzoom/panzoom";

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
  let copied = $state(false);

  let imageEl = $state<HTMLImageElement>();
  let pz = $state<ReturnType<typeof Panzoom>>();
  let didDrag = false;
  let pointerStartX = 0;

  import { onMount } from "svelte";

  onMount(() => {
    const el = imageEl;
    if (!el) return;
    const instance = Panzoom(el, {
      maxScale: 10,
      minScale: 0.1,
      handleStartEvent: () => {},
    });
    pz = instance;
    const parent = el.parentElement;
    if (parent) parent.addEventListener("wheel", instance.zoomWithWheel);
    instance.reset();
    scale = 1;

    const timer = setInterval(() => {
      const s = instance.getScale();
      if (s !== scale) scale = s;
    }, 100);

    return () => {
      clearInterval(timer);
      instance.destroy();
    };
  });

  let currentImage = $derived(images[currentIndex]);

  function resetZoom() {
    pz?.reset();
    scale = 1;
    didDrag = false;
  }

  function getImageUrl(relativePath: string, modifiedAt?: string): string {
    const base = `/${imageUrlBase.replace(/^\/+/, "")}/${encodeURIComponent(relativePath)}`;
    return modifiedAt ? `${base}?t=${new Date(modifiedAt).getTime()}` : base;
  }

  function goNext() {
    if (currentIndex < images.length - 1) {
      resetZoom();
      onnavigate?.(currentIndex + 1);
    }
  }

  function goPrev() {
    if (currentIndex > 0) {
      resetZoom();
      onnavigate?.(currentIndex - 1);
    }
  }

  function handlePtrDown(e: PointerEvent) {
    if (!showZoom) return;
    pointerStartX = e.clientX;
    didDrag = false;
  }

  function handlePtrMove(e: PointerEvent) {
    if (!showZoom) return;
    if (Math.abs(e.clientX - pointerStartX) > 3) didDrag = true;
  }

  function handlePtrUp(e: PointerEvent) {
    if (!showZoom) return;
    if (pz && pz.getScale() <= 1 && didDrag) {
      const dx = e.clientX - pointerStartX;
      if (dx < -50) goNext();
      else if (dx > 50) goPrev();
    }
  }

  function toggleZoom(e: MouseEvent) {
    if (!showZoom || !pz) return;
    if (e.detail === 0) return;
    if (didDrag) {
      didDrag = false;
      return;
    }
    const s = pz.getScale();
    if (s > 1) {
      pz.reset();
      scale = 1;
    } else {
      const el = e.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();
      pz.zoom(3, {
        animate: true,
        focal: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      });
      scale = 3;
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
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 bg-black/95 flex flex-col"
  style="touch-action: none;"
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
          onclick={resetZoom}
          class="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-zinc-800"
          >适应</button
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
          bind:this={imageEl}
          src={getImageUrl(currentImage.relativePath, currentImage.modifiedAt)}
          alt=""
          onpointerdown={handlePtrDown}
          onpointermove={handlePtrMove}
          onpointerup={handlePtrUp}
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
          draggable="false"
        />
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
            resetZoom();
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
