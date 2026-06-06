<script lang="ts">
  import type { FilterCriteria } from "$lib/stores/gallery-store.svelte";

  let {
    filters,
    onfilterschange,
  }: {
    filters: FilterCriteria;
    onfilterschange: (filters: FilterCriteria) => void;
  } = $props();

  const colorOptions = [
    { value: "red", label: "红", class: "bg-red-500" },
    { value: "yellow", label: "黄", class: "bg-yellow-500" },
    { value: "green", label: "绿", class: "bg-green-500" },
    { value: "blue", label: "蓝", class: "bg-blue-500" },
    { value: "purple", label: "紫", class: "bg-purple-500" },
  ];

  let ratingMin = $derived(filters.user?.ratingMin ?? 0);
  let colorLabels = $derived(filters.user?.colorLabels ?? []);
  let flags = $derived(filters.user?.flags ?? []);
  let positivePrompt = $derived(filters.text?.positivePrompt ?? "");
  let negativePrompt = $derived(filters.text?.negativePrompt ?? "");

  function setRatingMin(value: number) {
    onfilterschange({
      ...filters,
      user: { ...filters.user, ratingMin: value > 0 ? value : undefined },
    });
  }

  function toggleColorLabel(color: string) {
    const current = colorLabels;
    const updated = current.includes(color)
      ? current.filter((c) => c !== color)
      : [...current, color];
    onfilterschange({
      ...filters,
      user: {
        ...filters.user,
        colorLabels: updated.length > 0 ? updated : undefined,
      },
    });
  }

  function setFlag(flag: string | null) {
    onfilterschange({
      ...filters,
      user: { ...filters.user, flags: flag ? [flag] : undefined },
    });
  }

  function setPositivePrompt(value: string) {
    onfilterschange({
      ...filters,
      text: { ...filters.text, positivePrompt: value || undefined },
    });
  }

  function setNegativePrompt(value: string) {
    onfilterschange({
      ...filters,
      text: { ...filters.text, negativePrompt: value || undefined },
    });
  }

  function clearAll() {
    onfilterschange({});
  }

  function hasActiveFilters(): boolean {
    return (
      ratingMin > 0 ||
      colorLabels.length > 0 ||
      flags.length > 0 ||
      positivePrompt.length > 0 ||
      negativePrompt.length > 0
    );
  }
</script>

<div
  class="flex items-center gap-3 px-4 py-1.5 border-b border-zinc-800 bg-zinc-900/30 flex-wrap"
>
  <!-- Rating -->
  <div class="flex items-center gap-0.5">
    <span class="text-[10px] text-zinc-600 mr-1 select-none">评分</span>
    {#each [0, 1, 2, 3, 4, 5] as r}
      <button
        onclick={() => setRatingMin(r)}
        class="text-xs px-0.5 {r <= ratingMin
          ? 'text-amber-400'
          : 'text-zinc-700'} hover:text-amber-300 transition-colors"
      >
        {r > 0 ? "★" : "-"}
      </button>
    {/each}
  </div>

  <span class="w-px h-4 bg-zinc-700"></span>

  <!-- Color labels -->
  <div class="flex items-center gap-1">
    {#each colorOptions as color}
      <button
        onclick={() => toggleColorLabel(color.value)}
        class="w-4 h-4 rounded-full {color.class} {colorLabels.includes(
          color.value,
        )
          ? 'ring-1 ring-white/50 scale-110'
          : 'opacity-30 hover:opacity-70'} transition-all"
        title={color.label}
      ></button>
    {/each}
  </div>

  <span class="w-px h-4 bg-zinc-700"></span>

  <!-- Flags -->
  <div class="flex items-center gap-1">
    <button
      onclick={() => setFlag(flags.includes("pick") ? null : "pick")}
      class="text-xs rounded px-1.5 py-0.5 {flags.includes('pick')
        ? 'bg-green-500/20 text-green-400'
        : 'text-zinc-600 hover:text-green-400'} transition-colors">Pick</button
    >
    <button
      onclick={() => setFlag(flags.includes("reject") ? null : "reject")}
      class="text-xs rounded px-1.5 py-0.5 {flags.includes('reject')
        ? 'bg-red-500/20 text-red-400'
        : 'text-zinc-600 hover:text-red-400'} transition-colors">Reject</button
    >
  </div>

  <span class="w-px h-4 bg-zinc-700"></span>

  <!-- Text search -->
  <input
    type="text"
    value={positivePrompt}
    oninput={(e) => setPositivePrompt(e.target.value)}
    placeholder="正向提示词..."
    class="w-32 rounded border border-zinc-800 bg-zinc-800/50 px-1.5 py-0.5 text-[11px] text-zinc-300 placeholder-zinc-600 focus:border-violet-500/50 focus:outline-none"
  />
  <input
    type="text"
    value={negativePrompt}
    oninput={(e) => setNegativePrompt(e.target.value)}
    placeholder="反向提示词..."
    class="w-32 rounded border border-zinc-800 bg-zinc-800/50 px-1.5 py-0.5 text-[11px] text-zinc-300 placeholder-zinc-600 focus:border-violet-500/50 focus:outline-none"
  />

  <!-- Clear -->
  {#if hasActiveFilters()}
    <button
      onclick={clearAll}
      class="text-[10px] text-zinc-500 hover:text-zinc-300 ml-auto"
      >清除筛选</button
    >
  {/if}
</div>
