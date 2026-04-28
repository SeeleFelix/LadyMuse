<script lang="ts">
  import { onMount } from "svelte";

  interface Prompt {
    id: number;
    title: string | null;
    positivePrompt: string;
    negativePrompt: string | null;
    notes: string | null;
    rating: number | null;
    tags: string | null;
    source: string | null;
    sampler: string | null;
    scheduler: string | null;
    steps: number | null;
    cfgScale: number | null;
    width: number | null;
    height: number | null;
    createdAt: string | null;
  }

  let prompts = $state<Prompt[]>([]);
  let selected = $state<Prompt | null>(null);
  let loading = $state(true);
  let search = $state("");
  let sortBy = $state<"date" | "rating">("date");
  let copied = $state(false);
  let editingRating = $state(false);
  let editing = $state(false);
  let saving = $state(false);
  let editForm = $state({
    title: "",
    positivePrompt: "",
    negativePrompt: "",
    notes: "",
    tags: "",
    sampler: "",
    scheduler: "",
    steps: "",
    cfgScale: "",
    width: "",
    height: "",
  });
  let showCreateForm = $state(false);
  let creating = $state(false);
  let newPrompt = $state({
    title: "",
    positive_prompt: "",
    negative_prompt: "",
    notes: "",
    tags: "",
    sampler: "",
    scheduler: "",
    steps: "",
    cfg_scale: "",
    width: "",
    height: "",
  });

  async function loadPrompts() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("sort", sortBy);
    const res = await fetch(`/api/prompts?${params}`);
    if (res.ok) prompts = await res.json();
    loading = false;
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  async function deletePrompt(id: number) {
    await fetch("/api/prompts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (selected?.id === id) selected = null;
    loadPrompts();
  }

  async function updateRating(id: number, rating: number) {
    await fetch("/api/prompts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        rating,
        positive_prompt: selected?.positivePrompt,
        negative_prompt: selected?.negativePrompt,
      }),
    });
    if (selected?.id === id) selected = { ...selected, rating };
    editingRating = false;
  }

  function startEdit() {
    if (!selected) return;
    editForm = {
      title: selected.title || "",
      positivePrompt: selected.positivePrompt,
      negativePrompt: selected.negativePrompt || "",
      notes: selected.notes || "",
      tags: selected.tags || "",
      sampler: selected.sampler || "",
      scheduler: selected.scheduler || "",
      steps: selected.steps?.toString() || "",
      cfgScale: selected.cfgScale?.toString() || "",
      width: selected.width?.toString() || "",
      height: selected.height?.toString() || "",
    };
    editing = true;
  }

  async function saveEdit() {
    if (!selected || !editForm.positivePrompt.trim()) return;
    saving = true;
    try {
      const body: Record<string, any> = {
        id: selected.id,
        title: editForm.title || null,
        positive_prompt: editForm.positivePrompt,
        negative_prompt: editForm.negativePrompt || null,
        notes: editForm.notes || null,
        tags: editForm.tags || null,
      };
      if (editForm.sampler) body.sampler = editForm.sampler;
      if (editForm.scheduler) body.scheduler = editForm.scheduler;
      if (editForm.steps) body.steps = parseInt(editForm.steps);
      if (editForm.cfgScale) body.cfg_scale = parseFloat(editForm.cfgScale);
      if (editForm.width) body.width = parseInt(editForm.width);
      if (editForm.height) body.height = parseInt(editForm.height);

      const res = await fetch("/api/prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        selected = {
          ...selected!,
          title: editForm.title || null,
          positivePrompt: editForm.positivePrompt,
          negativePrompt: editForm.negativePrompt || null,
          notes: editForm.notes || null,
          tags: editForm.tags || null,
          sampler: editForm.sampler || null,
          scheduler: editForm.scheduler || null,
          steps: editForm.steps ? parseInt(editForm.steps) : null,
          cfgScale: editForm.cfgScale ? parseFloat(editForm.cfgScale) : null,
          width: editForm.width ? parseInt(editForm.width) : null,
          height: editForm.height ? parseInt(editForm.height) : null,
        };
        editing = false;
        loadPrompts();
      }
    } finally {
      saving = false;
    }
  }

  async function createPrompt() {
    if (!newPrompt.positive_prompt.trim()) return;
    creating = true;
    try {
      const body: Record<string, any> = {
        title: newPrompt.title || null,
        positive_prompt: newPrompt.positive_prompt,
        negative_prompt: newPrompt.negative_prompt || null,
        notes: newPrompt.notes || null,
        tags: newPrompt.tags || null,
        source: "manual",
      };
      if (newPrompt.sampler) body.sampler = newPrompt.sampler;
      if (newPrompt.scheduler) body.scheduler = newPrompt.scheduler;
      if (newPrompt.steps) body.steps = parseInt(newPrompt.steps);
      if (newPrompt.cfg_scale) body.cfg_scale = parseFloat(newPrompt.cfg_scale);
      if (newPrompt.width) body.width = parseInt(newPrompt.width);
      if (newPrompt.height) body.height = parseInt(newPrompt.height);

      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const created = await res.json();
        newPrompt = {
          title: "",
          positive_prompt: "",
          negative_prompt: "",
          notes: "",
          tags: "",
          sampler: "",
          scheduler: "",
          steps: "",
          cfg_scale: "",
          width: "",
          height: "",
        };
        showCreateForm = false;
        await loadPrompts();
        selected = created;
      }
    } finally {
      creating = false;
    }
  }

  let searchTimer: ReturnType<typeof setTimeout>;
  function onSearchInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadPrompts, 300);
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

  function renderStars(rating: number | null): string {
    if (!rating) return "";
    return "★".repeat(rating) + "☆".repeat(5 - rating);
  }

  onMount(loadPrompts);
