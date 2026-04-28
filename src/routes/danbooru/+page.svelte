<script lang="ts">
  interface TopicStatus {
    topic: string;
    tagCount: number;
    descriptionsFetched: number;
    descriptionsPending: number;
    lastSyncedAt: string | null;
  }

  let statuses = $state<TopicStatus[]>([]);
  let syncing = $state("");
  let error = $state("");
  let syncResult = $state<any>(null);

  const TOPIC_LABELS: Record<string, string> = {
    lighting: "光影",
    composition: "构图",
    posture: "姿态",
    colors: "色彩",
    aesthetic: "美学风格",
    background: "背景",
    gestures: "手势",
    focus: "景深/对焦",
  };

  async function loadStatus() {
    try {
      const res = await fetch("/api/danbooru?action=status");
      if (res.ok) {
        statuses = await res.json();
      }
    } catch (e: any) {
      error = e.message;
    }
  }

  async function syncStructure() {
    syncing = "structure";
    error = "";
    syncResult = null;
    try {
      const res = await fetch("/api/danbooru/sync?type=structure", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        error = data.error;
      } else {
        syncResult = data;
        await loadStatus();
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      syncing = "";
    }
  }

  async function syncDescriptions() {
    syncing = "descriptions";
    error = "";
    syncResult = null;
    try {
      const res = await fetch("/api/danbooru/sync?type=descriptions", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        error = data.error;
      } else {
        syncResult = data;
        await loadStatus();
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      syncing = "";
    }
  }

  let expandedTopic = $state<string | null>(null);
  let expandedTags = $state<any>(null);
  let loadingTags = $state(false);

  async function toggleTopic(topic: string) {
    if (expandedTopic === topic) {
      expandedTopic = null;
      expandedTags = null;
      return;
    }
    expandedTopic = topic;
    expandedTags = null;
    loadingTags = true;
    try {
      const res = await fetch(`/api/danbooru?action=tags&topic=${topic}`);
      if (res.ok) {
        expandedTags = await res.json();
      }
    } catch {
      expandedTags = null;
    } finally {
      loadingTags = false;
    }
  }

  let totalTags = $derived(statuses.reduce((s, t) => s + t.tagCount, 0));
  let totalFetched = $derived(
    statuses.reduce((s, t) => s + t.descriptionsFetched, 0),
  );
  let totalPending = $derived(
    statuses.reduce((s, t) => s + t.descriptionsPending, 0),
  );
  let descPercent = $derived(
    totalTags > 0 ? Math.round((totalFetched / totalTags) * 100) : 0,
  );

  $effect(() => {
    loadStatus();
  });

  function groupBySection(tags: any[]) {
    const map = new Map<string, any[]>();
    for (const tag of tags) {
      const sec = tag.section || "";
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(tag);
    }
    return Array.from(map.entries()).map(([section, tags]) => ({
      section,
      tags,
    }));
  }
</script>

<div class="h-full overflow-y-auto">
  <div class="mx-auto max-w-3xl px-6 py-8 space-y-5">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold text-zinc-100">Danbooru 数据同步</h1>
      <a
        href="/settings"
        class="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >← 返回设置</a
      >
    </div>

    {#if error}
      <div
        class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-400"
      >
        {error}
      </div>
    {/if}

    {#if syncResult}
      <div
        class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-400"
      >
        {#if syncResult.topics}
          结构同步完成：{syncResult.topics
            ?.map((t: any) => `${t.topic} +${t.tagsAdded}`)
            .join(", ")}
          （共 {syncResult.totalTags} 个标签）
        {:else}
          描述同步完成：获取 {syncResult.fetched} 个，{syncResult.failed} 个无描述，{syncResult.remaining}
          个待处理
        {/if}
      </div>
    {/if}

    <!-- Actions -->
    <section class="rounded-lg border border-zinc-800/60 bg-zinc-900/50">
      <div
        class="flex items-center gap-3 border-b border-zinc-800/40 px-5 py-3"
      >
        <div
          class="flex h-7 w-7 items-center justify-center rounded-md bg-orange-500/10 text-xs"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="text-orange-400"
          >
            <path d="M21 12a9 9 0 11-6.219-8.56" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
        </div>
        <h2 class="text-sm font-medium text-zinc-200">同步操作</h2>
      </div>
      <div class="p-5 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-zinc-300">结构同步</p>
            <p class="text-[10px] text-zinc-600">
              拉取 8 个标签组 wiki 页面（~8 次 API 调用）
            </p>
          </div>
          <button
            onclick={syncStructure}
            disabled={syncing !== ""}
            class="rounded-md bg-orange-600 px-4 py-2 text-xs font-medium text-white hover:bg-orange-500 disabled:opacity-40 transition-colors"
          >
            {syncing === "structure" ? "同步中..." : "同步结构"}
          </button>
        </div>
        <div class="border-t border-zinc-800/40 pt-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs text-zinc-300">描述同步</p>
              <p class="text-[10px] text-zinc-600">
                增量拉取 50 个标签的 wiki 描述（限速 1/秒）
              </p>
            </div>
            <button
              onclick={syncDescriptions}
              disabled={syncing !== "" || totalPending === 0}
              class="rounded-md bg-orange-600 px-4 py-2 text-xs font-medium text-white hover:bg-orange-500 disabled:opacity-40 transition-colors"
            >
              {syncing === "descriptions"
                ? "拉取中..."
                : `同步描述 (${totalPending} 待处理)`}
            </button>
          </div>
        </div>

        <!-- Progress bar -->
        {#if totalTags > 0}
          <div class="border-t border-zinc-800/40 pt-4">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-[10px] text-zinc-500">描述进度</span>
              <span class="text-[10px] text-zinc-400"
                >{totalFetched}/{totalTags} ({descPercent}%)</span
              >
            </div>
            <div class="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                class="h-full rounded-full bg-orange-500 transition-all duration-500"
                style="width: {descPercent}%"
              ></div>
            </div>
          </div>
        {/if}
      </div>
    </section>

    <!-- Topics Overview -->
    <section class="rounded-lg border border-zinc-800/60 bg-zinc-900/50">
      <div
        class="flex items-center gap-3 border-b border-zinc-800/40 px-5 py-3"
      >
        <div
          class="flex h-7 w-7 items-center justify-center rounded-md bg-sky-500/10 text-xs"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="text-sky-400"
          >
            <path
              d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"
            />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
        </div>
        <h2 class="text-sm font-medium text-zinc-200">标签组概览</h2>
        <span class="text-[11px] text-zinc-600">{statuses.length} 个领域</span>
      </div>
      <div class="divide-y divide-zinc-800/40">
        {#each statuses as s}
          {@const percent =
            s.tagCount > 0
              ? Math.round((s.descriptionsFetched / s.tagCount) * 100)
              : 0}
          <div>
            <button
              onclick={() => toggleTopic(s.topic)}
              class="flex items-center gap-4 px-5 py-3 w-full text-left hover:bg-zinc-800/30 transition-colors"
            >
              <span
                class="text-[10px] text-zinc-600 transition-transform duration-200 {expandedTopic ===
                s.topic
                  ? 'rotate-90'
                  : ''}">&#9654;</span
              >
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-medium text-zinc-300"
                    >{TOPIC_LABELS[s.topic] || s.topic}</span
                  >
                  <span class="text-[10px] text-zinc-600">{s.topic}</span>
                </div>
                <div class="mt-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    class="h-full rounded-full bg-sky-500/60 transition-all duration-300"
                    style="width: {percent}%"
                  ></div>
                </div>
              </div>
              <div class="text-right shrink-0">
                <div class="text-xs text-zinc-400">{s.tagCount} 个标签</div>
                <div class="text-[10px] text-zinc-600">
                  {s.descriptionsFetched}/{s.tagCount} 描述
                </div>
              </div>
              <div class="text-right shrink-0 w-28">
                {#if s.lastSyncedAt}
                  <div class="text-[10px] text-zinc-600">
                    {new Date(s.lastSyncedAt).toLocaleString("zh-CN")}
                  </div>
                {:else}
                  <div class="text-[10px] text-zinc-700">未同步</div>
                {/if}
              </div>
            </button>

            {#if expandedTopic === s.topic}
              <div class="px-5 pb-4 pl-10">
                {#if loadingTags}
                  <p class="text-[10px] text-zinc-600">加载中...</p>
                {:else if expandedTags?.tags}
                  {@const sections = groupBySection(expandedTags.tags)}
                  {#each sections as sec}
                    <div class="mb-3">
                      <p class="text-[10px] font-medium text-zinc-500 mb-1">
                        {sec.section || "(未分类)"}
                      </p>
                      <div class="flex flex-wrap gap-1">
                        {#each sec.tags as tag}
                          <span
                            class="inline-block rounded px-1.5 py-0.5 text-[10px] {tag.description
                              ? 'bg-zinc-800 text-zinc-300'
                              : 'bg-zinc-800/50 text-zinc-500'}"
                            title={tag.description || ""}
                          >
                            {tag.tagName}
                            {#if tag.postCount != null}
                              <span class="text-zinc-600"
                                >({tag.postCount})</span
                              >
                            {/if}
                          </span>
                        {/each}
                      </div>
                    </div>
                  {/each}
                {:else if expandedTags?.notice}
                  <p class="text-[10px] text-zinc-600">{expandedTags.notice}</p>
                {:else}
                  <p class="text-[10px] text-zinc-600">暂无数据</p>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </section>
  </div>
</div>
