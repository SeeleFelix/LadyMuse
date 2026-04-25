<script lang="ts">
  import { onMount } from "svelte";

  let stats = $state({ categories: 0, techniques: 0, styles: 0, prompts: 0 });
  let quickResult = $state<any>(null);
  let quickLoading = $state(false);
  let quickMode = $state<"tag" | "nl">("tag");
  let copied = $state(false);

  onMount(async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) stats = await res.json();
    } catch {}
  });

  async function quickInspire() {
    quickLoading = true;
    const res = await fetch(`/api/inspiration?prompt_mode=${quickMode}`);
    if (res.ok) quickResult = await res.json();
    quickLoading = false;
  }

  function copyPrompt() {
    if (quickResult) {
      navigator.clipboard.writeText(quickResult.prompt.positive);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    }
  }
</script>

<div class="p-8">
  <!-- Hero -->
  <div class="text-center max-w-2xl mx-auto">
    <h1 class="text-4xl font-bold text-zinc-100">LadyMuse</h1>
    <p class="mt-3 text-lg text-zinc-400">ComfyUI 创作引导与提示词管理</p>
  </div>

  <!-- Quick inspire -->
  <div class="mt-8 max-w-3xl mx-auto">
    <div
      class="rounded-xl border border-violet-500/30 bg-violet-600/5 p-6 text-center"
    >
      <div class="flex justify-center gap-2 mb-4">
        <button
          onclick={() => (quickMode = "tag")}
          class="rounded-lg px-3 py-1 text-xs {quickMode === 'tag'
            ? 'bg-violet-600 text-white'
            : 'bg-zinc-800 text-zinc-400'}">标签 (SD)</button
        >
        <button
          onclick={() => (quickMode = "nl")}
          class="rounded-lg px-3 py-1 text-xs {quickMode === 'nl'
            ? 'bg-violet-600 text-white'
            : 'bg-zinc-800 text-zinc-400'}">自然语言 (FLUX)</button
        >
      </div>
      <button
        onclick={quickInspire}
        disabled={quickLoading}
        class="rounded-xl bg-violet-600 px-8 py-4 text-xl font-bold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
        >{quickLoading ? "生成中..." : "✦ 给我灵感"}</button
      >

      {#if quickResult}
        <div class="mt-4 rounded-lg bg-zinc-900 p-4 text-left">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-zinc-500">
              {quickResult.style?.name || "随机风格"} · {quickResult.techniques
                ?.map((t: any) => t.name)
                .join(" · ")}
            </span>
            <button
              onclick={copyPrompt}
              class="rounded bg-violet-600 px-3 py-1 text-xs text-white hover:bg-violet-500"
              >{copied ? "已复制!" : "复制"}</button
            >
          </div>
          <pre
            class="whitespace-pre-wrap text-sm text-zinc-200 leading-relaxed">{quickResult
              .prompt.positive}</pre>
        </div>
      {/if}
    </div>
  </div>

  <!-- Stats -->
  <div class="mt-8 max-w-3xl mx-auto grid grid-cols-4 gap-3">
    <div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
      <div class="text-xl font-bold text-violet-400">{stats.categories}</div>
      <div class="mt-1 text-xs text-zinc-500">艺术类别</div>
    </div>
    <div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
      <div class="text-xl font-bold text-violet-400">{stats.techniques}</div>
      <div class="mt-1 text-xs text-zinc-500">技法</div>
    </div>
    <div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
      <div class="text-xl font-bold text-violet-400">{stats.styles}</div>
      <div class="mt-1 text-xs text-zinc-500">风格</div>
    </div>
    <div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
      <div class="text-xl font-bold text-violet-400">{stats.prompts}</div>
      <div class="mt-1 text-xs text-zinc-500">已保存</div>
    </div>
  </div>

  <!-- Quick links -->
  <div class="mt-6 max-w-3xl mx-auto grid grid-cols-3 gap-3">
    <a
      href="/builder"
      class="group rounded-lg border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-violet-600 hover:bg-zinc-800"
    >
      <div class="text-xl">⚡</div>
      <div class="mt-2 font-semibold text-zinc-200 group-hover:text-violet-400">
        提示词构建器
      </div>
      <div class="mt-1 text-xs text-zinc-500">从艺术概念组装提示词</div>
    </a>
    <a
      href="/knowledge"
      class="group rounded-lg border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-violet-600 hover:bg-zinc-800"
    >
      <div class="text-xl">◈</div>
      <div class="mt-2 font-semibold text-zinc-200 group-hover:text-violet-400">
        知识探索器
      </div>
      <div class="mt-1 text-xs text-zinc-500">学习艺术词汇与技法</div>
    </a>
    <a
      href="/styles"
      class="group rounded-lg border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-violet-600 hover:bg-zinc-800"
    >
      <div class="text-xl">◆</div>
      <div class="mt-2 font-semibold text-zinc-200 group-hover:text-violet-400">
        风格画廊
      </div>
      <div class="mt-1 text-xs text-zinc-500">浏览与混搭艺术风格</div>
    </a>
  </div>
</div>
