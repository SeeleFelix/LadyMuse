<script lang="ts">
  let openrouterKey = $state("");
  let deepseekKey = $state("");
  let searxngUrl = $state("");
  let comfyuiOutputDir = $state("");
  let defaultModel = $state("");
  let favoriteModels = $state<string[]>([]);
  let models = $state<
    { id: string; name: string; provider: string; description?: string }[]
  >([]);
  let refreshingProvider = $state("");
  let savingProvider = $state("");
  let savingSearxng = $state(false);
  let savingComfyui = $state(false);
  let savingBudget = $state(false);
  let savingPricing = $state(false);
  let message = $state("");
  let messageTimer: ReturnType<typeof setTimeout> | null = null;

  let dailyBudget = $state("");
  let monthlyBudget = $state("");
  let deepseekPricingRows = $state<
    { model: string; cache_hit: string; cache_miss: string; output: string }[]
  >([]);

  function flash(msg: string) {
    message = msg;
    if (messageTimer) clearTimeout(messageTimer);
    messageTimer = setTimeout(() => (message = ""), 2500);
  }

  async function loadConfig() {
    const res = await fetch("/api/config");
    if (res.ok) {
      const config = await res.json();
      openrouterKey = config.openrouter_api_key || "";
      deepseekKey = config.deepseek_api_key || "";
      searxngUrl = config.searxng_url || "";
      comfyuiOutputDir = config.comfyui_output_dir || "";
      defaultModel = config.default_model || "";
      favoriteModels = config.favorite_models
        ? JSON.parse(config.favorite_models)
        : [];
      dailyBudget = config.budget_daily_limit || "";
      monthlyBudget = config.budget_monthly_limit || "";
      if (config.pricing_deepseek) {
        const parsed = JSON.parse(config.pricing_deepseek);
        deepseekPricingRows = Object.entries(parsed).map(
          ([model, tiers]: [string, any]) => ({
            model,
            cache_hit: String(tiers.cache_hit ?? ""),
            cache_miss: String(tiers.cache_miss ?? ""),
            output: String(tiers.output ?? ""),
          }),
        );
      } else {
        const defaults: Record<string, any> = {
          "deepseek-v4-flash": { cache_hit: 0.2, cache_miss: 1, output: 2 },
          "deepseek-v4-pro": { cache_hit: 0.25, cache_miss: 3, output: 6 },
        };
        deepseekPricingRows = Object.entries(defaults).map(
          ([model, tiers]) => ({
            model,
            cache_hit: String(tiers.cache_hit),
            cache_miss: String(tiers.cache_miss),
            output: String(tiers.output),
          }),
        );
        await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: "pricing_deepseek",
            value: JSON.stringify(defaults),
          }),
        });
      }
    }
  }

  async function loadModels() {
    const res = await fetch("/api/models");
    if (res.ok) {
      models = await res.json();
    }
  }

  async function refreshProvider(providerId: string) {
    refreshingProvider = providerId;
    message = "";
    try {
      const res = await fetch(`/api/models?refresh=1&provider=${providerId}`);
      if (res.ok) {
        await loadModels();
        const count = models.filter((m) => m.provider === providerId).length;
        flash(`已获取 ${count} 个模型`);
      } else {
        const err = await res.json();
        flash(err.error || "获取失败");
      }
    } catch (e: any) {
      flash(`网络错误: ${e.message}`);
    }
    refreshingProvider = "";
  }

  async function saveKey(providerId: string, value: string) {
    savingProvider = providerId;
    message = "";
    const configKey =
      providerId === "openrouter" ? "openrouter_api_key" : "deepseek_api_key";
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: configKey, value }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.modelsRefreshed) {
          await loadModels();
          const count = models.filter((m) => m.provider === providerId).length;
          flash(`API Key 已保存，获取 ${count} 个模型`);
        } else {
          flash("API Key 已保存");
        }
      } else {
        flash("保存失败");
      }
    } catch {
      flash("网络错误");
    }
    savingProvider = "";
  }

  async function saveComfyuiOutputDir() {
    savingComfyui = true;
    message = "";
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "comfyui_output_dir",
          value: comfyuiOutputDir,
        }),
      });
      flash(res.ok ? "ComfyUI 输出目录已保存" : "保存失败");
    } catch {
      flash("网络错误");
    }
    savingComfyui = false;
  }

  async function saveSearxngUrl() {
    savingSearxng = true;
    message = "";
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "searxng_url", value: searxngUrl }),
      });
      flash(res.ok ? "SearXNG 地址已保存" : "保存失败");
    } catch {
      flash("网络错误");
    }
    savingSearxng = false;
  }

  async function saveDefaultModel() {
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "default_model", value: defaultModel }),
    });
    flash("默认模型已保存");
  }

  async function saveBudget() {
    savingBudget = true;
    message = "";
    try {
      await Promise.all([
        fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: "budget_daily_limit",
            value: dailyBudget,
          }),
        }),
        fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: "budget_monthly_limit",
            value: monthlyBudget,
          }),
        }),
      ]);
      flash("预算设置已保存");
    } catch {
      flash("保存失败");
    }
    savingBudget = false;
  }

  async function saveDeepseekPricing() {
    savingPricing = true;
    message = "";
    try {
      const pricing: Record<
        string,
        { cache_hit: number; cache_miss: number; output: number }
      > = {};
      for (const row of deepseekPricingRows) {
        if (!row.model.trim()) continue;
        pricing[row.model.trim()] = {
          cache_hit: Number(row.cache_hit) || 0,
          cache_miss: Number(row.cache_miss) || 0,
          output: Number(row.output) || 0,
        };
      }
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "pricing_deepseek",
          value: JSON.stringify(pricing),
        }),
      });
      flash(res.ok ? "DeepSeek 定价已保存" : "保存失败");
    } catch {
      flash("保存失败");
    }
    savingPricing = false;
  }

  function addPricingRow() {
    deepseekPricingRows = [
      ...deepseekPricingRows,
      { model: "", cache_hit: "", cache_miss: "", output: "" },
    ];
  }

  function removePricingRow(idx: number) {
    deepseekPricingRows = deepseekPricingRows.filter((_, i) => i !== idx);
  }

  async function toggleFavorite(modelId: string) {
    if (favoriteModels.includes(modelId)) {
      favoriteModels = favoriteModels.filter((m) => m !== modelId);
    } else {
      favoriteModels = [...favoriteModels, modelId];
    }
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "favorite_models",
        value: JSON.stringify(favoriteModels),
      }),
    });
  }

  let orModels = $derived(models.filter((m) => m.provider === "openrouter"));
  let dsModels = $derived(models.filter((m) => m.provider === "deepseek"));

  $effect(() => {
    loadConfig();
    loadModels();
  });
