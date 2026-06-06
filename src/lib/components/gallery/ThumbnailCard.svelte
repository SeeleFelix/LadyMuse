<script lang="ts">
  import type { ImageResult } from "$lib/stores/gallery-store.svelte";

  let {
    image,
    selected = false,
    active = false,
    onselect,
    ondblclick,
    oncontextmenu,
  }: {
    image: ImageResult;
    selected?: boolean;
    active?: boolean;
    onselect: (path: string, e: MouseEvent) => void;
    ondblclick: () => void;
    oncontextmenu: (path: string, e: MouseEvent) => void;
  } = $props();

  const colorClassMap: Record<string, string> = {
    red: "bg-red-500",
    yellow: "bg-yellow-500",
    green: "bg-green-500",
    blue: "bg-blue-500",
    purple: "bg-purple-500",
  };

  function getImageUrl(): string {
    return `/api/comfyui/images/${encodeURIComponent(image.relativePath)}`;
  }

  function getFilename(): string {
    return image.relativePath.split("/").pop() || image.relativePath;
  }
</script>

<button
  onclick={(e) => onselect(image.relativePath, e)}
  {ondblclick}
  oncontextmenu={(e) => oncontextmenu(image.relativePath, e)}
  tabindex="0"
  class="group relative rounded-lg border {selected
    ? 'border-violet-500 ring-1 ring-violet-500/30'
    : active
      ? 'border-violet-500/50'
      : 'border-zinc-800'} bg-zinc-900 overflow-hidden hover:border-zinc-700 transition-colors text-left focus:outline-none focus:ring-1 focus:ring-violet-500/50"
>
  <div
    class="aspect-square bg-zinc-800 flex items-center justify-center relative"
  >
    {#if image.isMissing}
      <div
        class="absolute inset-0 bg-zinc-900/80 flex items-center justify-center"
      >
        <div class="text-center">
          <svg
            class="w-8 h-8 text-zinc-600 mx-auto mb-1"
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
          <p class="text-xs text-zinc-600">文件缺失</p>
        </div>
      </div>
    {:else}
      <img
        src={getImageUrl()}
        alt=""
        loading="lazy"
        class="w-full h-full object-contain"
      />
    {/if}

    {#if image.colorLabel}
      <div
        class="absolute top-1.5 right-1.5 w-3 h-3 rounded-full {colorClassMap[
          image.colorLabel
        ] || ''} ring-1 ring-black/30"
      ></div>
    {/if}

    {#if image.flag === "pick"}
      <div
        class="absolute bottom-1 right-1 text-green-400 text-xs font-bold bg-black/50 rounded px-1"
      >
        P
      </div>
    {:else if image.flag === "reject"}
      <div
        class="absolute bottom-1 right-1 text-red-400 text-xs font-bold bg-black/50 rounded px-1"
      >
        R
      </div>
    {/if}

    <div
      class="absolute top-1.5 left-1.5 w-4 h-4 rounded border {selected
        ? 'bg-violet-500 border-violet-500'
        : 'bg-black/40 border-zinc-500'} flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity {selected
        ? 'opacity-100'
        : ''}"
    >
      {#if selected}
        <svg
          class="w-3 h-3 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="3"
            d="M5 13l4 4L19 7"
          />
        </svg>
      {/if}
    </div>

    {#if (image.rating ?? 0) > 0}
      <div
        class="absolute bottom-1 left-1 flex items-center bg-black/50 rounded px-1"
      >
        {#each [1, 2, 3, 4, 5] as r}
          <span
            class="text-xs {r <= (image.rating ?? 0)
              ? 'text-amber-400'
              : 'text-zinc-700'}">★</span
          >
        {/each}
      </div>
    {/if}
  </div>

  <div class="p-2">
    <div class="mt-0.5 text-xs text-zinc-500 truncate" title={getFilename()}>
      {getFilename()}
    </div>
    <div class="text-xs text-zinc-600">
      {#if image.width && image.height}
        {image.width}×{image.height}
      {:else if image.fileSize}
        {(image.fileSize / 1024).toFixed(0)}KB
      {/if}
    </div>
  </div>
</button>
