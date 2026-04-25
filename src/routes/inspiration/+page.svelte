<script lang="ts">
  let promptMode = $state<"tag" | "nl">("tag");
  let result = $state<any>(null);
  let loading = $state(false);
  let copiedPos = $state(false);
  let copiedNeg = $state(false);
  let lastMood = $state("");

  const moods: Record<string, string> = {
    dramatic: "戏剧性",
    peaceful: "宁静",
    energetic: "活力",
    mysterious: "神秘",
    romantic: "浪漫",
    dark: "暗黑",
    bright: "明亮",
    warm: "温暖",
    cool: "清冷",
    dreamy: "梦幻",
    futuristic: "未来感",
    ethereal: "空灵",
  };

  async function generateRandom() {
    loading = true;
    lastMood = "";
    const res = await fetch(`/api/inspiration?prompt_mode=${promptMode}`);
    if (res.ok) result = await res.json();
    loading = false;
  }

  async function generateMood(mood: string) {
    loading = true;
    lastMood = mood;
    const res = await fetch(
      `/api/inspiration?mode=mood&mood=${mood}&prompt_mode=${promptMode}`,
    );
    if (res.ok) result = await res.json();
    loading = false;
  }

  async function generateMix() {
    loading = true;
    lastMood = "";
    const res = await fetch(
      `/api/inspiration?mode=mix&prompt_mode=${promptMode}`,
    );
    if (res.ok) result = await res.json();
    loading = false;
  }

  function copy(text: string, type: "pos" | "neg") {
    navigator.clipboard.writeText(text);
    if (type === "pos") {
      copiedPos = true;
      setTimeout(() => (copiedPos = false), 2000);
    } else {
      copiedNeg = true;
      setTimeout(() => (copiedNeg = false), 2000);
    }
  }
</script>

<div class="p-8 max-w-4xl mx-auto">
  <h1 class="text-3xl font-bold text-zinc-100">灵感引擎</h1>
  <p class="mt-2 text-zinc-400">不知道画什么？一键生成创意提示词</p>

  <!-- Mode toggle -->
  <div class="mt-6 flex items-center gap-3">
    <span class="text-sm text-zinc-400">提示词格式：</span>
    <button
      onclick={() => (promptMode = "tag")}
      class="rounded-lg px-3 py-1.5 text-sm {promptMode === 'tag'
        ? 'bg-violet-600 text-white'
        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}"
      >标签模式 (SD1.5/SDXL)</button
    >
    <button
      onclick={() => (promptMode = "nl")}
      class="rounded-lg px-3 py-1.5 text-sm {promptMode === 'nl'
        ? 'bg-violet-600 text-white'
        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}"
      >自然语言 (FLUX/SD3)</button
    >
  </div>

  <!-- Action buttons -->
  <div class="mt-6 space-y-4">
    <!-- Random -->
    <button
      onclick={generateRandom}
      disabled={loading}
      class="w-full rounded-xl border border-violet-500/30 bg-violet-600/10 px-6 py-5 text-lg font-semibold text-violet-300 transition-colors hover:bg-violet-600/20 hover:border-violet-500 disabled:opacity-50"
    >
      {loading ? "生成中..." : "✦ 给我灵感"}
    </button>

    <!-- Mood selection -->
    <div>
      <h3 class="text-sm font-medium text-zinc-300 mb-2">按情绪生成</h3>
      <div class="flex flex-wrap gap-2">
        {#each Object.entries(moods) as [key, label]}
          <button
            onclick={() => generateMood(key)}
            disabled={loading}
            class="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-violet-500 hover:text-violet-300 disabled:opacity-50 {lastMood ===
            key
              ? 'border-violet-500 text-violet-300 bg-violet-600/10'
              : ''}">{label}</button
          >
        {/each}
      </div>
    </div>

    <!-- Style mix -->
    <button
      onclick={generateMix}
      disabled={loading}
      class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-300 transition-colors hover:border-violet-500 hover:text-violet-300 disabled:opacity-50"
      >◆ 随机风格混搭</button
    >
  </div>

  <!-- Result -->
  {#if result}
    <div class="mt-8 space-y-4">
      <!-- Meta info -->
      <div class="flex flex-wrap gap-2">
        <span class="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400"
          >主体: {result.subject}</span
        >
        {#if result.style}
          <span
            class="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400"
          >
            风格: {result.style.name}{#if result.style.mixWith}
              + {result.style.mixWith}{/if}
          </span>
        {/if}
        {#each result.techniques as tech}
          <span
            class="rounded-full bg-violet-600/20 px-3 py-1 text-xs text-violet-300"
            >{tech.name}</span
          >
        {/each}
      </div>

      <!-- Positive prompt -->
      <div class="rounded-lg border border-violet-600/30 bg-zinc-900 p-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-medium text-zinc-300">正向提示词</h3>
          <button
            onclick={() => copy(result.prompt.positive, "pos")}
            class="rounded bg-violet-600 px-3 py-1 text-xs text-white hover:bg-violet-500"
            >{copiedPos ? "已复制!" : "复制"}</button
          >
        </div>
        <pre
          class="whitespace-pre-wrap text-sm text-zinc-200 leading-relaxed">{result
            .prompt.positive}</pre>
      </div>

      {#if result.prompt.negative}
        <div class="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-medium text-zinc-300">反向提示词</h3>
            <button
              onclick={() => copy(result.prompt.negative, "neg")}
              class="rounded bg-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
              >{copiedNeg ? "已复制!" : "复制"}</button
            >
          </div>
          <pre
            class="whitespace-pre-wrap text-sm text-red-300/70 leading-relaxed">{result
              .prompt.negative}</pre>
        </div>
      {/if}
    </div>
  {/if}
</div>
