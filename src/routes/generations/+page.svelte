<script lang="ts">
  import { onMount } from "svelte";
  import { createGalleryStore } from "$lib/stores/gallery-store.svelte";
  import { galleryAPI } from "$lib/services/gallery-api";
  import { createSSEClient } from "$lib/services/sse-client";
  import LibraryView from "$lib/components/gallery/LibraryView.svelte";
  import CompareView from "$lib/components/gallery/CompareView.svelte";
  import KeyboardShortcuts from "$lib/components/gallery/KeyboardShortcuts.svelte";
  import BatchActionsBar from "$lib/components/gallery/BatchActionsBar.svelte";
  import Toast from "$lib/components/gallery/Toast.svelte";
  import Lightbox from "$lib/components/gallery/Lightbox.svelte";
  import ContextMenu from "$lib/components/gallery/ContextMenu.svelte";
  import MobileActionSheet from "$lib/components/gallery/MobileActionSheet.svelte";
  import ConfirmDialog from "$lib/components/gallery/ConfirmDialog.svelte";
  import CollectionPanel from "$lib/components/gallery/CollectionPanel.svelte";
  import DetailPanel from "$lib/components/gallery/DetailPanel.svelte";
  import { downloadImage } from "$lib/utils/download-image";
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
  const isTouchDevice =
    typeof window !== "undefined" && "ontouchstart" in window;
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

  // Mobile action sheet state
  let mobileSheetVisible = $state(false);
  let mobileSheetImage = $state<ImageResult | null>(null);

  // Mobile collection drawer state
  let collectionDrawerMobileOpen = $state(false);

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

  function getImageUrl(image: ImageResult): string {
    return `/api/comfyui/images/${encodeURIComponent(image.relativePath)}`;
  }

  function getFilename(image: ImageResult): string {
    return image.relativePath.split("/").pop() || image.relativePath;
  }

  // Download handlers
  async function handleDownload(path: string) {
    const image = store.images.find((img) => img.relativePath === path);
    if (!image || image.isMissing) return;
    try {
      await downloadImage(getImageUrl(image), getFilename(image));
    } catch {
      showToast("下载失败", "error");
    }
  }

  async function handleLightboxDownload(imageUrl: string, filename: string) {
    try {
      await downloadImage(imageUrl, filename);
    } catch {
      showToast("下载失败", "error");
    }
  }

  function handleLightboxRate(rating: number) {
    const img = store.images[lightboxIndex];
    if (img) store.updateAttributes(img.relativePath, { rating });
  }

  function handleLightboxColor(color: string | null) {
    const img = store.images[lightboxIndex];
    if (img) store.updateAttributes(img.relativePath, { colorLabel: color });
  }

  function handleLightboxFlag(flag: string | null) {
    const img = store.images[lightboxIndex];
    if (img) store.updateAttributes(img.relativePath, { flag });
  }

  function handleLightboxDelete() {
    const img = store.images[lightboxIndex];
    if (img) {
      deleteConfirm = {
        paths: [img.relativePath],
        message: `确定要删除 "${img.relativePath.split("/").pop()}" 吗？`,
      };
    }
  }

  // Long-press handler → opens Lightbox for single image, action sheet for multi-select
  function handleLongPress(path: string) {
    if (store.selectedPaths.size > 1 && store.selectedPaths.has(path)) {
      mobileSheetImage = null;
      mobileSheetVisible = true;
    }
  }

  function openLightboxForImage(img: ImageResult) {
    const idx = store.images.findIndex(
      (i) => i.relativePath === img.relativePath,
    );
    if (idx >= 0) {
      lightboxIndex = idx;
      lightboxOpen = true;
    }
  }

  // Get lightbox images from store
  let lightboxImages = $derived(
    store.images.map((img) => ({
      relativePath: img.relativePath,
      filename: img.relativePath.split("/").pop() || img.relativePath,
      modifiedAt: img.fileModifiedAt ?? undefined,
      width: img.width,
      height: img.height,
      fileSize: img.fileSize,
      fileFormat: img.fileFormat,
      rating: img.rating,
      colorLabel: img.colorLabel,
      flag: img.flag,
      extractedModels: img.extractedModels,
      extractedLoras: img.extractedLoras,
      extractedSamplers: img.extractedSamplers,
      extractedSchedulers: img.extractedSchedulers,
      steps: img.steps,
      cfgScale: img.cfgScale,
      seed: img.seed,
      positivePrompt: img.positivePrompt,
      negativePrompt: img.negativePrompt,
    })),
  );

  // Get context menu image from store
  let contextMenuImageResult = $derived(
    contextMenuImage
      ? (store.images.find(
          (img) => img.relativePath === contextMenuImage!.relativePath,
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
    const res = await fetch("/api/comfyui/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relative_paths: deleteConfirm.paths }),
    });

    if (res.status === 409) {
      const body = await res.json();
      const count = body.protected?.length ?? 0;
      const allNames = (body.protected ?? [])
        .map((p: { relativePath: string }) => p.relativePath.split("/").pop())
        .filter(Boolean);
      const names =
        allNames.length > 3
          ? `${allNames.slice(0, 3).join(", ")} 等 ${allNames.length} 张`
          : allNames.join(", ");
      showToast(
        `${count} 张图片受保护（pick/评分）未删除：${names}。请先取消标记。`,
        "error",
      );
      deleteConfirm = null;
      return;
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      const trashed = errBody?.trashed ?? 0;
      if (trashed > 0) {
        store.deselectAll();
        store.refresh();
        store.loadTrashCount();
        showToast(`${trashed} 张已移入回收站，其余删除失败`, "error");
      } else {
        showToast("删除失败", "error");
      }
      deleteConfirm = null;
      return;
    }

    const body = await res.json();
    showToast(`已移入回收站 ${body.trashed} 张图片`, "success");
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

  // Trash actions: restore / purge a single item, or empty the whole bin.
  async function handleTrashAction(
    action: "restore" | "purge" | "empty",
    id?: number,
  ) {
    const url =
      action === "empty"
        ? "/api/comfyui/trash/empty"
        : action === "restore"
          ? "/api/comfyui/trash/restore"
          : "/api/comfyui/trash/purge";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "empty" ? undefined : JSON.stringify({ id }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        showToast(errBody?.error ?? "操作失败", "error");
        if (store.trashView) {
          store.loadTrashPage(store.trashPagination.page);
        }
        return;
      }

      const body = await res.json();
      if (action === "restore") {
        if (body.renamed) {
          showToast(
            `已恢复为 ${body.restoredPath.split("/").pop()}（原路径被占用）`,
            "info",
          );
        } else {
          showToast("已恢复", "success");
        }
      } else if (action === "purge") {
        showToast("已彻底删除", "success");
      } else {
        showToast(`已清空 ${body.purged} 项`, "success");
      }
    } catch {
      showToast("网络错误，请重试", "error");
    }
  }

  // Initialize
  onMount(() => {
    store.refresh();
    loadCollections();
    loadAllTags();
    store.loadTrashCount();

    const { disconnect } = createSSEClient((event) =>
      store.handleSSEEvent(event),
    );
    return () => disconnect();
  });
</script>

<svelte:window />

<div class="flex h-full bg-zinc-950 text-zinc-100">
  <!-- Left: Collection panel (desktop: always visible, mobile: drawer) -->
  <div class="hidden md:block shrink-0">
    <CollectionPanel
      {collections}
      activeCollectionId={store.filters.collection?.collectionId ?? null}
      onselect={handleSelectCollection}
      oncreate={handleCreateCollection}
      ondelete={handleDeleteCollection}
    />
  </div>

  <!-- Mobile collection drawer overlay -->
  {#if collectionDrawerMobileOpen}
    <button
      class="fixed inset-0 z-40 bg-black/60 md:hidden"
      onclick={() => (collectionDrawerMobileOpen = false)}
      aria-label="关闭收藏集"
    ></button>
  {/if}

  <!-- Mobile collection drawer panel -->
  <div
    class="fixed left-0 top-0 z-50 h-full w-56 md:hidden transition-transform duration-200 {collectionDrawerMobileOpen
      ? 'translate-x-0'
      : '-translate-x-full'}"
  >
    <CollectionPanel
      {collections}
      activeCollectionId={store.filters.collection?.collectionId ?? null}
      onselect={(id) => {
        handleSelectCollection(id);
        collectionDrawerMobileOpen = false;
      }}
      oncreate={(name) => {
        handleCreateCollection(name);
      }}
      ondelete={(id) => {
        handleDeleteCollection(id);
      }}
    />
  </div>

  <!-- Main content area -->
  <div class="flex-1 flex flex-col overflow-hidden">
    {#if store.viewMode === "library"}
      <LibraryView
        {store}
        {allTags}
        oncontextmenu={handleContextMenu}
        ontrashaction={handleTrashAction}
        onlongpress={handleLongPress}
        ondownload={handleDownload}
        onopencollections={() => (collectionDrawerMobileOpen = true)}
        onselect={(path) => {
          if (isTouchDevice) {
            const img = store.images.find((i) => i.relativePath === path);
            if (img) openLightboxForImage(img);
          }
        }}
        ondblclick={(path) => {
          if (!isTouchDevice) {
            const img = store.images.find((i) => i.relativePath === path);
            if (img) openLightboxForImage(img);
          }
        }}
      />
    {:else if store.viewMode === "compare"}
      <CompareView {store} {allTags} />
    {/if}
  </div>

  <!-- Right detail panel (desktop only, hidden on mobile) -->
  <div class="hidden md:block">
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
        ondelete={() => {
          if (store.activeImage) {
            deleteConfirm = {
              paths: [store.activeImage.relativePath],
              message: `确定要删除 "${store.activeImage.relativePath.split("/").pop()}" 吗？`,
            };
          }
        }}
      />
    {/if}
  </div>
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
    showInfo={true}
    showActions={true}
    onclose={() => (lightboxOpen = false)}
    onnavigate={handleLightboxNavigate}
    oncontextmenu={handleLightboxContextmenu}
    ondownload={handleLightboxDownload}
    onrate={handleLightboxRate}
    oncolor={handleLightboxColor}
    onflag={handleLightboxFlag}
    ondelete={handleLightboxDelete}
  />
{/if}

<!-- Context Menu (desktop) -->
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

<!-- Mobile Action Sheet -->
<MobileActionSheet
  visible={mobileSheetVisible}
  onclose={() => (mobileSheetVisible = false)}
>
  {#if !mobileSheetImage}
    <!-- Multi-select actions -->
    <div class="px-1 py-3 text-sm text-zinc-500 border-b border-zinc-700/50">
      {store.selectedPaths.size} 张已选
    </div>

    <!-- Rate batch -->
    <div
      class="flex items-center gap-3 w-full px-1 py-3 text-sm text-zinc-200 border-b border-zinc-700/50"
    >
      <span class="text-zinc-500 text-xs w-5 text-center">★</span>
      <div class="flex gap-1">
        {#each [1, 2, 3, 4, 5] as r}
          <button
            onclick={() => {
              for (const path of store.selectedPaths)
                store.updateAttributes(path, { rating: r });
              mobileSheetVisible = false;
            }}
            class="text-lg text-amber-400">★</button
          >
        {/each}
      </div>
    </div>

    <!-- Batch delete -->
    <button
      onclick={() => {
        mobileSheetVisible = false;
        deleteConfirm = {
          paths: [...store.selectedPaths],
          message: `确定要删除 ${store.selectedPaths.size} 张图片？`,
        };
      }}
      class="flex items-center gap-3 w-full px-1 py-3 text-sm text-red-400"
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
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
      删除 ({store.selectedPaths.size})
    </button>
  {/if}
</MobileActionSheet>

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
