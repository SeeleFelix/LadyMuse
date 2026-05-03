<script lang="ts">
  let {
    images = [],
    onclose,
  }: {
    images: { relativePath: string; filename: string; modifiedAt?: string }[];
    onclose: () => void;
  } = $props();

  let scale = $state(1);
  let translateX = $state(0);
  let translateY = $state(0);
  let isDragging = $state(false);
  let didDrag = $state(false);
  let dragStart = { x: 0, y: 0 };
  let mainEl: HTMLDivElement | undefined = $state();

  const MIN_SCALE = 0.1;
  const MAX_SCALE = 10;

  function resetTransform() {
    scale = 1;
    translateX = 0;
    translateY = 0;
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    e.stopPropagation();
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

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onclose();
    else if (e.key === "+" || e.key === "=")
      scale = Math.min(MAX_SCALE, scale * 1.2);
    else if (e.key === "-") scale = Math.max(MIN_SCALE, scale / 1.2);
    else if (e.key === "0") resetTransform();
  }

  function getImageUrl(relativePath: string, modifiedAt?: string): string {
    const base = `/api/comfyui/images/${encodeURIComponent(relativePath)}`;
    return modifiedAt ? `${base}?t=${new Date(modifiedAt).getTime()}` : base;
  }

  $effect(() => {
    resetTransform();
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 bg-black/95 flex flex-col select-none"
  bind:this={mainEl}
  onwheel={handleWheel}
  onmousedown={handleMouseDown}
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
  onmouseleave={handleMouseUp}
  role="dialog"
>
  <!-- Toolbar -->
  <div class="flex items-center justify-between px-4 py-2 bg-black/50 shrink-0">
    <div class="text-sm text-zinc-300">对比视图 ({images.length} 张)</div>
    <div class="flex items-center gap-3">
      <span class="text-xs text-zinc-500">{Math.round(scale * 100)}%</span>
      <button
        onclick={() => (scale = Math.max(MIN_SCALE, scale / 1.5))}
        class="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-zinc-800"
        >-</button
      >
      <button
        onclick={resetTransform}
        class="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-zinc-800"
        >适应</button
      >
      <button
        onclick={() => (scale = Math.min(MAX_SCALE, scale * 1.5))}
        class="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-zinc-800"
        >+</button
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

  <!-- Images: equal containers, images fill with object-cover so same visual size -->
  <div class="flex-1 flex min-h-0">
    {#each images as img, i}
      <div
        class="flex-1 overflow-hidden border-r border-zinc-800 last:border-r-0 relative flex items-center justify-center"
      >
        <div
          class="absolute top-2 left-2 text-xs text-zinc-500 bg-black/60 px-2 py-0.5 rounded z-10"
        >
          {img.filename}
        </div>
        <img
          src={getImageUrl(img.relativePath, img.modifiedAt)}
          alt=""
          class="w-full h-full object-cover select-none"
          style="transform: scale({scale}) translate({translateX /
            scale}px, {translateY / scale}px); transition: {isDragging
            ? 'none'
            : 'transform 0.2s ease'};"
          draggable="false"
        />
      </div>
    {/each}
  </div>
</div>
