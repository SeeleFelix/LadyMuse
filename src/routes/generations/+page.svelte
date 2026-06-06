<script lang="ts">
  import { onMount } from "svelte";
  import { createGalleryStore } from "$lib/stores/gallery-store.svelte";
  import { galleryAPI } from "$lib/services/gallery-api";
  import { createSSEClient } from "$lib/services/sse-client";
  import LibraryView from "$lib/components/gallery/LibraryView.svelte";
  import InspectView from "$lib/components/gallery/InspectView.svelte";
  import CompareView from "$lib/components/gallery/CompareView.svelte";
  import KeyboardShortcuts from "$lib/components/gallery/KeyboardShortcuts.svelte";
  import BatchActionsBar from "$lib/components/gallery/BatchActionsBar.svelte";
  import Toast from "$lib/components/gallery/Toast.svelte";
  import Lightbox from "$lib/components/gallery/Lightbox.svelte";
  import ContextMenu from "$lib/components/gallery/ContextMenu.svelte";
  import ConfirmDialog from "$lib/components/gallery/ConfirmDialog.svelte";
  import CollectionPanel from "$lib/components/gallery/CollectionPanel.svelte";
  import DetailPanel from "$lib/components/gallery/DetailPanel.svelte";
  import type { ImageResult } from "$lib/stores/gallery-store.svelte";

  interface Collection {
    id: number;
    name: string;
    description: string | null;
    coverImagePath: string | null;
    isSmart: boolean;
    smartCriteria: string | null;
    imageCount: number;
  }

  interface Tag {
    id: number;
    name: string;
    slug: string;
  }

  // Store setup
  const store = createGalleryStore({
    query: (filters, sort, pagination) =>
      galleryAPI.query(filters, sort, pagination),
    updateAttributes: (path, updates) =>
      galleryAPI.updateAttributes(path, updates),
  });

  // Collections state
  let collections = $state<Collection[]>([]);
  let allTags = $state<Tag[]>([]);

  // Lightbox state
  let lightboxOpen = $state(false);
  let lightboxIndex = $state(0);

  // Context menu state
  let contextMenuVisible = $state(false);
  let contextMenuX = $state(0);
  let contextMenuY = $state(0);
  let contextMenuImage = $state<ImageResult | null>(null);

  // Delete confirmation state
  let deleteConfirm = $state<{
    paths: string[];
    message: string;
  } | null>(null);

  // Toast state
  let toasts = $state<
    { id: number; message: string; type: "info" | "success" | "error" }[]
  >([]);
  let toastCounter = 0;

  // Helper functions
  function showToast(
    message: string,
    type: "info" | "success" | "error" = "info",
  ) {
    const id = ++toastCounter;
    toasts = [...toasts, { id, message, type }];
  }

  function dismissToast(id: number) {
    toasts = toasts.filter((t) => t.id !== id);
  }

  // Get lightbox images from store
  let lightboxImages = $derived(
    store.images.map((img) => ({
      relativePath: img.relativePath,
      filename: img.relativePath.split("/").pop() || img.relativePath,
      modifiedAt: img.fileModifiedAt ?? undefined,
    })),
  );

  // Get context menu image from store
  let contextMenuImageResult = $derived(
    contextMenuImage
      ? (store.images.find(
          (img) => img.relativePath === contextMenuImage.relativePath,
        ) ?? null)
      : null,
  );

  // Collections management
  async function loadCollections() {
    try {
      const res = await fetch("/api/comfyui/collections");
      if (res.ok) collections = await res.json();
    } catch {
      /* ignore */
    }
  }

  async function loadAllTags() {
    try {
      const res = await fetch("/api/comfyui/tags");
      if (res.ok) allTags = await res.json();
    } catch {
      /* ignore */
    }
  }

  function handleSelectCollection(id: number | null) {
    store.setFilters({
      ...store.filters,
      collection: id !== null ? { collectionId: id } : undefined,
    });
    store.deselectAll();
  }

  async function handleCreateCollection(name: string) {
    const res = await fetch("/api/comfyui/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      showToast("收藏集已创建", "success");
      loadCollections();
    }
  }

  async function handleDeleteCollection(id: number) {
    await fetch(`/api/comfyui/collections/${id}`, { method: "DELETE" });
    if (store.filters.collection?.collectionId === id) {
      store.setFilters({ ...store.filters, collection: undefined });
    }
    loadCollections();
    showToast("收藏集已删除", "success");
  }

  async function addToCollection(collectionId: number) {
    const paths = [...store.selectedPaths];
    const res = await fetch(`/api/comfyui/collections/${collectionId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relative_paths: paths }),
    });
    if (res.ok) {
      showToast(`已添加 ${paths.length} 张图片到收藏集`, "success");
    }
  }

  // Context menu handlers
  function handleContextMenu(path: string, e: MouseEvent) {
    e.preventDefault();
    const img = store.images.find((i) => i.relativePath === path);
    if (img) {
      if (!store.selectedPaths.has(path)) {
        store.select(path, false, false);
      }
      contextMenuImage = img;
      contextMenuX = e.clientX;
      contextMenuY = e.clientY;
      contextMenuVisible = true;
    }
  }

  function copyPrompt() {
    if (!contextMenuImageResult?.positivePrompt) {
      showToast("该图片没有可复制的提示词", "info");
      return;
    }
    const text = contextMenuImageResult.positivePrompt;
    navigator.clipboard.writeText(text).then(
      () => showToast("提示词已复制", "success"),
      () => showToast("复制失败", "error"),
    );
    contextMenuVisible = false;
  }

  function copyImageUrl() {
    if (!contextMenuImageResult) return;
    const url = `${window.location.origin}/api/comfyui/images/${encodeURIComponent(contextMenuImageResult.relativePath)}`;
    navigator.clipboard.writeText(url).then(
      () => showToast("图片链接已复制", "success"),
      () => showToast("复制失败", "error"),
    );
    contextMenuVisible = false;
  }

  function contextMenuOpenLightbox() {
    if (!contextMenuImageResult) return;
    const idx = store.images.findIndex(
      (img) => img.relativePath === contextMenuImageResult!.relativePath,
    );
    if (idx >= 0) {
      lightboxIndex = idx;
      lightboxOpen = true;
    }
    contextMenuVisible = false;
  }

  function contextMenuRate(rating: number) {
    if (store.selectedPaths.size > 1) {
      for (const path of store.selectedPaths) {
        store.updateAttributes(path, { rating });
      }
      showToast(`已为 ${store.selectedPaths.size} 张图片设置评分`, "success");
    } else if (contextMenuImageResult) {
      store.updateAttributes(contextMenuImageResult.relativePath, { rating });
    }
    contextMenuVisible = false;
  }

  function contextMenuColor(color: string | null) {
    if (store.selectedPaths.size > 1) {
      for (const path of store.selectedPaths) {
        store.updateAttributes(path, { colorLabel: color });
      }
      showToast(`已为 ${store.selectedPaths.size} 张图片设置颜色`, "success");
    } else if (contextMenuImageResult) {
      store.updateAttributes(contextMenuImageResult.relativePath, {
        colorLabel: color,
      });
    }
    contextMenuVisible = false;
  }

  function contextMenuFlag(flag: string | null) {
    if (store.selectedPaths.size > 1) {
      for (const path of store.selectedPaths) {
        store.updateAttributes(path, { flag });
      }
      showToast(`已为 ${store.selectedPaths.size} 张图片设置标记`, "success");
    } else if (contextMenuImageResult) {
      store.updateAttributes(contextMenuImageResult.relativePath, { flag });
    }
    contextMenuVisible = false;
  }

  function contextMenuAddToCollection(collectionId: number) {
    addToCollection(collectionId);
    contextMenuVisible = false;
  }

  function contextMenuCompare() {
    if (store.selectedPaths.size >= 2 && store.selectedPaths.size <= 4) {
      store.setViewMode("compare");
    } else {
      showToast("请选择 2-4 张图片进行对比", "info");
    }
    contextMenuVisible = false;
  }

  function contextMenuDelete() {
    if (store.selectedPaths.size > 1) {
      deleteConfirm = {
        paths: [...store.selectedPaths],
        message: `确定要删除 ${store.selectedPaths.size} 张图片吗？`,
      };
    } else if (contextMenuImageResult) {
      deleteConfirm = {
        paths: [contextMenuImageResult.relativePath],
        message: `确定要删除 "${contextMenuImageResult.relativePath.split("/").pop()}" 吗？`,
      };
    }
    contextMenuVisible = false;
  }

  // Delete handlers
  async function confirmDelete() {
    if (!deleteConfirm) return;
    let deleted = 0;
    for (const path of deleteConfirm.paths) {
      const res = await fetch("/api/comfyui/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relative_path: path }),
      });
      if (res.ok) deleted++;
    }
    showToast(`已删除 ${deleted} 张图片`, "success");
    store.deselectAll();
    store.refresh();
    deleteConfirm = null;
  }

  // Lightbox handlers
  function handleLightboxNavigate(index: number) {
    lightboxIndex = index;
    if (store.images[index]) {
      store.select(store.images[index].relativePath, false, false);
    }
  }

  function handleLightboxContextmenu(e: MouseEvent) {
    if (store.images[lightboxIndex]) {
      contextMenuImage = store.images[lightboxIndex];
      contextMenuX = e.clientX;
      contextMenuY = e.clientY;
      contextMenuVisible = true;
    }
  }

  // Initialize
  onMount(() => {
    store.refresh();
    loadCollections();
    loadAllTags();

    const { disconnect } = createSSEClient((event) =>
      store.handleSSEEvent(event),
    );
    return () => disconnect();
  });
</script>

<svelte:window />

<div class="flex h-full bg-zinc-950 text-zinc-100">
  <!-- Left: Collection panel -->
  <CollectionPanel
    {collections}
    activeCollectionId={store.filters.collection?.collectionId ?? null}
    onselect={handleSelectCollection}
    oncreate={handleCreateCollection}
    ondelete={handleDeleteCollection}
  />

  <!-- Main content area -->
  <div class="flex-1 flex flex-col overflow-hidden">
    {#if store.viewMode === "library"}
      <LibraryView {store} {allTags} oncontextmenu={handleContextMenu} />
    {:else if store.viewMode === "inspect"}
      <InspectView {store} {allTags} />
    {:else if store.viewMode === "compare"}
      <CompareView {store} {allTags} />
    {/if}
  </div>

  <!-- Right detail panel (full height) -->
  {#if store.viewMode !== "compare"}
    <DetailPanel
      image={store.activeImage}
      {allTags}
      onrate={(r: number) =>
        store.activeImage &&
        store.updateAttributes(store.activeImage.relativePath, { rating: r })}
      oncolor={(c: string | null) =>
        store.activeImage &&
        store.updateAttributes(store.activeImage.relativePath, {
          colorLabel: c,
        })}
      onflag={(f: string | null) =>
        store.activeImage &&
        store.updateAttributes(store.activeImage.relativePath, { flag: f })}
      onaddtag={(_t: string) => {}}
      onremovetag={(_id: number) => {}}
      onclose={() => (store.activeImage = null)}
    />
  {/if}
</div>

<!-- Batch Actions Bar -->
<BatchActionsBar
  selectedCount={store.selectedCount}
  onRate={(rating) => {
    for (const path of store.selectedPaths) {
      store.updateAttributes(path, { rating });
    }
  }}
  onColor={(color) => {
    for (const path of store.selectedPaths) {
      store.updateAttributes(path, { colorLabel: color });
    }
  }}
  onFlag={(flag) => {
    for (const path of store.selectedPaths) {
      store.updateAttributes(path, { flag });
    }
  }}
  onDelete={async () => {
    const paths = [...store.selectedPaths];
    deleteConfirm = {
      paths,
      message: `确定要删除 ${paths.length} 张图片吗？`,
    };
  }}
  onDeselect={() => store.deselectAll()}
/>

<!-- Keyboard Shortcuts -->
<KeyboardShortcuts {store} />

<!-- Lightbox -->
{#if lightboxOpen}
  <Lightbox
    images={lightboxImages}
    currentIndex={lightboxIndex}
    contextMenuOpen={contextMenuVisible}
    onclose={() => (lightboxOpen = false)}
    onnavigate={handleLightboxNavigate}
    oncontextmenu={handleLightboxContextmenu}
  />
{/if}

<!-- Context Menu -->
{#if contextMenuVisible && contextMenuImageResult}
  <ContextMenu
    x={contextMenuX}
    y={contextMenuY}
    image={contextMenuImageResult}
    selectedCount={store.selectedCount}
    {collections}
    onclose={() => (contextMenuVisible = false)}
    onopenlightbox={contextMenuOpenLightbox}
    onrate={contextMenuRate}
    oncolor={contextMenuColor}
    onflag={contextMenuFlag}
    onaddtocollection={contextMenuAddToCollection}
    oncopyprompt={copyPrompt}
    oncopyimageurl={copyImageUrl}
    oncompare={contextMenuCompare}
    ondelete={contextMenuDelete}
  />
{/if}

<!-- Delete Confirmation -->
{#if deleteConfirm}
  <ConfirmDialog
    title="确认删除"
    message={deleteConfirm.message}
    onconfirm={confirmDelete}
    oncancel={() => (deleteConfirm = null)}
  />
{/if}

<!-- Toasts -->
{#each toasts as t (t.id)}
  <Toast
    message={t.message}
    type={t.type}
    ondismiss={() => dismissToast(t.id)}
  />
{/each}
