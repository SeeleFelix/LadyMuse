<script lang="ts">
  import type { ViewMode, SortOption } from "$lib/stores/gallery-store.svelte";

  let {
    viewMode = "library",
    searchQuery = "",
    sortOption,
    totalImages = 0,
    trashCount = 0,
    onviewmodechange,
    onsearchchange,
    onsortchange,
    onrefresh,
    onopentrash,
    ontogglefilter,
  }: {
    viewMode?: ViewMode;
    searchQuery?: string;
    sortOption: SortOption;
    totalImages?: number;
    trashCount?: number;
    onviewmodechange: (mode: ViewMode) => void;
    onsearchchange: (query: string) => void;
    onsortchange: (sort: SortOption) => void;
    onrefresh: () => void;
    onopentrash?: () => void;
    ontogglefilter?: () => void;
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

  const viewModes: {
    key: ViewMode;
    label: string;
    shortcut: string;
  }[] = [
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

<div class="border-b border-zinc-800 bg-zinc-900/30">
  <!-- Row 1: search + view mode -->
  <div
    class="px-3 md:px-4 pt-2.5 pb-2 md:py-2.5 flex items-center gap-2 md:gap-3"
  >
    <!-- View mode buttons -->
    <div class="flex items-center gap-0.5 md:gap-1">
      {#each viewModes as mode}
        <button
          onclick={() => onviewmodechange(mode.key)}
          class="rounded px-1.5 md:px-2 py-1 text-xs transition-colors {viewMode ===
          mode.key
            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
            : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}"
          title={mode.label}
        >
          <span class="hidden md:inline">{mode.shortcut}</span>
          <span class="md:hidden text-[10px]">{mode.label}</span>
        </button>
      {/each}
    </div>

    <!-- Search input -->
    <div class="flex-1 md:max-w-xs">
      <input
        type="text"
        value={searchInput}
        oninput={handleSearchInput}
        placeholder="搜索提示词..."
        class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 md:px-3 py-1 text-xs text-zinc-300 placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
      />
    </div>
  </div>

  <!-- Row 2: sort + filter + actions -->
  <div class="px-3 md:px-4 pb-2.5 md:pb-2 flex items-center gap-2">
    <!-- Desktop sort dropdown -->
    <select
      onchange={(e) => {
        const idx = (e.target as HTMLSelectElement).selectedIndex;
        onsortchange(sortOptions[idx].value);
      }}
      class="hidden md:block rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 focus:border-violet-500 focus:outline-none"
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

    <!-- Mobile sort button + hidden native select -->
    <div class="relative md:hidden">
      <button
        onclick={() => {
          const sel = document.getElementById(
            "mobile-sort-select",
          ) as HTMLSelectElement | null;
          sel?.click();
        }}
        class="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 flex items-center gap-1"
      >
        <svg
          class="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
          />
        </svg>
        <span class="text-zinc-500">{getSortLabel()}</span>
      </button>
      <select
        id="mobile-sort-select"
        onchange={(e) => {
          const idx = (e.target as HTMLSelectElement).selectedIndex;
          onsortchange(sortOptions[idx].value);
        }}
        class="absolute inset-0 opacity-0"
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
    </div>

    <!-- Filter toggle -->
    <button
      onclick={ontogglefilter}
      class="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-600 transition-colors flex items-center gap-1"
      title="筛选"
    >
      <svg
        class="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
        />
      </svg>
      <span class="hidden md:inline text-xs">筛选</span>
    </button>

    <!-- Spacer / right actions -->
    <div class="flex-1 md:hidden"></div>
    <div class="md:ml-auto flex items-center gap-1 md:gap-2">
      <!-- Trash -->
      <button
        onclick={() => onopentrash?.()}
        class="rounded border border-zinc-700 bg-zinc-800 px-1.5 md:px-2 py-1 text-xs text-zinc-300 hover:border-zinc-600 hover:text-amber-300 transition-colors flex items-center gap-1"
        title="回收站"
      >
        <svg
          class="w-3.5 h-3.5"
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
        <span class="hidden md:inline">回收站</span>
        {#if trashCount > 0}
          <span
            class="rounded-full bg-amber-500/20 px-1.5 text-[10px] text-amber-300"
          >
            {trashCount}
          </span>
        {/if}
      </button>

      <!-- Image count (desktop only) -->
      <span class="hidden md:inline text-xs text-zinc-500">
        {totalImages} 张图片
      </span>

      <!-- Refresh -->
      <button
        onclick={onrefresh}
        class="rounded border border-zinc-700 bg-zinc-800 px-1.5 md:px-2 py-1 text-xs text-zinc-300 hover:border-zinc-600 transition-colors"
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
</div>
