<script lang="ts">
  interface DanbooruStatus {
    total: number;
    embedded: number;
  }

  let status = $state<DanbooruStatus>({ total: 0, embedded: 0 });
  let syncing = $state<"" | "import" | "embed">("");
  let error = $state("");
  let progress = $state<{
    percent: number;
    done: number;
    total: number;
  } | null>(null);
  let sse: EventSource | null = null;

  function connectSSE() {
    sse = new EventSource("/api/knowledge/sync/progress");
    sse.addEventListener("progress", (e) => {
      const data = JSON.parse(e.data);
      if (data.running) {
        progress = {
          percent: data.percent,
          done: data.done,
          total: data.total,
        };
      } else {
        progress = null;
        loadStatus();
      }
    });
    sse.onerror = () => {
      sse?.close();
      setTimeout(connectSSE, 3000);
    };
  }

  async function loadStatus() {
    try {
      const res = await fetch("/api/knowledge/danbooru/status");
      if (res.ok) status = await res.json();
    } catch (e: any) {
      error = e.message;
    }
  }

  async function importData() {
    syncing = "import";
    error = "";
    try {
      const res = await fetch("/api/knowledge/danbooru/import", {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        error = data.error || "Import failed";
      }
      await loadStatus();
    } catch (e: any) {
      error = e.message;
    } finally {
      syncing = "";
    }
  }

  async function embedData() {
    syncing = "embed";
    error = "";
    try {
      await fetch("/api/knowledge/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "danbooru" }),
      });
      await loadStatus();
    } catch (e: any) {
      error = e.message;
    } finally {
      syncing = "";
    }
  }

  let embedPercent = $derived(
    status.total > 0 ? Math.round((status.embedded / status.total) * 100) : 0,
  );

  $effect(() => {
    loadStatus();
    connectSSE();
    return () => sse?.close();
  });
</script>

<div class="h-full overflow-y-auto">
  <div class="mx-auto max-w-2xl px-6 py-8 space-y-5">
    <h1 class="text-xl font-semibold text-zinc-100">Danbooru 标签库</h1>

    <p class="text-xs text-zinc-500">
      从 BigQuery 导出 JSONL 文件放入 <code class="text-zinc-400"
        >data/danbooru/</code
      >， 然后导入并生成向量。详见
      <a
        href="/docs/danbooru-import.md"
        target="_blank"
        class="text-violet-400 hover:text-violet-300">导出指引</a
      >
    </p>

    {#if error}
      <div
        class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-400"
      >
        {error}
      </div>
    {/if}

    <!-- Status -->
    <section class="rounded-lg border border-zinc-800/60 bg-zinc-900/50">
      <div
        class="flex items-center gap-3 border-b border-zinc-800/40 px-5 py-3"
      >
        <span class="text-sm font-medium text-zinc-200">数据状态</span>
      </div>
      <div class="p-5 space-y-3">
        <div class="flex justify-between text-xs">
          <span class="text-zinc-500">已导入标签</span>
          <span class="text-zinc-300">{status.total.toLocaleString()}</span>
        </div>
        <div class="flex justify-between text-xs">
          <span class="text-zinc-500">已向量化</span>
          <span class="text-zinc-300"
            >{status.embedded.toLocaleString()} ({embedPercent}%)</span
          >
        </div>
        {#if status.total > 0}
          <div class="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              class="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style="width: {embedPercent}%"
            ></div>
          </div>
        {/if}
      </div>
    </section>

    <!-- Progress -->
    {#if progress}
      <section class="rounded-lg border border-zinc-800/60 bg-zinc-900/50">
        <div
          class="flex items-center gap-3 border-b border-zinc-800/40 px-5 py-3"
        >
          <span class="text-sm font-medium text-zinc-200">向量生成进度</span>
        </div>
        <div class="p-5 space-y-2">
          <div class="flex justify-between text-xs">
            <span class="text-zinc-500"
              >{progress.done.toLocaleString()} / {progress.total.toLocaleString()}
              标签</span
            >
            <span class="text-emerald-400">{progress.percent}%</span>
          </div>
          <div class="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              class="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style="width: {progress.percent}%"
            ></div>
          </div>
        </div>
      </section>
    {/if}

    <!-- Actions -->
    <section class="rounded-lg border border-zinc-800/60 bg-zinc-900/50">
      <div
        class="flex items-center gap-3 border-b border-zinc-800/40 px-5 py-3"
      >
        <span class="text-sm font-medium text-zinc-200">操作</span>
      </div>
      <div class="p-5 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-zinc-300">导入标签</p>
            <p class="text-[10px] text-zinc-600">
              读取 data/danbooru/ 下的 JSONL，join 并存入数据库（~50k 条）
            </p>
          </div>
          <button
            onclick={importData}
            disabled={syncing !== ""}
            class="rounded-md bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40 transition-colors"
          >
            {syncing === "import" ? "导入中..." : "导入标签"}
          </button>
        </div>
        <div class="border-t border-zinc-800/40 pt-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-zinc-300">生成向量</p>
              <p class="text-[10px] text-zinc-600">
                为已导入的标签生成 Embedding，支持断点续传
              </p>
            </div>
            <button
              onclick={embedData}
              disabled={syncing !== "" || status.total === 0}
              class="rounded-md bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors"
            >
              {syncing === "embed" ? "生成中..." : "生成向量"}
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</div>