</script>

<div class="h-full overflow-y-auto">
  <div class="mx-auto max-w-3xl px-6 py-8 space-y-5">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold text-zinc-100">设置</h1>
      {#if message}
        <span
          class="rounded-full bg-violet-500/10 px-3 py-1 text-xs text-violet-400 animate-pulse"
          >{message}</span
        >
      {/if}
    </div>

    <!-- OpenRouter -->
    <section class="rounded-lg border border-zinc-800/60 bg-zinc-900/50">
      <div
        class="flex items-center gap-3 border-b border-zinc-800/40 px-5 py-3"
      >
        <div
          class="flex h-7 w-7 items-center justify-center rounded-md bg-sky-500/10 text-xs font-bold text-sky-400"
        >
          OR
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="text-sm font-medium text-zinc-200">OpenRouter</h2>
        </div>
        <span class="text-[11px] text-zinc-600">{orModels.length} 模型</span>
      </div>
      <div class="space-y-3 p-5">
        <div class="flex gap-2">
          <input
            type="password"
            value={openrouterKey}
            oninput={(e) =>
              (openrouterKey = (e.target as HTMLInputElement).value)}
            placeholder="sk-or-..."
            class="flex-1 rounded-md border border-zinc-800 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:border-sky-500/50 focus:outline-none transition-colors"
          />
          <button
            onclick={() => saveKey("openrouter", openrouterKey)}
            disabled={savingProvider === "openrouter"}
            class="rounded-md bg-sky-600 px-4 py-2 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-40 transition-colors"
          >
            {savingProvider === "openrouter" ? "..." : "保存"}
          </button>
        </div>
        <div class="flex items-center justify-between">
          <button
            onclick={() => refreshProvider("openrouter")}
            disabled={refreshingProvider === "openrouter"}
            class="text-[11px] text-zinc-500 hover:text-zinc-300 disabled:opacity-40 transition-colors"
          >
            {refreshingProvider === "openrouter" ? "获取中..." : "刷新模型列表"}
          </button>
        </div>
        {#if orModels.length > 0}
          <div
            class="max-h-44 space-y-px overflow-y-auto rounded-md border border-zinc-800/50"
          >
            {#each orModels as m}
              <div
                class="flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-zinc-800/40 transition-colors"
              >
                <button
                  onclick={() => toggleFavorite(m.id)}
                  class="text-xs {favoriteModels.includes(m.id)
                    ? 'text-yellow-400'
                    : 'text-zinc-700'} hover:text-yellow-300 transition-colors"
                >
                  {favoriteModels.includes(m.id) ? "★" : "☆"}
                </button>
                <span class="flex-1 truncate text-xs text-zinc-400"
                  >{m.name}</span
                >
                {#if defaultModel === m.id}
                  <span class="text-[10px] text-sky-400/70">默认</span>
                {:else}
                  <button
                    onclick={() => {
                      defaultModel = m.id;
                      saveDefaultModel();
                    }}
                    class="text-[10px] text-zinc-600 hover:text-sky-400 transition-colors"
                    >设为默认</button
                  >
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </section>

    <!-- DeepSeek -->
    <section class="rounded-lg border border-zinc-800/60 bg-zinc-900/50">
      <div
        class="flex items-center gap-3 border-b border-zinc-800/40 px-5 py-3"
      >
        <div
          class="flex h-7 w-7 items-center justify-center rounded-md bg-violet-500/10 text-xs font-bold text-violet-400"
        >
          DS
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="text-sm font-medium text-zinc-200">DeepSeek</h2>
        </div>
        <span class="text-[11px] text-zinc-600">{dsModels.length} 模型</span>
      </div>
      <div class="space-y-3 p-5">
        <div class="flex gap-2">
          <input
            type="password"
            value={deepseekKey}
            oninput={(e) =>
              (deepseekKey = (e.target as HTMLInputElement).value)}
            placeholder="sk-..."
            class="flex-1 rounded-md border border-zinc-800 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:border-violet-500/50 focus:outline-none transition-colors"
          />
          <button
            onclick={() => saveKey("deepseek", deepseekKey)}
            disabled={savingProvider === "deepseek"}
            class="rounded-md bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40 transition-colors"
          >
            {savingProvider === "deepseek" ? "..." : "保存"}
          </button>
        </div>
        <div class="flex items-center justify-between">
          <button
            onclick={() => refreshProvider("deepseek")}
            disabled={refreshingProvider === "deepseek"}
            class="text-[11px] text-zinc-500 hover:text-zinc-300 disabled:opacity-40 transition-colors"
          >
            {refreshingProvider === "deepseek" ? "获取中..." : "刷新模型列表"}
          </button>
        </div>
        {#if dsModels.length > 0}
          <div
            class="max-h-44 space-y-px overflow-y-auto rounded-md border border-zinc-800/50"
          >
            {#each dsModels as m}
              <div
                class="flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-zinc-800/40 transition-colors"
              >
                <button
                  onclick={() => toggleFavorite(m.id)}
                  class="text-xs {favoriteModels.includes(m.id)
                    ? 'text-yellow-400'
                    : 'text-zinc-700'} hover:text-yellow-300 transition-colors"
                >
                  {favoriteModels.includes(m.id) ? "★" : "☆"}
                </button>
                <span class="flex-1 truncate text-xs text-zinc-400"
                  >{m.name}</span
                >
                {#if defaultModel === m.id}
                  <span class="text-[10px] text-violet-400/70">默认</span>
                {:else}
                  <button
                    onclick={() => {
                      defaultModel = m.id;
                      saveDefaultModel();
                    }}
                    class="text-[10px] text-zinc-600 hover:text-violet-400 transition-colors"
                    >设为默认</button
                  >
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        <!-- Pricing -->
        <div class="border-t border-zinc-800/40 pt-4 mt-1">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="text-xs font-medium text-zinc-300">模型定价</h3>
              <p class="text-[10px] text-zinc-600 mt-0.5">元 / 百万 token</p>
            </div>
            <button
              onclick={addPricingRow}
              class="text-[11px] text-violet-400/70 hover:text-violet-300 transition-colors"
              >+ 添加</button
            >
          </div>
          <div
            class="space-y-px rounded-md border border-zinc-800/50 overflow-hidden"
          >
            <!-- Table header -->
            <div
              class="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_20px] gap-1 px-3 py-1.5 bg-zinc-800/30"
            >
              <span class="text-[10px] text-zinc-600">模型</span>
              <span class="text-[10px] text-zinc-600 text-center">缓存命中</span
              >
              <span class="text-[10px] text-zinc-600 text-center"
                >缓存未命中</span
              >
              <span class="text-[10px] text-zinc-600 text-center">输出</span>
              <span></span>
            </div>
            <!-- Rows -->
            {#each deepseekPricingRows as row, i}
              <div
                class="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_20px] gap-1 px-2 py-1 hover:bg-zinc-800/30 transition-colors"
              >
                <input
                  type="text"
                  value={row.model}
                  oninput={(e) => {
                    deepseekPricingRows[i].model = (
                      e.target as HTMLInputElement
                    ).value;
                    deepseekPricingRows = [...deepseekPricingRows];
                  }}
                  placeholder="model-id"
                  class="w-full rounded border-0 bg-transparent px-1 py-0.5 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:bg-zinc-800/50"
                />
                <input
                  type="number"
                  step="0.01"
                  value={row.cache_hit}
                  oninput={(e) => {
                    deepseekPricingRows[i].cache_hit = (
                      e.target as HTMLInputElement
                    ).value;
                    deepseekPricingRows = [...deepseekPricingRows];
                  }}
                  class="w-full rounded border-0 bg-transparent px-1 py-0.5 text-xs text-zinc-300 text-center focus:outline-none focus:bg-zinc-800/50"
                />
                <input
                  type="number"
                  step="0.01"
                  value={row.cache_miss}
                  oninput={(e) => {
                    deepseekPricingRows[i].cache_miss = (
                      e.target as HTMLInputElement
                    ).value;
                    deepseekPricingRows = [...deepseekPricingRows];
                  }}
                  class="w-full rounded border-0 bg-transparent px-1 py-0.5 text-xs text-zinc-300 text-center focus:outline-none focus:bg-zinc-800/50"
                />
                <input
                  type="number"
                  step="0.01"
                  value={row.output}
                  oninput={(e) => {
                    deepseekPricingRows[i].output = (
                      e.target as HTMLInputElement
                    ).value;
                    deepseekPricingRows = [...deepseekPricingRows];
                  }}
                  class="w-full rounded border-0 bg-transparent px-1 py-0.5 text-xs text-zinc-300 text-center focus:outline-none focus:bg-zinc-800/50"
                />
                <button
                  onclick={() => removePricingRow(i)}
                  class="flex items-center justify-center text-zinc-700 hover:text-red-400 transition-colors"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            {/each}
          </div>
          <button
            onclick={saveDeepseekPricing}
            disabled={savingPricing}
            class="mt-3 rounded-md bg-violet-600/80 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-violet-500 disabled:opacity-40 transition-colors"
          >
            {savingPricing ? "保存中..." : "保存定价"}
          </button>
        </div>
      </div>
    </section>

    <!-- Budget -->
    <section class="rounded-lg border border-zinc-800/60 bg-zinc-900/50">
      <div
        class="flex items-center gap-3 border-b border-zinc-800/40 px-5 py-3"
      >
        <div
          class="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-xs"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="text-emerald-400"
          >
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <h2 class="text-sm font-medium text-zinc-200">费用预算</h2>
      </div>
      <div class="p-5 space-y-3">
        <p class="text-[11px] text-zinc-600">
          超限后 AI 对话将暂停，留空表示不限制
        </p>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-[10px] text-zinc-600"
              >日预算（元）</label
            >
            <input
              type="number"
              step="0.01"
              bind:value={dailyBudget}
              placeholder="不限"
              class="w-full rounded-md border border-zinc-800 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-300 placeholder-zinc-700 focus:border-emerald-500/50 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label class="mb-1 block text-[10px] text-zinc-600"
              >月预算（元）</label
            >
            <input
              type="number"
              step="0.01"
              bind:value={monthlyBudget}
              placeholder="不限"
              class="w-full rounded-md border border-zinc-800 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-300 placeholder-zinc-700 focus:border-emerald-500/50 focus:outline-none transition-colors"
            />
          </div>
        </div>
        <button
          onclick={saveBudget}
          disabled={savingBudget}
          class="rounded-md bg-emerald-600/80 px-4 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors"
        >
          {savingBudget ? "保存中..." : "保存预算"}
        </button>
      </div>
    </section>

    <!-- Integrations -->
    <section class="rounded-lg border border-zinc-800/60 bg-zinc-900/50">
      <div
        class="flex items-center gap-3 border-b border-zinc-800/40 px-5 py-3"
      >
        <div
          class="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10 text-xs"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="text-amber-400"
          >
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
            <line x1="6" y1="6" x2="6.01" y2="6" />
            <line x1="6" y1="18" x2="6.01" y2="18" />
          </svg>
        </div>
        <h2 class="text-sm font-medium text-zinc-200">集成</h2>
      </div>
      <div class="p-5 space-y-4">
        <!-- SearXNG -->
        <div>
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-xs font-medium text-zinc-300">SearXNG</span>
            <span class="text-[10px] text-zinc-600">联网搜索</span>
          </div>
          <div class="flex gap-2">
            <input
              type="text"
              bind:value={searxngUrl}
              placeholder="http://localhost:8888"
              class="flex-1 rounded-md border border-zinc-800 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-300 placeholder-zinc-700 focus:border-amber-500/50 focus:outline-none transition-colors"
            />
            <button
              onclick={saveSearxngUrl}
              disabled={savingSearxng}
              class="rounded-md bg-amber-600/80 px-4 py-2 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-40 transition-colors"
            >
              {savingSearxng ? "..." : "保存"}
            </button>
          </div>
        </div>
        <!-- ComfyUI -->
        <div class="border-t border-zinc-800/40 pt-4">
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-xs font-medium text-zinc-300">ComfyUI 输出</span>
            <span class="text-[10px] text-zinc-600">图片浏览</span>
          </div>
          <div class="flex gap-2">
            <input
              type="text"
              bind:value={comfyuiOutputDir}
              placeholder="/home/user/ComfyUI/output"
              class="flex-1 rounded-md border border-zinc-800 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-300 placeholder-zinc-700 focus:border-amber-500/50 focus:outline-none transition-colors"
            />
            <button
              onclick={saveComfyuiOutputDir}
              disabled={savingComfyui}
              class="rounded-md bg-amber-600/80 px-4 py-2 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-40 transition-colors"
            >
              {savingComfyui ? "..." : "保存"}
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</div>