</script>

<div class="flex h-full">
  <!-- Left: list -->
  <div
    class="w-80 shrink-0 border-r border-zinc-800 bg-zinc-900/50 flex flex-col"
  >
    <div class="p-4 border-b border-zinc-800">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold text-zinc-200">提示词库</h2>
        <div class="flex items-center gap-2">
          <button
            onclick={() => (showCreateForm = !showCreateForm)}
            class="rounded-lg border border-dashed {showCreateForm
              ? 'border-violet-500 text-violet-400'
              : 'border-zinc-700 text-zinc-400'} px-2.5 py-1 text-xs hover:border-violet-500 hover:text-violet-400 transition-colors"
          >
            {showCreateForm ? "取消" : "+ 新建"}
          </button>
          <span class="text-xs text-zinc-500">{prompts.length} 条</span>
        </div>
      </div>

      {#if showCreateForm}
        <div class="space-y-3">
          <div>
            <label class="text-xs text-zinc-400 mb-1 block">标题（可选）</label>
            <input
              type="text"
              bind:value={newPrompt.title}
              placeholder="为提示词命名..."
              class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="text-xs text-zinc-400 mb-1 block">正向提示词 *</label>
            <textarea
              bind:value={newPrompt.positive_prompt}
              placeholder="masterpiece, best quality, ..."
              rows="4"
              class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 placeholder-zinc-500 focus:border-violet-500 focus:outline-none resize-none"
            ></textarea>
          </div>
          <div>
            <label class="text-xs text-zinc-400 mb-1 block">反向提示词</label>
            <textarea
              bind:value={newPrompt.negative_prompt}
              placeholder="lowres, bad anatomy, ..."
              rows="2"
              class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 placeholder-zinc-500 focus:border-violet-500 focus:outline-none resize-none"
            ></textarea>
          </div>
          <input
            type="text"
            bind:value={newPrompt.tags}
            placeholder="标签（逗号分隔）"
            class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
          />
          <textarea
            bind:value={newPrompt.notes}
            placeholder="备注..."
            rows="2"
            class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 placeholder-zinc-500 focus:border-violet-500 focus:outline-none resize-none"
          ></textarea>
          <details>
            <summary
              class="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300"
              >生成参数（可选）</summary
            >
            <div class="mt-2 grid grid-cols-2 gap-2">
              <input
                type="text"
                bind:value={newPrompt.sampler}
                placeholder="Sampler"
                class="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
              />
              <input
                type="text"
                bind:value={newPrompt.scheduler}
                placeholder="Scheduler"
                class="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
              />
              <input
                type="number"
                bind:value={newPrompt.steps}
                placeholder="Steps"
                class="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
              />
              <input
                type="number"
                bind:value={newPrompt.cfg_scale}
                placeholder="CFG Scale"
                class="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
              />
              <input
                type="number"
                bind:value={newPrompt.width}
                placeholder="Width"
                class="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
              />
              <input
                type="number"
                bind:value={newPrompt.height}
                placeholder="Height"
                class="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
              />
            </div>
          </details>
          <button
            onclick={createPrompt}
            disabled={!newPrompt.positive_prompt.trim() || creating}
            class="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? "保存中..." : "保存提示词"}
          </button>
        </div>
      {:else}
        <input
          type="text"
          bind:value={search}
          oninput={onSearchInput}
          placeholder="搜索提示词..."
          class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
        />
        <div class="flex gap-2 mt-2">
          <button
            onclick={() => {
              sortBy = "date";
              loadPrompts();
            }}
            class="rounded px-2.5 py-1 text-xs {sortBy === 'date'
              ? 'bg-violet-600/20 text-violet-300'
              : 'text-zinc-500 hover:text-zinc-300'}">按时间</button
          >
          <button
            onclick={() => {
              sortBy = "rating";
              loadPrompts();
            }}
            class="rounded px-2.5 py-1 text-xs {sortBy === 'rating'
              ? 'bg-violet-600/20 text-violet-300'
              : 'text-zinc-500 hover:text-zinc-300'}">按评分</button
          >
        </div>
      {/if}
    </div>

    <div class="flex-1 overflow-y-auto p-3 space-y-2">
      {#if loading}
        <div class="text-zinc-500 text-sm p-4">加载中...</div>
      {:else if prompts.length === 0}
        <div class="text-zinc-600 text-sm text-center py-8">
          {search ? "没有匹配的提示词" : "还没有保存的提示词"}
        </div>
      {:else}
        {#each prompts as p}
          <button
            onclick={() => {
              selected = p;
              editing = false;
            }}
            class="w-full text-left rounded-lg border {selected?.id === p.id
              ? 'border-violet-500/50 bg-violet-600/10'
              : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'} p-3 transition-colors"
          >
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-zinc-200 truncate flex-1"
                >{p.title || "未命名"}</span
              >
              <span class="text-xs text-zinc-600 ml-2 shrink-0"
                >{p.source === "agent" ? "AI" : "手动"}</span
              >
            </div>
            <p class="mt-1 text-xs text-zinc-500 line-clamp-2">
              {p.positivePrompt.slice(0, 80)}
            </p>
            <div class="mt-2 flex items-center justify-between">
              {#if p.rating}
                <span class="text-xs text-amber-400"
                  >{renderStars(p.rating)}</span
                >
              {:else}
                <span class="text-xs text-zinc-700">未评分</span>
              {/if}
              <span class="text-xs text-zinc-600"
                >{formatDate(p.createdAt)}</span
              >
            </div>
          </button>
        {/each}
      {/if}
    </div>
  </div>

  <!-- Right: detail -->
  <div class="flex-1 overflow-y-auto p-6">
    {#if selected}
      <div>
        <div class="flex items-start justify-between">
          <div>
            <h1 class="text-2xl font-bold text-zinc-100">
              {selected.title || "未命名"}
            </h1>
            <div class="flex items-center gap-3 mt-1">
              <span class="text-xs text-zinc-500"
                >{selected.source === "agent" ? "AI 生成" : "手动创建"}</span
              >
              <span class="text-xs text-zinc-600"
                >{formatDate(selected.createdAt)}</span
              >
            </div>
          </div>
          <div class="flex gap-2">
            {#if !editing}
              <button
                onclick={startEdit}
                class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-violet-400 hover:bg-violet-600/10 hover:border-violet-500/50"
                >编辑</button
              >
            {/if}
            <button
              onclick={() => {
                if (confirm("确定删除？")) deletePrompt(selected!.id);
              }}
              class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-red-400 hover:bg-red-600/10 hover:border-red-500/50"
              >删除</button
            >
          </div>
        </div>

        {#if editing}
          <!-- Edit form -->
          <div class="mt-4 space-y-4">
            <div>
              <label class="text-xs text-zinc-400 mb-1 block">标题</label>
              <input
                type="text"
                bind:value={editForm.title}
                placeholder="为提示词命名..."
                class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
              />
            </div>
            <div>
              <label class="text-xs text-zinc-400 mb-1 block"
                >正向提示词 *</label
              >
              <textarea
                bind:value={editForm.positivePrompt}
                rows="6"
                class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-violet-300 placeholder-zinc-500 focus:border-violet-500 focus:outline-none resize-y"
              ></textarea>
            </div>
            <div>
              <label class="text-xs text-zinc-400 mb-1 block">反向提示词</label>
              <textarea
                bind:value={editForm.negativePrompt}
                rows="3"
                class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-red-300/70 placeholder-zinc-500 focus:border-violet-500 focus:outline-none resize-y"
              ></textarea>
            </div>
            <div>
              <label class="text-xs text-zinc-400 mb-1 block"
                >标签（逗号分隔）</label
              >
              <input
                type="text"
                bind:value={editForm.tags}
                placeholder="标签1, 标签2, ..."
                class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
              />
            </div>
            <div>
              <label class="text-xs text-zinc-400 mb-1 block">备注</label>
              <textarea
                bind:value={editForm.notes}
                rows="3"
                class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-400 placeholder-zinc-500 focus:border-violet-500 focus:outline-none resize-y"
              ></textarea>
            </div>
            <details>
              <summary
                class="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300"
                >生成参数</summary
              >
              <div class="mt-2 grid grid-cols-3 gap-2">
                <input
                  type="text"
                  bind:value={editForm.sampler}
                  placeholder="Sampler"
                  class="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
                />
                <input
                  type="text"
                  bind:value={editForm.scheduler}
                  placeholder="Scheduler"
                  class="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
                />
                <input
                  type="number"
                  bind:value={editForm.steps}
                  placeholder="Steps"
                  class="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
                />
                <input
                  type="number"
                  bind:value={editForm.cfgScale}
                  placeholder="CFG Scale"
                  class="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
                />
                <input
                  type="number"
                  bind:value={editForm.width}
                  placeholder="Width"
                  class="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
                />
                <input
                  type="number"
                  bind:value={editForm.height}
                  placeholder="Height"
                  class="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
                />
              </div>
            </details>
            <div class="flex gap-3">
              <button
                onclick={saveEdit}
                disabled={!editForm.positivePrompt.trim() || saving}
                class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "保存中..." : "保存"}
              </button>
              <button
                onclick={() => (editing = false)}
                class="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
                >取消</button
              >
            </div>
          </div>
        {:else}
          <!-- Rating -->
          <div class="mt-4">
            {#if editingRating}
              <div class="flex gap-1">
                {#each [1, 2, 3, 4, 5] as r}
                  <button
                    onclick={() => updateRating(selected!.id, r)}
                    class="text-lg {r <= (selected?.rating ?? 0)
                      ? 'text-amber-400'
                      : 'text-zinc-600'} hover:text-amber-300">★</button
                  >
                {/each}
                <button
                  onclick={() => (editingRating = false)}
                  class="ml-2 text-xs text-zinc-500">取消</button
                >
              </div>
            {:else}
              <button
                onclick={() => (editingRating = true)}
                class="text-sm {selected.rating
                  ? 'text-amber-400'
                  : 'text-zinc-600 hover:text-zinc-400'}"
              >
                {selected.rating ? renderStars(selected.rating) : "点击评分"}
              </button>
            {/if}
          </div>

          <!-- Positive prompt -->
          <div class="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-medium text-zinc-300">正向提示词</h3>
              <button
                onclick={() => copyText(selected!.positivePrompt)}
                class="rounded bg-violet-600 px-3 py-1 text-xs text-white hover:bg-violet-500"
                >{copied ? "已复制!" : "复制"}</button
              >
            </div>
            <pre
              class="whitespace-pre-wrap text-xs text-violet-300 leading-relaxed">{selected.positivePrompt}</pre>
          </div>

          <!-- Negative prompt -->
          {#if selected.negativePrompt}
            <div class="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <div class="flex items-center justify-between mb-2">
                <h3 class="text-sm font-medium text-zinc-300">反向提示词</h3>
                <button
                  onclick={() => copyText(selected!.negativePrompt!)}
                  class="rounded bg-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
                  >复制</button
                >
              </div>
              <pre
                class="whitespace-pre-wrap text-xs text-red-300/70 leading-relaxed">{selected.negativePrompt}</pre>
            </div>
          {/if}

          <!-- Generation params -->
          {#if selected.sampler || selected.steps || selected.cfgScale || selected.width}
            <div class="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <h3 class="text-sm font-medium text-zinc-300 mb-3">生成参数</h3>
              <div class="grid grid-cols-3 gap-3">
                {#if selected.sampler}
                  <div class="text-xs">
                    <span class="text-zinc-500">Sampler:</span>
                    <span class="text-zinc-200">{selected.sampler}</span>
                  </div>
                {/if}
                {#if selected.scheduler}
                  <div class="text-xs">
                    <span class="text-zinc-500">Scheduler:</span>
                    <span class="text-zinc-200">{selected.scheduler}</span>
                  </div>
                {/if}
                {#if selected.steps}
                  <div class="text-xs">
                    <span class="text-zinc-500">Steps:</span>
                    <span class="text-zinc-200">{selected.steps}</span>
                  </div>
                {/if}
                {#if selected.cfgScale}
                  <div class="text-xs">
                    <span class="text-zinc-500">CFG:</span>
                    <span class="text-zinc-200">{selected.cfgScale}</span>
                  </div>
                {/if}
                {#if selected.width && selected.height}
                  <div class="text-xs">
                    <span class="text-zinc-500">分辨率:</span>
                    <span class="text-zinc-200"
                      >{selected.width}×{selected.height}</span
                    >
                  </div>
                {/if}
              </div>
            </div>
          {/if}

          <!-- Tags -->
          {#if selected.tags}
            <div class="mt-4">
              <h3 class="text-sm font-medium text-zinc-300 mb-2">标签</h3>
              <div class="flex flex-wrap gap-1.5">
                {#each selected.tags
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

          <!-- Notes -->
          {#if selected.notes}
            <div class="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <h3 class="text-sm font-medium text-zinc-300 mb-2">备注</h3>
              <p class="text-xs text-zinc-400 leading-relaxed">
                {selected.notes}
              </p>
            </div>
          {/if}
        {/if}
      </div>
    {:else}
      <div class="flex h-full items-center justify-center text-zinc-600">
        从左侧选择一个提示词查看详情
      </div>
    {/if}
  </div>
</div>
