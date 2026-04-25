<script lang="ts">
  import { onMount } from "svelte";

  interface GenerationRating {
    id: number;
    rating: number;
    isFavorite: boolean;
    notes: string | null;
    effectiveKeywords: string | null;
  }

  interface Generation {
    id: number;
    promptId: number;
    comfyuiJobId: string | null;
    imagePath: string;
    thumbnailPath: string | null;
    parametersJson: string | null;
    width: number | null;
    height: number | null;
    seed: number | null;
    sampler: string | null;
    steps: number | null;
    cfgScale: number | null;
    modelName: string | null;
    durationMs: number | null;
    createdAt: string | null;
    ratings: GenerationRating[];
  }

  let generations = $state<Generation[]>([]);
  let selected = $state<Generation | null>(null);
  let loading = $state(true);
  let filterRating = $state<number | null>(null);

  async function loadGenerations() {
    const res = await fetch("/api/generations");
    if (res.ok) generations = await res.json();
    loading = false;
  }

  function getRating(g: Generation): number | null {
    return g.ratings.length > 0 ? g.ratings[0].rating : null;
  }

  function isFavorite(g: Generation): boolean {
    return g.ratings.length > 0 ? g.ratings[0].isFavorite : false;
  }

  async function rateGeneration(generationId: number, rating: number) {
    await fetch("/api/generations/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generation_id: generationId, rating }),
    });
    loadGenerations();
  }

  async function toggleFavorite(g: Generation) {
    const current = g.ratings[0];
    await fetch("/api/generations/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generation_id: g.id,
        rating: current?.rating ?? 3,
        is_favorite: !isFavorite(g),
      }),
    });
    loadGenerations();
  }

  function formatDate(d: string | null): string {
    if (!d) return "";
    return new Date(d).toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDuration(ms: number | null): string {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  let filteredGenerations = $derived(
    filterRating
      ? generations.filter((g) => getRating(g) === filterRating)
      : generations,
  );

  onMount(loadGenerations);
</script>

<div class="flex h-full">
  <!-- Main: grid -->
  <div class="flex-1 flex flex-col overflow-hidden">
    <div class="border-b border-zinc-800 px-6 py-3 flex items-center gap-4">
      <h2 class="text-lg font-semibold text-zinc-200">生成记录</h2>
      <span class="text-xs text-zinc-500">{generations.length} 条</span>
      <div class="ml-auto flex items-center gap-2">
        <span class="text-xs text-zinc-500">筛选:</span>
        <button
          onclick={() => (filterRating = null)}
          class="rounded px-2 py-0.5 text-xs {!filterRating
            ? 'bg-violet-600/20 text-violet-300'
            : 'text-zinc-500 hover:text-zinc-300'}">全部</button
        >
        {#each [5, 4, 3] as r}
          <button
            onclick={() => (filterRating = r)}
            class="rounded px-2 py-0.5 text-xs {filterRating === r
              ? 'bg-amber-600/20 text-amber-300'
              : 'text-zinc-500 hover:text-zinc-300'}">{r}★</button
          >
        {/each}
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-6">
      {#if loading}
        <div class="text-zinc-500 text-sm">加载中...</div>
      {:else if filteredGenerations.length === 0}
        <div class="flex h-full items-center justify-center">
          <div class="text-center">
            <p class="text-lg text-zinc-600">
              {generations.length === 0 ? "还没有生成记录" : "没有匹配的记录"}
            </p>
            {#if generations.length === 0}
              <p class="mt-2 text-sm text-zinc-700">
                通过 ComfyUI 生成图片后自动记录
              </p>
            {/if}
          </div>
        </div>
      {:else}
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {#each filteredGenerations as g}
            <button
              onclick={() => (selected = g)}
              class="group relative rounded-lg border {selected?.id === g.id
                ? 'border-violet-500/50'
                : 'border-zinc-800'} bg-zinc-900 overflow-hidden hover:border-zinc-700 transition-colors text-left"
            >
              <!-- Image placeholder -->
              <div
                class="aspect-square bg-zinc-800 flex items-center justify-center"
              >
                {#if g.thumbnailPath || g.imagePath}
                  <img
                    src={g.thumbnailPath || g.imagePath}
                    alt=""
                    class="w-full h-full object-cover"
                  />
                {:else}
                  <svg
                    class="h-12 w-12 text-zinc-700"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    ><path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    /></svg
                  >
                {/if}
              </div>

              <!-- Info overlay -->
              <div class="p-2.5">
                <div class="flex items-center justify-between">
                  <div class="flex gap-0.5">
                    {#each [1, 2, 3, 4, 5] as r}
                      <span
                        class="text-xs {r <= (getRating(g) ?? 0)
                          ? 'text-amber-400'
                          : 'text-zinc-700'}">★</span
                      >
                    {/each}
                  </div>
                  {#if isFavorite(g)}
                    <span class="text-xs text-red-400">♥</span>
                  {/if}
                </div>
                <div class="mt-1 text-xs text-zinc-500 truncate">
                  {g.width || "?"}×{g.height || "?"} · {g.sampler || "-"} · {g.steps ||
                    "?"}步
                </div>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Right: detail panel -->
  {#if selected}
    <div
      class="w-80 shrink-0 border-l border-zinc-800 bg-zinc-900/50 overflow-y-auto p-4"
    >
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-medium text-zinc-300">生成详情</h3>
        <button
          onclick={() => (selected = null)}
          class="text-zinc-500 hover:text-zinc-300"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            /></svg
          >
        </button>
      </div>

      <!-- Image preview -->
      <div class="rounded-lg overflow-hidden bg-zinc-800 mb-4">
        {#if selected.imagePath}
          <img src={selected.imagePath} alt="" class="w-full" />
        {:else}
          <div class="aspect-square flex items-center justify-center">
            <svg
              class="h-16 w-16 text-zinc-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              /></svg
            >
          </div>
        {/if}
      </div>

      <!-- Rating -->
      <div class="mb-4">
        <div class="text-xs text-zinc-500 mb-1">评分</div>
        <div class="flex items-center gap-1">
          {#each [1, 2, 3, 4, 5] as r}
            <button
              onclick={() => rateGeneration(selected!.id, r)}
              class="text-lg {r <= (getRating(selected!) ?? 0)
                ? 'text-amber-400'
                : 'text-zinc-600'} hover:text-amber-300">★</button
            >
          {/each}
          <button
            onclick={() => toggleFavorite(selected!)}
            class="ml-2 text-sm {isFavorite(selected!)
              ? 'text-red-400'
              : 'text-zinc-600'} hover:text-red-300">♥</button
          >
        </div>
      </div>

      <!-- Parameters -->
      <div class="space-y-2 mb-4">
        <div class="text-xs text-zinc-500 mb-2">生成参数</div>
        {#if selected.modelName}
          <div class="text-xs">
            <span class="text-zinc-500">模型:</span>
            <span class="text-zinc-300">{selected.modelName}</span>
          </div>
        {/if}
        {#if selected.sampler}
          <div class="text-xs">
            <span class="text-zinc-500">Sampler:</span>
            <span class="text-zinc-300">{selected.sampler}</span>
          </div>
        {/if}
        {#if selected.steps}
          <div class="text-xs">
            <span class="text-zinc-500">Steps:</span>
            <span class="text-zinc-300">{selected.steps}</span>
          </div>
        {/if}
        {#if selected.cfgScale}
          <div class="text-xs">
            <span class="text-zinc-500">CFG:</span>
            <span class="text-zinc-300">{selected.cfgScale}</span>
          </div>
        {/if}
        {#if selected.width && selected.height}
          <div class="text-xs">
            <span class="text-zinc-500">分辨率:</span>
            <span class="text-zinc-300">{selected.width}×{selected.height}</span
            >
          </div>
        {/if}
        {#if selected.seed}
          <div class="text-xs">
            <span class="text-zinc-500">Seed:</span>
            <span class="text-zinc-300">{selected.seed}</span>
          </div>
        {/if}
        {#if selected.durationMs}
          <div class="text-xs">
            <span class="text-zinc-500">耗时:</span>
            <span class="text-zinc-300"
              >{formatDuration(selected.durationMs)}</span
            >
          </div>
        {/if}
      </div>

      <!-- Metadata -->
      <div class="text-xs text-zinc-600 space-y-1">
        <div>创建: {formatDate(selected.createdAt)}</div>
        <div>Prompt ID: {selected.promptId}</div>
        {#if selected.comfyuiJobId}
          <div>Job: {selected.comfyuiJobId}</div>
        {/if}
      </div>
    </div>
  {/if}
</div>
