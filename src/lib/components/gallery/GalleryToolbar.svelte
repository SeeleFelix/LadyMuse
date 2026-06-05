<script lang="ts">
  import type {
    ViewMode,
    SortOption,
    SortField,
  } from "$lib/stores/gallery-store.svelte";

  let {
    viewMode = "library",
    searchQuery = "",
    sortOption,
    totalImages = 0,
    onviewmodechange,
    onsearchchange,
    onsortchange,
    onrefresh,
    ontogglefilters,
  }: {
    viewMode?: ViewMode;
    searchQuery?: string;
    sortOption: SortOption;
    totalImages?: number;
    onviewmodechange: (mode: ViewMode) => void;
    onsearchchange: (query: string) => void;
    onsortchange: (sort: SortOption) => void;
    onrefresh: () => void;
    ontogglefilters: () => void;
  } = $props();

  let searchInput = $state(searchQuery);
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  function handleSearchInput(e: Event) {
    const target = e.target as HTMLInputElement;
    searchInput = target.value;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      onsearchchange(searchInput);
    }, 300);
  }

  const viewModes: { key: ViewMode; label: string; shortcut: string }[] = [
    { key: "library", label: "Library", shortcut: "G" },
    { key: "inspect", label: "Inspect", shortcut: "E" },
    { key: "compare", label: "Compare", shortcut: "C" },
  ];

  const sortOptions: { label: string; value: SortOption }[] = [
    { label: "最新优先", value: { field: "modified_at", direction: "desc" } },
    { label: "最旧优先", value: { field: "modified_at", direction: "asc" } },
    { label: "评分从高到低", value: { field: "rating", direction: "desc" } },
    { label: "评分从低到高", value: { field: "rating", direction: "asc" } },
    { label: "文件名 (A-Z)", value: { field: "filename", direction: "asc" } },
    { label: "文件名 (Z-A)", value: { field: "filename", direction: "desc" } },
    {
      label: "文件大小从大到小",
      value: { field: "file_size", direction: "desc" },
    },
    {
      label: "文件大小从小到大",
      value: { field: "file_size", direction: "asc" },
    },
  ];

  function getSortLabel(): string {
    const option = sortOptions.find(
      (o) =>
        o.value.field === sortOption.field &&
        o.value.direction === sortOption.direction,
    );
    return option?.label || "排序";
  }
</script>

<div class="border-b border-zinc-800 px-4 py-2.5 flex items-center gap-3">
  <!-- View mode buttons -->
  <div class="flex items-center gap-1">
    {#each viewModes as mode}
      <button
        onclick={() => onviewmodechange(mode.key)}
        class="rounded px-2 py-1 text-xs transition-colors {viewMode ===
        mode.key
          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}"
        title="{mode.label} ({mode.shortcut})"
      >
        {mode.shortcut}
      </button>
    {/each}
  </div>

  <!-- Search input -->
  <div class="flex-1 max-w-xs">
    <input
      type="text"
      value={searchInput}
      oninput={handleSearchInput}
      placeholder="搜索提示词..."
      class="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-300 placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
    />
  </div>

  <!-- Sort dropdown -->
  <select
    onchange={(e) => {
      const idx = (e.target as HTMLSelectElement).selectedIndex;
      onsortchange(sortOptions[idx].value);
    }}
    class="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 focus:border-violet-500 focus:outline-none"
  >
    {#each sortOptions as opt}
      <option
        value={opt.value.field + "-" + opt.value.direction}
        selected={opt.value.field === sortOption.field &&
          opt.value.direction === sortOption.direction}
      >
        {opt.label}
      </option>
    {/each}
  </select>

  <!-- Right actions -->
  <div class="ml-auto flex items-center gap-2">
    <!-- Image count -->
    <span class="text-xs text-zinc-500">
      {totalImages} 张图片
    </span>

    <!-- Filter toggle -->
    <button
      onclick={ontogglefilters}
      class="rounded px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
      title="筛选条件"
    >
      <svg
        class="w-3.5 h-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
        />
      </svg>
    </button>

    <!-- Refresh -->
    <button
      onclick={onrefresh}
      class="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-600 hover:text-zinc-100 transition-colors"
      title="刷新"
    >
      <svg
        class="w-3.5 h-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    </button>
  </div>
</div>
