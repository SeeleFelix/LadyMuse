<script lang="ts">
  import { onMount } from "svelte";

  interface Concept {
    name: string;
    nameZh: string | null;
    category: string;
    subCategory: string | null;
    snippet: string;
    tags: string[];
    score?: number;
  }

  interface ConceptDetail {
    name: string;
    nameZh: string | null;
    category: string;
    subCategory: string | null;
    visualDescription: string | null;
    tags: string[];
    tagUsage: string | null;
    naturalLanguage: string | null;
    nlUsage: string | null;
    relatedConcepts: { name: string; nameZh: string | null }[];
    source: string;
  }

  interface SyncStatus {
    running: boolean;
    source: string | null;
    stage: string | null;
    total: number;
    done: number;
    percent: number;
    error: string | null;
    lastSync: string | null;
  }

  const DIMENSIONS = [
    { id: "lighting", zh: "光影" },
    { id: "composition", zh: "构图" },
    { id: "color", zh: "色彩" },
    { id: "texture", zh: "质感" },
    { id: "setting", zh: "场景" },
    { id: "subject", zh: "主体" },
    { id: "style", zh: "风格" },
    { id: "technical", zh: "技术" },
  ];

  let selectedDim = $state<string | null>(null);
  let selectedConcept = $state<ConceptDetail | null>(null);
  let searchQuery = $state("");
  let searchMode = $state<"keyword" | "semantic">("keyword");
  let results = $state<{ subCategory: string; concepts: Concept[] }[]>([]);
  let loading = $state(false);
  let copied = $state(false);

  let syncStatus = $state<SyncStatus>({
    running: false,
    source: null,
    stage: null,
    total: 0,
    done: 0,
    percent: 0,
    error: null,
    lastSync: null,
  });

  onMount(() => {
    loadSyncStatus();
    loadConcepts();
    const sse = new EventSource("/api/knowledge/sync/progress");
    sse.addEventListener("progress", (e) => {
      syncStatus = JSON.parse(e.data);
    });
    sse.addEventListener("status", (e) => {
      syncStatus = JSON.parse(e.data);
    });
    return () => sse.close();
  });

  async function loadSyncStatus() {
    const res = await fetch("/api/knowledge/sync/status");
    if (res.ok) syncStatus = await res.json();
  }

  async function selectDimension(dim: string | null) {
    selectedDim = dim;
    selectedConcept = null;
    await loadConcepts();
  }

  async function loadConcepts() {
    loading = true;
    const params = new URLSearchParams();
    if (selectedDim) params.set("category", selectedDim);
    if (searchQuery) params.set("search", searchQuery);
    params.set("mode", searchMode);

    const res = await fetch(`/api/knowledge?${params}`);
    if (res.ok) {
      if (searchMode === "semantic" && searchQuery) {
        const flat = await res.json();
        results = [{ subCategory: "搜索结果", concepts: flat }];
      } else {
        results = await res.json();
      }
    }
    loading = false;
  }

  async function selectConcept(name: string) {
    const res = await fetch(`/api/knowledge/${encodeURIComponent(name)}`);
    if (res.ok) selectedConcept = await res.json();
  }

  async function triggerSync(source: "aat" | "wikipedia") {
    await fetch(`/api/knowledge/sync/${source}`, { method: "POST" });
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }
</script>

