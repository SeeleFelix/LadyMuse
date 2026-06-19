<script lang="ts">
  import { onMount } from "svelte";
  import PasswordGate from "$lib/components/share/PasswordGate.svelte";
  import ThumbnailCard from "$lib/components/gallery/ThumbnailCard.svelte";
  import Lightbox from "$lib/components/gallery/Lightbox.svelte";
  import { downloadImage } from "$lib/utils/download-image";
  import type { ImageResult } from "$lib/stores/gallery-store.svelte";

  let { data } = $props();

  let images = $state<ImageResult[]>(data.images || []);
  let nextCursor = $state<string | null>(data.nextCursor || null);
  let hasMore = $state<boolean>(data.hasMore || false);
  let loading = $state(false);
  let loaded = $state(false);

  let lightboxOpen = $state(false);
  let lightboxIndex = $state(0);

  let sentinelEl = $state<HTMLDivElement>();
  let observer = $state<IntersectionObserver>();

  let totalCount = $derived(images.length);

  function syncLightboxUrl(index: number | null, replace: boolean) {
    const url = new URL(window.location.href);
    if (index !== null) {
      url.searchParams.set("img", String(index));
    } else {
      url.searchParams.delete("img");
    }
    if (replace) {
      history.replaceState(history.state, "", url);
    } else {
      history.pushState(history.state, "", url);
    }
  }

  function openLightbox(index: number) {
    lightboxIndex = index;
    lightboxOpen = true;
    syncLightboxUrl(index, false);
  }

  function closeLightbox() {
    lightboxOpen = false;
    history.back();
  }

  function handleLightboxNavigate(index: number) {
    lightboxIndex = index;
    syncLightboxUrl(index, true);
  }

  function handleCardClick(path: string) {
    const idx = images.findIndex((img) => img.relativePath === path);
    if (idx !== -1) openLightbox(idx);
  }

  async function handleDownload(imageUrl: string, filename: string) {
    await downloadImage(imageUrl, filename);
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

  function handlePopState() {
    const params = new URLSearchParams(window.location.search);
    const imgParam = params.get("img");
    if (imgParam) {
      const idx = parseInt(imgParam, 10);
      if (!isNaN(idx) && idx >= 0 && idx < images.length) {
        lightboxIndex = idx;
        lightboxOpen = true;
      }
    } else {
      lightboxOpen = false;
    }
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

    window.addEventListener("popstate", handlePopState);

    // Check if URL has img param on initial load
    const params = new URLSearchParams(window.location.search);
    if (params.get("img")) handlePopState();

    return () => {
      observer?.disconnect();
      window.removeEventListener("popstate", handlePopState);
    };
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
        <div class="flex items-center gap-3">
          <h1 class="text-lg font-semibold text-zinc-100">分享图库</h1>
          <span class="text-sm text-zinc-500">{totalCount} 张图片</span>
        </div>
        <button
          onclick={clearAuth}
          class="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
        >
          退出登录
        </button>
      </div>
    </div>

    <!-- Grid -->
    <div class="px-2 py-2">
      <div
        class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 md:gap-3"
      >
        {#each images as image}
          <ThumbnailCard
            {image}
            thumbUrl={`/api/share/thumbnails/${encodeURIComponent(image.relativePath)}`}
            onselect={(path: string) => handleCardClick(path)}
            ondblclick={() => handleCardClick(image.relativePath)}
            oncontextmenu={() => {}}
            ondownload={(path: string) => {
              const filename = path.split("/").pop() || "image";
              downloadImage(
                `/api/share/images/${encodeURIComponent(path)}`,
                filename,
              );
            }}
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
    <Lightbox
      images={images.map((img) => ({
        relativePath: img.relativePath,
        filename: img.relativePath.split("/").pop() || img.relativePath,
        modifiedAt: img.fileModifiedAt ?? undefined,
        width: img.width,
        height: img.height,
        fileSize: img.fileSize,
        fileFormat: img.fileFormat,
        rating: img.rating,
        extractedModels: img.extractedModels,
        extractedLoras: img.extractedLoras,
        extractedSamplers: img.extractedSamplers,
        extractedSchedulers: img.extractedSchedulers,
        steps: img.steps,
        cfgScale: img.cfgScale,
        seed: img.seed,
        positivePrompt: img.positivePrompt,
        negativePrompt: img.negativePrompt,
      }))}
      currentIndex={lightboxIndex}
      showZoom={true}
      showCopyLink={false}
      showFilmstrip={false}
      showInfo={true}
      imageUrlBase="/api/share/images"
      onclose={closeLightbox}
      onnavigate={handleLightboxNavigate}
      ondownload={handleDownload}
    />
  {/if}
{/if}
