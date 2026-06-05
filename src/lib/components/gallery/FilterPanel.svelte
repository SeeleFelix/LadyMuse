<script lang="ts">
  import type { FilterCriteria } from "$lib/stores/gallery-store.svelte";

  let {
    filters,
    open = false,
    onfilterschange,
    onclose,
  }: {
    filters: FilterCriteria;
    open?: boolean;
    onfilterschange: (filters: FilterCriteria) => void;
    onclose: () => void;
  } = $props();

  const colorOptions = [
    { value: "red", label: "红色", class: "bg-red-500" },
    { value: "yellow", label: "黄色", class: "bg-yellow-500" },
    { value: "green", label: "绿色", class: "bg-green-500" },
    { value: "blue", label: "蓝色", class: "bg-blue-500" },
    { value: "purple", label: "紫色", class: "bg-purple-500" },
  ];

  const flagOptions = [
    { value: "pick", label: "Pick", class: "text-green-400" },
    { value: "reject", label: "Reject", class: "text-red-400" },
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

{#if open}
  <div
    class="w-64 shrink-0 border-r border-zinc-800 bg-zinc-900/50 overflow-y-auto"
  >
    <div class="p-4">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-medium text-zinc-300">筛选</h3>
        <button onclick={onclose} class="text-zinc-500 hover:text-zinc-300">
          <svg
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Rating filter -->
      <div class="mb-4">
        <div class="text-xs text-zinc-500 mb-2">最低评分</div>
        <div class="flex items-center gap-1">
          {#each [0, 1, 2, 3, 4, 5] as r}
            <button
              onclick={() => setRatingMin(r)}
              class="text-lg {r <= ratingMin
                ? 'text-amber-400'
                : 'text-zinc-700'} hover:text-amber-300 transition-colors"
            >
              {r > 0 ? "★" : "-"}
            </button>
          {/each}
        </div>
      </div>

      <!-- Color label filter -->
      <div class="mb-4">
        <div class="text-xs text-zinc-500 mb-2">颜色标记</div>
        <div class="flex flex-wrap gap-2">
          {#each colorOptions as color}
            <button
              onclick={() => toggleColorLabel(color.value)}
              class="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors {colorLabels.includes(
                color.value,
              )
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}"
            >
              <span
                class="w-3 h-3 rounded-full {color.class} {colorLabels.includes(
                  color.value,
                )
                  ? 'opacity-100'
                  : 'opacity-40'}"
              ></span>
              {color.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Flag filter -->
      <div class="mb-4">
        <div class="text-xs text-zinc-500 mb-2">标记</div>
        <div class="flex flex-wrap gap-2">
          {#each flagOptions as flag}
            <button
              onclick={() =>
                setFlag(flags.includes(flag.value) ? null : flag.value)}
              class="rounded px-2 py-1 text-xs transition-colors {flags.includes(
                flag.value,
              )
                ? 'bg-zinc-700 text-white'
                : flag.class + ' hover:bg-zinc-800'}"
            >
              {flag.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Positive prompt search -->
      <div class="mb-4">
        <div class="text-xs text-zinc-500 mb-2">正向提示词</div>
        <input
          type="text"
          value={positivePrompt}
          oninput={(e) => setPositivePrompt(e.target.value)}
          placeholder="包含关键词..."
          class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
        />
      </div>

      <!-- Negative prompt search -->
      <div class="mb-4">
        <div class="text-xs text-zinc-500 mb-2">反向提示词</div>
        <input
          type="text"
          value={negativePrompt}
          oninput={(e) => setNegativePrompt(e.target.value)}
          placeholder="包含关键词..."
          class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
        />
      </div>

      <!-- Clear all -->
      {#if hasActiveFilters()}
        <button
          onclick={clearAll}
          class="w-full rounded border border-zinc-700 px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
        >
          清除所有筛选
        </button>
      {/if}
    </div>
  </div>
{/if}