<div class="flex h-full flex-col">
  <!-- 同步栏 -->
  <div
    class="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900/50 px-4 py-2"
  >
    <span class="text-sm font-medium text-zinc-200">知识库管理</span>
    <div class="flex-1"></div>
    {#if syncStatus.lastSync}
      <span class="text-xs text-zinc-500"
        >上次同步: {new Date(syncStatus.lastSync).toLocaleString()}</span
      >
    {/if}
    <button
      onclick={() => triggerSync("aat")}
      disabled={syncStatus.running}
      class="rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
      >同步 AAT</button
    >
    <button
      onclick={() => triggerSync("wikipedia")}
      disabled={syncStatus.running}
      class="rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
      >同步 Wikipedia</button
    >
  </div>

  <!-- 进度条 -->
  {#if syncStatus.running}
    <div class="border-b border-zinc-800 bg-zinc-900/30 px-4 py-1.5">
      <div class="flex items-center gap-2 text-xs text-zinc-400">
        <span>正在同步 {syncStatus.source} · {syncStatus.stage}</span>
        <span class="text-zinc-600">{syncStatus.percent}%</span>
      </div>
      <div class="mt-1 h-1 rounded-full bg-zinc-800">
        <div
          class="h-1 rounded-full bg-violet-500 transition-all"
          style="width: {syncStatus.percent}%"
        ></div>
      </div>
    </div>
  {/if}

  {#if syncStatus.error}
    <div
      class="border-b border-red-800 bg-red-900/20 px-4 py-1.5 text-xs text-red-400"
    >
      同步失败: {syncStatus.error}
    </div>
  {/if}

  <div class="flex flex-1 overflow-hidden">
    <!-- 左侧：维度 -->
    <div
      class="w-48 shrink-0 border-r border-zinc-800 bg-zinc-900/50 overflow-y-auto p-3"
    >
      <button
        onclick={() => selectDimension(null)}
        class="block w-full rounded px-2.5 py-1.5 text-left text-sm mb-2 {!selectedDim
          ? 'bg-violet-600/20 text-violet-300'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}"
        >全部维度</button
      >

      {#each DIMENSIONS as dim}
        <button
          onclick={() => selectDimension(dim.id)}
          class="block w-full rounded px-2.5 py-1.5 text-left text-sm {selectedDim ===
          dim.id
            ? 'bg-violet-600/20 text-violet-300'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}"
          >{dim.zh}</button
        >
      {/each}
    </div>

    <!-- 右侧：概念列表 + 详情 -->
    <div class="flex-1 flex overflow-hidden">
      <!-- 概念列表 -->
      <div class="w-80 shrink-0 border-r border-zinc-800 overflow-y-auto p-4">
        <div class="flex items-center gap-2 mb-3">
          <input
            type="text"
            placeholder="搜索概念..."
            bind:value={searchQuery}
            oninput={() => loadConcepts()}
            class="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
          />
          <select
            bind:value={searchMode}
            onchange={() => searchQuery && loadConcepts()}
            class="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300"
          >
            <option value="keyword">关键词</option>
            <option value="semantic">语义</option>
          </select>
        </div>

        {#if loading}
          <div class="text-xs text-zinc-500">加载中...</div>
        {:else}
          {#each results as group}
            <div class="mb-3">
              <div class="text-xs font-medium text-zinc-500 mb-1">
                {group.subCategory}
              </div>
              {#each group.concepts as c}
                <button
                  onclick={() => selectConcept(c.name)}
                  class="block w-full rounded px-2 py-1.5 text-left text-xs {selectedConcept?.name ===
                  c.name
                    ? 'bg-violet-600/20 text-violet-300'
                    : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-200'}"
                >
                  <div>{c.nameZh || c.name}</div>
                  {#if c.score != null}
                    <div class="text-zinc-600">
                      {Math.round(c.score * 100)}%
                    </div>
                  {/if}
                </button>
              {/each}
            </div>
          {/each}
          {#if results.length === 0 && !loading}
            <div class="text-xs text-zinc-600">暂无结果</div>
          {/if}
        {/if}
      </div>

      <!-- 详情面板 -->
      <div class="flex-1 overflow-y-auto p-6">
        {#if selectedConcept}
          <div>
            <div class="flex items-center gap-2 mb-1">
              <h1 class="text-xl font-bold text-zinc-100">
                {selectedConcept.nameZh || selectedConcept.name}
              </h1>
              <span
                class="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500"
                >{selectedConcept.name}</span
              >
              <span
                class="rounded bg-violet-600/20 px-2 py-0.5 text-xs text-violet-400"
                >{selectedConcept.source}</span
              >
            </div>

            {#if selectedConcept.visualDescription}
              <div
                class="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4"
              >
                <h3 class="text-sm font-medium text-zinc-300 mb-2">视觉描述</h3>
                <p class="text-sm text-zinc-400 leading-relaxed">
                  {selectedConcept.visualDescription}
                </p>
              </div>
            {/if}

            {#if selectedConcept.tags.length > 0}
              <div
                class="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4"
              >
                <div class="flex items-center justify-between mb-2">
                  <h3 class="text-sm font-medium text-zinc-300">提示词标签</h3>
                  <button
                    onclick={() => copyText(selectedConcept!.tags.join(", "))}
                    class="rounded bg-violet-600 px-3 py-1 text-xs text-white hover:bg-violet-500"
                    >{copied ? "已复制!" : "复制全部"}</button
                  >
                </div>
                <div class="flex flex-wrap gap-1.5">
                  {#each selectedConcept.tags as tag}
                    <span
                      class="rounded bg-violet-600/20 px-2 py-0.5 text-xs text-violet-300"
                      >{tag}</span
                    >
                  {/each}
                </div>
                {#if selectedConcept.tagUsage}
                  <p class="mt-2 text-xs text-zinc-500">
                    {selectedConcept.tagUsage}
                  </p>
                {/if}
              </div>
            {/if}

            {#if selectedConcept.naturalLanguage}
              <div
                class="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4"
              >
                <div class="flex items-center justify-between mb-2">
                  <h3 class="text-sm font-medium text-zinc-300">
                    自然语言描述
                  </h3>
                  <button
                    onclick={() =>
                      copyText(selectedConcept!.naturalLanguage || "")}
                    class="rounded bg-violet-600 px-3 py-1 text-xs text-white hover:bg-violet-500"
                    >复制</button
                  >
                </div>
                <p class="text-sm text-zinc-400 leading-relaxed">
                  {selectedConcept.naturalLanguage}
                </p>
                {#if selectedConcept.nlUsage}
                  <p class="mt-2 text-xs text-zinc-500">
                    {selectedConcept.nlUsage}
                  </p>
                {/if}
              </div>
            {/if}

            {#if selectedConcept.relatedConcepts.length > 0}
              <div
                class="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4"
              >
                <h3 class="text-sm font-medium text-zinc-300 mb-2">关联概念</h3>
                <div class="flex flex-wrap gap-1.5">
                  {#each selectedConcept.relatedConcepts as rel}
                    <button
                      onclick={() => selectConcept(rel.name)}
                      class="rounded bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                      >{rel.nameZh || rel.name}</button
                    >
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {:else}
          <div class="flex h-full items-center justify-center text-zinc-600">
            选择左侧维度浏览概念，或搜索查找
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
