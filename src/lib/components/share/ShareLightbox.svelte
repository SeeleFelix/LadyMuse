<script lang="ts">
  interface Image {
    relativePath: string;
  }

  interface Props {
    images: Image[];
    currentIndex: number;
    onclose: () => void;
    onprev: (index: number) => void;
    onnext: (index: number) => void;
  }

  let { images, currentIndex, onclose, onprev, onnext }: Props = $props();

  function getImageUrl(relativePath: string): string {
    return `/api/comfyui/images/${encodeURIComponent(relativePath)}`;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onclose();
    } else if (e.key === "ArrowLeft" && currentIndex > 0) {
      onprev(currentIndex - 1);
    } else if (e.key === "ArrowRight" && currentIndex < images.length - 1) {
      onnext(currentIndex + 1);
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
  onclick={onclose}
  onkeydown={() => {}}
>
  <!-- Close button -->
  <button
    onclick={onclose}
    class="absolute top-4 right-4 z-10 p-2 rounded-full bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="w-6 h-6"
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

  <!-- Counter -->
  <div class="absolute top-4 left-4 z-10 text-zinc-400 text-sm">
    {currentIndex + 1} / {images.length}
  </div>

  <!-- Prev button -->
  {#if currentIndex > 0}
    <button
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
        onprev(currentIndex - 1);
      }}
      class="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
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

  <!-- Next button -->
  {#if currentIndex < images.length - 1}
    <button
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
        onnext(currentIndex + 1);
      }}
      class="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
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

  <!-- Image -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <img
    src={getImageUrl(images[currentIndex].relativePath)}
    alt=""
    class="max-w-full max-h-full object-contain p-4"
    onclick={(e: MouseEvent) => e.stopPropagation()}
    onkeydown={() => {}}
  />
</div>
