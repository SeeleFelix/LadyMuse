<script lang="ts">
  import GalleryToolbar from "./GalleryToolbar.svelte";
  import FilterPanel from "./FilterPanel.svelte";
  import VirtualGrid from "./VirtualGrid.svelte";
  import DetailPanel from "./DetailPanel.svelte";
  import StatusBar from "./StatusBar.svelte";
  import type { GalleryStore } from "$lib/stores/gallery-store";
  import type { SortOption, ViewMode } from "$lib/stores/gallery-store";

  interface Tag {
    id: number;
    name: string;
    slug: string;
  }

  let {
    store,
    oncontextmenu,
    allTags = [],
  }: {
    store: GalleryStore;
    oncontextmenu?: (path: string, e: MouseEvent) => void;
    allTags?: Tag[];
  } = $props();

  function handleSelect(path: string, e: MouseEvent) {
    const multi = e.shiftKey || e.ctrlKey;
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

  function handleToggleFilters() {
    store.sidebarOpen = !store.sidebarOpen;
  }
</script>

<div class="flex flex-col h-full bg-zinc-950">
  <!-- Toolbar -->
  <GalleryToolbar
    viewMode={store.viewMode}
    searchQuery={store.filters.text?.positivePrompt ?? ""}
    sortOption={store.sortOrder}
    totalImages={store.pagination.total}
    onviewmodechange={handleViewModeChange}
    onsearchchange={handleSearchChange}
    onsortchange={handleSortChange}
    onrefresh={() => store.refresh()}
    ontogglefilters={handleToggleFilters}
  />

  <!-- Main content: three columns -->
  <div class="flex-1 flex min-h-0 overflow-hidden">
    <!-- Filter Panel (left) -->
    <FilterPanel
      open={store.sidebarOpen}
      filters={store.filters}
      onfilterschange={(f) => store.setFilters(f)}
      onclose={() => (store.sidebarOpen = false)}
    />

    <!-- Virtual Grid (center) -->
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
      />
    </div>

    <!-- Detail Panel (right) -->
    {#if store.activeImage}
      <DetailPanel
        image={store.activeImage}
        {allTags}
        onrate={(r) =>
          store.updateAttributes(store.activeImage!.relativePath, {
            rating: r,
          })}
        oncolor={(c) =>
          store.updateAttributes(store.activeImage!.relativePath, {
            colorLabel: c,
          })}
        onflag={(f) =>
          store.updateAttributes(store.activeImage!.relativePath, { flag: f })}
        onaddtag={(t) => {
          /* TODO: Implement tag add */
        }}
        onremovetag={(id) => {
          /* TODO: Implement tag remove */
        }}
        onclose={() => (store.activeImage = null)}
      />
    {/if}
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
