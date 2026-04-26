<script lang="ts">
  import { onMount } from "svelte";
  import GalleryDetail from "$lib/components/gallery/GalleryDetail.svelte";
  import Lightbox from "$lib/components/gallery/Lightbox.svelte";
  import CompareView from "$lib/components/gallery/CompareView.svelte";
  import ConfirmDialog from "$lib/components/gallery/ConfirmDialog.svelte";
  import Toast from "$lib/components/gallery/Toast.svelte";
  import CollectionPanel from "$lib/components/gallery/CollectionPanel.svelte";

  interface SamplerInfo {
    id: string;
    classType: string;
    seed: number | null;
    steps: number | null;
    cfg: number | null;
    samplerName: string | null;
    scheduler: string | null;
    denoise: number | null;
  }

  interface ComfyUIMetadata {
    positivePrompts: string[];
    negativePrompts: string[];
    models: string[];
    loras: string[];
    width: number | null;
    height: number | null;
    samplers: SamplerInfo[];
  }

  interface Attributes {
    rating: number;
    colorLabel: string | null;
    flag: string | null;
    notes: string | null;
    stackId: number | null;
  }

  interface Tag {
    id: number;
    name: string;
    slug: string;
  }

  interface BrowseImage {
    filename: string;
    relativePath: string;
    size: number;
    modifiedAt: string;
    width: number | null;
    height: number | null;
    metadata: ComfyUIMetadata | null;
    attributes?: Attributes | null;
    tags?: Tag[];
  }

  interface Collection {
    id: number;
    name: string;
    description: string | null;
    coverImagePath: string | null;
    isSmart: boolean;
    smartCriteria: string | null;
    imageCount: number;
  }

  type SortMode = "date-desc" | "date-asc" | "name";

  // State
  let loading = $state(false);
  let browseImages = $state<BrowseImage[]>([]);
  let browsePage = $state(1);
  let browseTotal = $state(0);
  let browseHasMore = $state(false);
  let browseSort = $state<SortMode>("date-desc");

  let selectedImage = $state<BrowseImage | null>(null);
  let selectedPaths = $state<Set<string>>(new Set());
  let lastClickedIndex = $state(-1);

  let collections = $state<Collection[]>([]);
  let activeCollectionId = $state<number | null>(null);
  let allTags = $state<Tag[]>([]);

  let lightboxOpen = $state(false);
  let lightboxIndex = $state(0);
  let compareOpen = $state(false);
  let compareImages = $state<{ relativePath: string; filename: string }[]>([]);
  let deleteConfirm = $state<{
    paths: string[];
    requireInput: string;
    message: string;
  } | null>(null);
  let toasts = $state<
    { id: number; message: string; type: "info" | "success" | "error" }[]
  >([]);
  let showAddToCollection = $state(false);
  let toastCounter = 0;

  const colorClassMap: Record<string, string> = {
    red: "bg-red-500",
    yellow: "bg-yellow-500",
    green: "bg-green-500",
    blue: "bg-blue-500",
    purple: "bg-purple-500",
  };

  let totalPages = $derived(Math.ceil(browseTotal / 24));

  function getImageUrl(relativePath: string): string {
    return `/api/comfyui/images/${encodeURIComponent(relativePath)}`;
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

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

  // Data loading
  async function loadBrowseImages() {
    loading = true;
    try {
      let url = `/api/comfyui/browse?page=${browsePage}&page_size=24&sort=${browseSort}`;
      if (activeCollectionId != null) {
        url += `&collection_id=${activeCollectionId}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        browseImages = data.images;
        browseTotal = data.total;
        browseHasMore = data.hasMore;
      } else {
        const err = await res.json();
        showToast(err.error || "加载失败", "error");
      }
    } catch (e: any) {
      showToast(`网络错误: ${e.message}`, "error");
    }
    loading = false;
  }

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

  // Attribute operations
  async function updateAttribute(
    relativePath: string,
    updates: Record<string, any>,
  ) {
    const res = await fetch("/api/comfyui/attributes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relative_path: relativePath, ...updates }),
    });
    if (res.ok) {
      const attr = await res.json();
      const img = browseImages.find((i) => i.relativePath === relativePath);
      if (img) {
        img.attributes = {
          rating: attr.rating,
          colorLabel: attr.colorLabel,
          flag: attr.flag,
          notes: attr.notes,
          stackId: attr.stackId,
        };
        browseImages = [...browseImages];
        if (selectedImage?.relativePath === relativePath) {
          selectedImage = { ...selectedImage, attributes: img.attributes };
        }
      }
      return attr;
    }
    return null;
  }

  async function handleRate(rating: number) {
    if (!selectedImage) return;
    await updateAttribute(selectedImage.relativePath, { rating });
  }

  async function handleColor(color: string | null) {
    if (!selectedImage) return;
    await updateAttribute(selectedImage.relativePath, { color_label: color });
  }

  async function handleFlag(flag: string | null) {
    if (!selectedImage) return;
    await updateAttribute(selectedImage.relativePath, { flag });
  }

  async function handleAddTag(name: string) {
    if (!selectedImage) return;
    const rp = selectedImage.relativePath;
    const res = await fetch("/api/comfyui/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relative_path: rp, tag_names: [name] }),
    });
    if (res.ok) {
      const newTags = await res.json();
      const img = browseImages.find((i) => i.relativePath === rp);
      if (img) {
        img.tags = [...(img.tags || []), ...newTags];
        browseImages = [...browseImages];
        if (selectedImage?.relativePath === rp)
          selectedImage = { ...selectedImage, tags: img.tags };
      }
      loadAllTags();
    }
  }

  async function handleRemoveTag(tagId: number) {
    if (!selectedImage) return;
    const rp = selectedImage.relativePath;
    const res = await fetch("/api/comfyui/tags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relative_path: rp, tag_ids: [tagId] }),
    });
    if (res.ok) {
      const img = browseImages.find((i) => i.relativePath === rp);
      if (img) {
        img.tags = (img.tags || []).filter((t) => t.id !== tagId);
        browseImages = [...browseImages];
        if (selectedImage?.relativePath === rp)
          selectedImage = { ...selectedImage, tags: img.tags };
      }
    }
  }

  // Selection
  function handleImageClick(img: BrowseImage, index: number, e: MouseEvent) {
    if (e.shiftKey && lastClickedIndex >= 0) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const newSet = new Set(selectedPaths);
      for (let i = start; i <= end; i++)
        newSet.add(browseImages[i].relativePath);
      selectedPaths = newSet;
    } else if (e.ctrlKey || e.metaKey) {
      const newSet = new Set(selectedPaths);
      if (newSet.has(img.relativePath)) newSet.delete(img.relativePath);
      else newSet.add(img.relativePath);
      selectedPaths = newSet;
      lastClickedIndex = index;
    } else {
      selectedPaths = new Set([img.relativePath]);
      selectedImage = img;
      lastClickedIndex = index;
    }
  }

  // Delete
  function startSingleDelete() {
    if (!selectedImage) return;
    deleteConfirm = {
      paths: [selectedImage.relativePath],
      requireInput: selectedImage.filename,
      message: `确定要删除 "${selectedImage.filename}" 吗？`,
    };
  }

  function startBulkDelete() {
    deleteConfirm = {
      paths: [...selectedPaths],
      requireInput: "DELETE",
      message: `确定要删除 ${selectedPaths.size} 张图片吗？此操作不可逆。`,
    };
  }

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
    const deletedPaths = deleteConfirm.paths;
    browseImages = browseImages.filter(
      (img) => !deletedPaths.includes(img.relativePath),
    );
    browseTotal -= deleted;
    const newSet = new Set(selectedPaths);
    for (const p of deletedPaths) newSet.delete(p);
    selectedPaths = newSet;
    if (selectedImage && deletedPaths.includes(selectedImage.relativePath))
      selectedImage = null;
    showToast(`已删除 ${deleted} 张图片`, "success");
    deleteConfirm = null;
  }

  // Compare
  function openCompare() {
    if (selectedPaths.size < 2 || selectedPaths.size > 4) {
      showToast("请选择 2-4 张图片进行对比", "info");
      return;
    }
    compareImages = browseImages
      .filter((img) => selectedPaths.has(img.relativePath))
      .map((img) => ({
        relativePath: img.relativePath,
        filename: img.filename,
      }));
    compareOpen = true;
  }

  // Collection callbacks
  function handleSelectCollection(id: number | null) {
    activeCollectionId = id;
    browsePage = 1;
    selectedImage = null;
    selectedPaths = new Set();
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
    if (activeCollectionId === id) {
      activeCollectionId = null;
      browsePage = 1;
    }
    loadCollections();
    showToast("收藏集已删除", "success");
  }

  async function addToCollection(collectionId: number) {
    const paths = [...selectedPaths];
    const res = await fetch(`/api/comfyui/collections/${collectionId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relative_paths: paths }),
    });
    if (res.ok) {
      showToast(`已添加 ${paths.length} 张图片到收藏集`, "success");
      showAddToCollection = false;
      loadCollections();
    }
  }

  // Bulk operations
  async function bulkRate(rating: number) {
    let count = 0;
    for (const path of selectedPaths) {
      const res = await updateAttribute(path, { rating });
      if (res) count++;
    }
    showToast(`已为 ${count} 张图片设置 ${rating} 星评分`, "success");
  }

  async function bulkColor(color: string) {
    let count = 0;
    for (const path of selectedPaths) {
      const res = await updateAttribute(path, { color_label: color });
      if (res) count++;
    }
    showToast(`已为 ${count} 张图片设置颜色标记`, "success");
  }

  async function bulkFlag(flag: string) {
    let count = 0;
    for (const path of selectedPaths) {
      const res = await updateAttribute(path, { flag });
      if (res) count++;
    }
    showToast(`已为 ${count} 张图片设置标记`, "success");
  }

  // Keyboard shortcuts
  function handleKeydown(e: KeyboardEvent) {
    if (lightboxOpen || compareOpen || deleteConfirm) return;
    if (e.key === "Escape") {
      selectedImage = null;
      selectedPaths = new Set();
    } else if (e.key === "Delete" && selectedPaths.size > 0) {
      if (selectedPaths.size === 1 && selectedImage) startSingleDelete();
      else startBulkDelete();
    } else if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      selectedPaths = new Set(browseImages.map((img) => img.relativePath));
    } else if (e.key === "ArrowRight" && selectedImage) {
      const idx = browseImages.findIndex(
        (img) => img.relativePath === selectedImage!.relativePath,
      );
      if (idx >= 0 && idx < browseImages.length - 1) {
        selectedImage = browseImages[idx + 1];
        selectedPaths = new Set([browseImages[idx + 1].relativePath]);
        lastClickedIndex = idx + 1;
      }
    } else if (e.key === "ArrowLeft" && selectedImage) {
      const idx = browseImages.findIndex(
        (img) => img.relativePath === selectedImage!.relativePath,
      );
      if (idx > 0) {
        selectedImage = browseImages[idx - 1];
        selectedPaths = new Set([browseImages[idx - 1].relativePath]);
        lastClickedIndex = idx - 1;
      }
    }
  }

  $effect(() => {
    loadBrowseImages();
  });

  onMount(() => {
    loadCollections();
    loadAllTags();
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-full">
  <!-- Left: Collection panel -->
  <CollectionPanel
    {collections}
    {activeCollectionId}
    onselect={handleSelectCollection}
    oncreate={handleCreateCollection}
    ondelete={handleDeleteCollection}
  />

  <!-- Center: grid -->
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="border-b border-zinc-800 px-4 py-2.5 flex items-center gap-3">
      <h2 class="text-sm font-medium text-zinc-300">
        {activeCollectionId
          ? collections.find((c) => c.id === activeCollectionId)?.name ||
            "收藏集"
          : "全部图片"}
        <span class="text-zinc-600 ml-1">{browseTotal}</span>
      </h2>

      <div class="ml-auto flex items-center gap-2">
        <select
          bind:value={browseSort}
          onchange={() => {
            browsePage = 1;
          }}
          class="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 focus:border-violet-500 focus:outline-none"
        >
          <option value="date-desc">最新优先</option>
          <option value="date-asc">最旧优先</option>
          <option value="name">文件名</option>
        </select>

        <span class="text-xs text-zinc-500">{browsePage}/{totalPages || 1}</span
        >
        <button
          onclick={() => (browsePage = Math.max(1, browsePage - 1))}
          disabled={browsePage <= 1}
          class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
          >←</button
        >
        <button
          onclick={() => {
            if (browseHasMore) browsePage++;
          }}
          disabled={!browseHasMore}
          class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
          >→</button
        >
      </div>
    </div>

    <!-- Bulk actions bar -->
    {#if selectedPaths.size > 1}
      <div
        class="px-4 py-2 bg-zinc-800/50 border-b border-zinc-700 flex items-center gap-2 flex-wrap"
      >
        <span class="text-xs text-zinc-400 mr-2"
          >已选 {selectedPaths.size} 张</span
        >
        <div class="flex items-center gap-1">
          {#each [1, 2, 3, 4, 5] as r}
            <button
              onclick={() => bulkRate(r)}
              class="text-sm text-zinc-500 hover:text-amber-400">★</button
            >
          {/each}
        </div>
        <span class="text-zinc-700">|</span>
        {#each ["red", "yellow", "green", "blue", "purple"] as c}
          <button
            onclick={() => bulkColor(c)}
            class="w-4 h-4 rounded-full {colorClassMap[
              c
            ]} opacity-70 hover:opacity-100"
          />
        {/each}
        <span class="text-zinc-700">|</span>
        <button
          onclick={() => bulkFlag("pick")}
          class="text-xs text-green-500 hover:text-green-400 px-1">Pick</button
        >
        <button
          onclick={() => bulkFlag("reject")}
          class="text-xs text-red-500 hover:text-red-400 px-1">Reject</button
        >
        <span class="text-zinc-700">|</span>
        <button
          onclick={openCompare}
          class="text-xs text-zinc-400 hover:text-zinc-200 px-1">对比</button
        >
        <div class="relative">
          <button
            onclick={() => (showAddToCollection = !showAddToCollection)}
            class="text-xs text-violet-400 hover:text-violet-300 px-1"
            >加入收藏集</button
          >
          {#if showAddToCollection}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="absolute top-full mt-1 left-0 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[120px] z-10"
              onmouseleave={() => (showAddToCollection = false)}
            >
              {#each collections.filter((c) => !c.isSmart) as c}
                <button
                  onclick={() => addToCollection(c.id)}
                  class="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
                  >{c.name}</button
                >
              {/each}
            </div>
          {/if}
        </div>
        <span class="text-zinc-700">|</span>
        <button
          onclick={startBulkDelete}
          class="text-xs text-red-500 hover:text-red-400 px-1">删除</button
        >
        <button
          onclick={() => (selectedPaths = new Set())}
          class="text-xs text-zinc-500 hover:text-zinc-300 ml-1"
          >取消选择</button
        >
      </div>
    {/if}

    <!-- Grid -->
    <div class="flex-1 overflow-y-auto p-4">
      {#if loading}
        <div class="flex items-center justify-center h-full">
          <p class="text-zinc-500 text-sm">加载中...</p>
        </div>
      {:else if browseImages.length === 0}
        <div class="flex h-full items-center justify-center">
          <div class="text-center">
            <p class="text-lg text-zinc-600">没有找到图片</p>
            <p class="mt-2 text-sm text-zinc-700">
              {activeCollectionId
                ? "此收藏集中没有图片"
                : "请在设置中配置 ComfyUI 输出目录路径"}
            </p>
          </div>
        </div>
      {:else}
        <div
          class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
        >
          {#each browseImages as img, i}
            <button
              onclick={(e) => handleImageClick(img, i, e)}
              ondblclick={() => {
                lightboxIndex = i;
                lightboxOpen = true;
              }}
              class="group relative rounded-lg border {selectedPaths.has(
                img.relativePath,
              )
                ? 'border-violet-500 ring-1 ring-violet-500/30'
                : selectedImage?.relativePath === img.relativePath
                  ? 'border-violet-500/50'
                  : 'border-zinc-800'} bg-zinc-900 overflow-hidden hover:border-zinc-700 transition-colors text-left"
            >
              <div
                class="aspect-square bg-zinc-800 flex items-center justify-center relative"
              >
                <img
                  src={getImageUrl(img.relativePath)}
                  alt=""
                  loading="lazy"
                  class="w-full h-full object-cover"
                />
                {#if img.attributes?.colorLabel}
                  <div
                    class="absolute top-1.5 right-1.5 w-3 h-3 rounded-full {colorClassMap[
                      img.attributes.colorLabel
                    ] || ''} ring-1 ring-black/30"
                  ></div>
                {/if}
                {#if img.attributes?.flag === "pick"}
                  <div
                    class="absolute top-1 left-1 text-green-400 text-xs font-bold bg-black/50 rounded px-1"
                  >
                    P
                  </div>
                {:else if img.attributes?.flag === "reject"}
                  <div
                    class="absolute top-1 left-1 text-red-400 text-xs font-bold bg-black/50 rounded px-1"
                  >
                    R
                  </div>
                {/if}
                {#if selectedPaths.size > 0}
                  <div
                    class="absolute top-1.5 left-1.5 w-4 h-4 rounded border {selectedPaths.has(
                      img.relativePath,
                    )
                      ? 'bg-violet-500 border-violet-500'
                      : 'bg-black/40 border-zinc-500'} flex items-center justify-center"
                  >
                    {#if selectedPaths.has(img.relativePath)}
                      <svg
                        class="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        ><path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="3"
                          d="M5 13l4 4L19 7"
                        /></svg
                      >
                    {/if}
                  </div>
                {/if}
              </div>
              <div class="p-2">
                <div class="flex items-center gap-0.5">
                  {#each [1, 2, 3, 4, 5] as r}
                    <span
                      class="text-xs {r <= (img.attributes?.rating ?? 0)
                        ? 'text-amber-400'
                        : 'text-zinc-700'}">★</span
                    >
                  {/each}
                </div>
                <div
                  class="mt-0.5 text-xs text-zinc-500 truncate"
                  title={img.filename}
                >
                  {img.filename}
                </div>
                <div class="text-xs text-zinc-600">
                  {img.width && img.height
                    ? `${img.width}×${img.height}`
                    : formatFileSize(img.size)}
                </div>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Right: detail panel -->
  {#if selectedImage}
    <GalleryDetail
      image={selectedImage}
      attributes={selectedImage.attributes ?? null}
      tags={selectedImage.tags ?? []}
      {allTags}
      onclose={() => (selectedImage = null)}
      onrate={handleRate}
      oncolor={handleColor}
      onflag={handleFlag}
      onaddtag={handleAddTag}
      onremovetag={handleRemoveTag}
      ondelete={startSingleDelete}
      onzoom={() => {
        lightboxIndex = browseImages.findIndex(
          (img) => img.relativePath === selectedImage!.relativePath,
        );
        if (lightboxIndex >= 0) lightboxOpen = true;
      }}
    />
  {/if}
</div>

<!-- Modals -->
{#if lightboxOpen}
  <Lightbox
    images={browseImages.map((img) => ({
      relativePath: img.relativePath,
      filename: img.filename,
    }))}
    currentIndex={lightboxIndex}
    onclose={() => (lightboxOpen = false)}
    onnavigate={(i) => {
      lightboxIndex = i;
      if (browseImages[i]) {
        selectedImage = browseImages[i];
        selectedPaths = new Set([browseImages[i].relativePath]);
      }
    }}
  />
{/if}

{#if compareOpen}
  <CompareView images={compareImages} onclose={() => (compareOpen = false)} />
{/if}

{#if deleteConfirm}
  <ConfirmDialog
    message={deleteConfirm.message}
    requireInput={deleteConfirm.requireInput}
    onconfirm={confirmDelete}
    oncancel={() => (deleteConfirm = null)}
  />
{/if}

{#each toasts as t (t.id)}
  <Toast
    message={t.message}
    type={t.type}
    ondismiss={() => dismissToast(t.id)}
  />
{/each}
