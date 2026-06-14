<script lang="ts">
  import GalleryToolbar from "./GalleryToolbar.svelte";
  import FilterPanel from "./FilterPanel.svelte";
  import VirtualGrid from "./VirtualGrid.svelte";
  import StatusBar from "./StatusBar.svelte";
  import TrashView from "./TrashView.svelte";
  import type { GalleryStore } from "$lib/stores/gallery-store.svelte";
  import type { SortOption, ViewMode } from "$lib/stores/gallery-store.svelte";

  interface Tag {
    id: number;
    name: string;
    slug: string;
  }

  let {
    store,
    oncontextmenu,
    allTags = [],
    ontrashaction,
    onlongpress,
    ondownload,
    onopencollections,
  }: {
    store: GalleryStore;
    oncontextmenu?: (path: string, e: MouseEvent) => void;
    allTags?: Tag[];
    ontrashaction?: (
      action: "restore" | "purge" | "empty",
      id?: number,
    ) => void;
    onlongpress?: (path: string) => void;
    ondownload?: (path: string) => void;
    onopencollections?: () => void;
  } = $props();

  let filterPanelOpen = $state(false);

  $effect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    filterPanelOpen = mq.matches;
    const handler = (e: MediaQueryListEvent) => {
      filterPanelOpen = e.matches;
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  });

  function handleSelect(path: string, e: MouseEvent) {
    const multi = e.shiftKey || e.ctrlKey || e.metaKey;
    const range = e.shiftKey;
    store.select(path, multi, range);
  }

  function handleDblClick(path: string) {
    store.select(path, false, false);
    store.setViewMode("inspect");
  }

  function handleContextMenu(path: string, e: MouseEvent) {
    e.preventDefault();
    oncontextmenu?.(path, e);
  }

  function handleSortChange(sort: SortOption) {
    store.setSort(sort);
  }

  function handleSearchChange(query: string) {
    store.setFilters({
      ...store.filters,
      text: {
        ...store.filters.text,
        positivePrompt: query || undefined,
      },
    });
  }

  function handleViewModeChange(mode: ViewMode) {
    store.setViewMode(mode);
  }

  function toggleFilter() {
    filterPanelOpen = !filterPanelOpen;
  }
</script>

{#if store.trashView}
  <TrashView
    items={store.trashImages}
    onrestore={(id) => ontrashaction?.("restore", id)}
    onpurge={(id) => ontrashaction?.("purge", id)}
    onempty={() => ontrashaction?.("empty")}
    onback={() => store.setTrashView(false)}
  />
{:else}
  <div class="flex flex-col h-full bg-zinc-950">
    <!-- Toolbar -->
    <GalleryToolbar
      viewMode={store.viewMode}
      searchQuery={store.filters.text?.positivePrompt ?? ""}
      sortOption={store.sortOrder}
      totalImages={store.pagination.total}
      trashCount={store.trashCount}
      onviewmodechange={handleViewModeChange}
      onsearchchange={handleSearchChange}
      onsortchange={handleSortChange}
      onrefresh={() => store.refresh()}
      onopentrash={() => store.setTrashView(true)}
      ontogglefilter={toggleFilter}
      {onopencollections}
    />

    <!-- Filter bar (toggleable on mobile) -->
    {#if filterPanelOpen}
      <FilterPanel
        filters={store.filters}
        onfilterschange={(f) => store.setFilters(f)}
      />
    {/if}

    <!-- Main content: grid + optional detail panel -->
    <div class="flex-1 flex min-h-0 overflow-hidden">
      <!-- Virtual Grid -->
      <div class="flex-1 overflow-y-auto">
        <VirtualGrid
          images={store.images}
          selectedPaths={store.selectedPaths}
          activePath={store.activeImage?.relativePath ?? null}
          onselect={handleSelect}
          ondblclick={handleDblClick}
          oncontextmenu={handleContextMenu}
          onloadmore={() => store.loadPage("next")}
          hasMore={store.pagination.hasMore}
          loadingMore={store.loading}
          {onlongpress}
          {ondownload}
        />
      </div>
    </div>

    <!-- Status Bar -->
    <StatusBar
      totalImages={store.pagination.total}
      selectedCount={store.selectedCount}
      filteredCount={store.images.length}
      loading={store.loading}
      viewMode={store.viewMode}
    />
  </div>
{/if}
