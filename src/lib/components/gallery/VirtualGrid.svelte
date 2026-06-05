<script lang="ts">
  import { onMount } from "svelte";
  import ThumbnailCard from "./ThumbnailCard.svelte";
  import type { ImageResult } from "$lib/stores/gallery-store.svelte";

  let {
    images = [],
    selectedPaths = new Set(),
    activePath = null,
    onselect,
    ondblclick,
    oncontextmenu,
    onloadmore,
    hasMore = false,
    loadingMore = false,
  }: {
    images: ImageResult[];
    selectedPaths: Set<string>;
    activePath: string | null;
    onselect: (path: string, e: MouseEvent) => void;
    ondblclick: (path: string) => void;
    oncontextmenu: (path: string, e: MouseEvent) => void;
    onloadmore: () => void;
    hasMore?: boolean;
    loadingMore?: boolean;
  } = $props();

  let sentinelEl: HTMLDivElement | undefined;
  let observer: IntersectionObserver | null = null;

  onMount(() => {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          onloadmore();
        }
      },
      { rootMargin: "200px", threshold: 0 },
    );

    if (sentinelEl) {
      observer.observe(sentinelEl);
    }

    return () => observer?.disconnect();
  });

  // Re-trigger observer after loading completes (handles edge case where
  // sentinel stays visible after new images are appended)
  $effect(() => {
    if (!loadingMore && hasMore && observer && sentinelEl) {
      observer.unobserve(sentinelEl);
      requestAnimationFrame(() => {
        if (sentinelEl) observer?.observe(sentinelEl);
      });
    }
  });
</script>

<div
  class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3"
>
  {#each images as image (image.relativePath)}
    <ThumbnailCard
      {image}
      selected={selectedPaths.has(image.relativePath)}
      active={activePath === image.relativePath}
      {onselect}
      ondblclick={() => ondblclick(image.relativePath)}
      {oncontextmenu}
    />
  {/each}
</div>

<!-- Infinite scroll sentinel -->
<div bind:this={sentinelEl} class="py-4 flex justify-center">
  {#if loadingMore}
    <p class="text-zinc-500 text-sm">加载更多...</p>
  {:else if !hasMore}
    <p class="text-zinc-600 text-xs">已加载全部图片</p>
  {:else}
    <p class="text-zinc-600 text-xs"></p>
  {/if}
</div>
