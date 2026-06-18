<script lang="ts">
  import { onMount } from "svelte";
  import PasswordGate from "$lib/components/share/PasswordGate.svelte";
  import ShareCard from "$lib/components/share/ShareCard.svelte";
  import ShareLightbox from "$lib/components/share/ShareLightbox.svelte";

  interface ImageData {
    relativePath: string;
  }

  let { data } = $props();

  let images = $state<ImageData[]>(data.images || []);
  let nextCursor = $state<string | null>(data.nextCursor || null);
  let hasMore = $state<boolean>(data.hasMore || false);
  let loading = $state(false);
  let loaded = $state(false);

  let lightboxOpen = $state(false);
  let lightboxIndex = $state(0);

  let sentinelEl = $state<HTMLDivElement>();
  let observer = $state<IntersectionObserver>();

  function handleCardClick(index: number) {
    lightboxIndex = index;
    lightboxOpen = true;
  }

  function closeLightbox() {
    lightboxOpen = false;
  }

  async function loadMore() {
    if (loading || !hasMore || !nextCursor) return;
    loading = true;

    try {
      const params = new URLSearchParams({ cursor: nextCursor, limit: "50" });
      const res = await fetch(`/api/share/browse?${params}`);
      const result = await res.json();

      images = [...images, ...result.images];
      nextCursor = result.nextCursor;
      hasMore = result.hasMore;
    } finally {
      loading = false;
    }
  }

  function clearAuth() {
    document.cookie =
      "share_auth=; path=/share; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.reload();
  }

  onMount(() => {
    loaded = true;

    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore) {
          loadMore();
        }
      },
      { rootMargin: "200px" },
    );

    return () => observer?.disconnect();
  });

  $effect(() => {
    if (observer && sentinelEl) {
      observer.disconnect();
      observer.observe(sentinelEl);
    }
  });
</script>

{#if !data.authenticated && loaded}
  <PasswordGate />
{:else if data.authenticated}
  <div class="min-h-screen bg-zinc-950">
    <!-- Top bar -->
    <div
      class="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur border-b border-zinc-800"
    >
      <div class="flex items-center justify-between px-4 py-3 max-w-none">
        <h1 class="text-lg font-semibold text-zinc-100">分享图库</h1>
        <button
          onclick={clearAuth}
          class="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
        >
          退出
        </button>
      </div>
    </div>

    <!-- Grid -->
    <div class="px-2 py-2">
      <div
        class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 md:gap-3"
      >
        {#each images as image, i}
          <ShareCard
            relativePath={image.relativePath}
            index={i}
            onclick={handleCardClick}
          />
        {/each}
      </div>

      <!-- Sentinel for infinite scroll -->
      {#if hasMore}
        <div
          bind:this={sentinelEl}
          class="h-20 flex items-center justify-center"
        >
          {#if loading}
            <div class="text-zinc-500 text-sm">加载中...</div>
          {/if}
        </div>
      {/if}

      {#if !hasMore && images.length > 0}
        <div
          class="h-20 flex items-center justify-center text-zinc-600 text-sm"
        >
          已加载全部图片
        </div>
      {/if}

      {#if images.length === 0}
        <div class="h-60 flex items-center justify-center text-zinc-500">
          暂无分享内容
        </div>
      {/if}
    </div>
  </div>

  <!-- Lightbox -->
  {#if lightboxOpen}
    <ShareLightbox
      {images}
      currentIndex={lightboxIndex}
      onclose={closeLightbox}
      onprev={(i: number) => (lightboxIndex = i)}
      onnext={(i: number) => (lightboxIndex = i)}
    />
  {/if}
{/if}
