<script lang="ts">
  import { onMount } from "svelte";

  interface Style {
    id: number;
    name: string;
    nameZh: string | null;
    description: string | null;
    positiveTemplate: string;
    negativePrompt: string | null;
    qualityTags: string | null;
    recommendedParams: string | null;
    tags: string | null;
  }

  interface Family {
    id: number;
    name: string;
    nameZh: string | null;
    description: string | null;
    styles: Style[];
  }

  let families = $state<Family[]>([]);
  let selectedStyle = $state<Style | null>(null);
  let loading = $state(true);
  let copied = $state(false);

  onMount(async () => {
    const res = await fetch("/api/styles");
    if (res.ok) families = await res.json();
    loading = false;
  });

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }
</script>

<div class="flex h-full">
  <div
    class="w-72 shrink-0 border-r border-zinc-800 bg-zinc-900/50 overflow-y-auto p-4"
  >
    <h2 class="text-lg font-semibold text-zinc-200 mb-4">风格库</h2>

    {#if loading}
      <div class="text-zinc-500">加载中...</div>
    {:else}
      {#each families as family}
        {#if family.styles.length > 0}
          <div class="mb-4">
            <h3 class="text-sm font-semibold text-zinc-300 mb-2">
              {family.nameZh || family.name}
            </h3>
            <div class="space-y-1">
              {#each family.styles as style}
                <button
                  onclick={() => (selectedStyle = style)}
                  class="block w-full text-left rounded px-2.5 py-1.5 text-sm {selectedStyle?.id ===
                  style.id
                    ? 'bg-violet-600/20 text-violet-300'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}"
                  >{style.nameZh || style.name}</button
                >
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    {/if}
  </div>

  <div class="flex-1 overflow-y-auto p-6">
    {#if selectedStyle}
      <div>
        <h1 class="text-2xl font-bold text-zinc-100">
          {selectedStyle.nameZh || selectedStyle.name}
        </h1>
        <p class="mt-1 text-base text-zinc-500">{selectedStyle.name}</p>

        {#if selectedStyle.description}
          <p class="mt-3 text-sm text-zinc-400 leading-relaxed">
            {selectedStyle.description}
          </p>
        {/if}

        <div class="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-medium text-zinc-300">正向模板</h3>
            <button
              onclick={() => copyText(selectedStyle!.positiveTemplate)}
              class="rounded bg-violet-600 px-3 py-1 text-xs text-white hover:bg-violet-500"
              >{copied ? "已复制!" : "复制"}</button
            >
          </div>
          <pre
            class="whitespace-pre-wrap text-xs text-violet-300">{selectedStyle.positiveTemplate}</pre>
        </div>

        {#if selectedStyle.negativePrompt}
          <div class="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <h3 class="text-sm font-medium text-zinc-300 mb-2">反向提示词</h3>
            <pre
              class="whitespace-pre-wrap text-xs text-red-300/70">{selectedStyle.negativePrompt}</pre>
          </div>
        {/if}

        {#if selectedStyle.qualityTags}
          <div class="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <h3 class="text-sm font-medium text-zinc-300 mb-2">品质标签</h3>
            <div class="flex flex-wrap gap-1.5">
              {#each selectedStyle.qualityTags
                .split(",")
                .map((k) => k.trim())
                .filter(Boolean) as tag}
                <span
                  class="rounded bg-emerald-600/20 px-2.5 py-1 text-xs text-emerald-300"
                  >{tag}</span
                >
              {/each}
            </div>
          </div>
        {/if}

        {#if selectedStyle.recommendedParams}
          <div class="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <h3 class="text-sm font-medium text-zinc-300 mb-2">推荐参数</h3>
            <div class="grid grid-cols-3 gap-3">
              {#each Object.entries(JSON.parse(selectedStyle.recommendedParams)) as [key, val]}
                <div class="text-xs">
                  <span class="text-zinc-500">{key}:</span>
                  <span class="ml-1 text-zinc-200">{String(val)}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if selectedStyle.tags}
          <div class="mt-4">
            <h3 class="text-sm font-medium text-zinc-300 mb-2">标签</h3>
            <div class="flex flex-wrap gap-1.5">
              {#each selectedStyle.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean) as tag}
                <span
                  class="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400"
                  >{tag}</span
                >
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <div class="flex h-full items-center justify-center text-zinc-600">
        从左侧选择一个风格查看详情
      </div>
    {/if}
  </div>
</div>
