<script lang="ts">
  let {
    images = [],
    currentIndex = 0,
    onclose,
    onnavigate,
  }: {
    images: { relativePath: string; filename: string }[];
    currentIndex: number;
    onclose: () => void;
    onnavigate?: (index: number) => void;
  } = $props();

  let scale = $state(1);
  let translateX = $state(0);
  let translateY = $state(0);
  let isDragging = $state(false);
  let didDrag = $state(false);
  let dragStart = { x: 0, y: 0 };
  let containerEl: HTMLDivElement | undefined = $state();

  const FIT_SCALE = 1;
  const MIN_SCALE = 0.1;
  const MAX_SCALE = 10;

  let currentImage = $derived(images[currentIndex]);

  function resetTransform() {
    scale = FIT_SCALE;
    translateX = 0;
    translateY = 0;
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale + delta * scale));
    if (scale <= 1) {
      translateX = 0;
      translateY = 0;
    }
  }

  function handleMouseDown(e: MouseEvent) {
    if (scale > 1) {
      isDragging = true;
      didDrag = false;
      dragStart = { x: e.clientX - translateX, y: e.clientY - translateY };
    }
  }

  function handleMouseMove(e: MouseEvent) {
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

  function toggleZoom() {
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

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onclose();
    else if (e.key === "ArrowRight") goNext();
    else if (e.key === "ArrowLeft") goPrev();
    else if (e.key === "+" || e.key === "=")
      scale = Math.min(MAX_SCALE, scale * 1.2);
    else if (e.key === "-") scale = Math.max(MIN_SCALE, scale / 1.2);
  }

  function getImageUrl(relativePath: string): string {
    return `/api/comfyui/images/${encodeURIComponent(relativePath)}`;
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
  role="dialog"
>
  <!-- Toolbar -->
  <div class="flex items-center justify-between px-4 py-2 bg-black/50">
    <div class="text-sm text-zinc-300 truncate max-w-md">
      {currentImage?.filename || ""}
    </div>
    <div class="flex items-center gap-3">
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
        class="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-zinc-800"
        >1:1</button
      >
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

  <!-- Image area -->
  <div
    class="flex-1 flex items-center justify-center overflow-hidden relative"
    bind:this={containerEl}
  >
    {#if currentImage}
      <!-- Navigation arrows -->
      {#if currentIndex > 0}
        <button
          onclick={goPrev}
          class="absolute left-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
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
          class="absolute right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
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
        src={getImageUrl(currentImage.relativePath)}
        alt=""
        onclick={toggleZoom}
        class="max-w-full max-h-full select-none {scale <= 1
          ? 'object-contain cursor-zoom-in'
          : 'cursor-zoom-out'}"
        style="transform: scale({scale}) translate({translateX /
          scale}px, {translateY / scale}px); transition: {isDragging
          ? 'none'
          : 'transform 0.2s ease'};"
        draggable="false"
      />
    {/if}
  </div>

  <!-- Filmstrip -->
  {#if images.length > 1}
    <div class="h-16 bg-black/50 flex items-center gap-1 px-4 overflow-x-auto">
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
            src={getImageUrl(img.relativePath)}
            alt=""
            class="w-full h-full object-cover"
            loading="lazy"
          />
        </button>
      {/each}
    </div>
  {/if}
</div>
