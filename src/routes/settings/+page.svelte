<script lang="ts">
  let openrouterKey = $state("");
  let deepseekKey = $state("");
  let searxngUrl = $state("");
  let defaultModel = $state("");
  let favoriteModels = $state<string[]>([]);
  let models = $state<
    { id: string; name: string; provider: string; description?: string }[]
  >([]);
  let refreshingProvider = $state("");
  let savingProvider = $state("");
  let savingSearxng = $state(false);
  let message = $state("");

  async function loadConfig() {
    const res = await fetch("/api/config");
    if (res.ok) {
      const config = await res.json();
      openrouterKey = config.openrouter_api_key || "";
      deepseekKey = config.deepseek_api_key || "";
      searxngUrl = config.searxng_url || "";
      defaultModel = config.default_model || "";
      favoriteModels = config.favorite_models
        ? JSON.parse(config.favorite_models)
        : [];
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
        message = `已获取 ${count} 个模型`;
      } else {
        const err = await res.json();
        message = err.error || "获取失败";
      }
    } catch (e: any) {
      message = `网络错误: ${e.message}`;
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
          message = `API Key 已保存，自动获取 ${count} 个模型`;
        } else {
          message = "API Key 已保存";
        }
      } else {
        message = "保存失败";
      }
    } catch {
      message = "网络错误";
    }
    savingProvider = "";
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
      message = res.ok ? "SearXNG 地址已保存" : "保存失败";
    } catch {
      message = "网络错误";
    }
    savingSearxng = false;
  }

  async function saveDefaultModel() {
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "default_model", value: defaultModel }),
    });
    message = "默认模型已保存";
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

  const providerSections = [
    {
      id: "openrouter",
      name: "OpenRouter",
      key: () => openrouterKey,
      setKey: (v: string) => (openrouterKey = v),
      placeholder: "sk-or-...",
    },
    {
      id: "deepseek",
      name: "DeepSeek",
      key: () => deepseekKey,
      setKey: (v: string) => (deepseekKey = v),
      placeholder: "sk-...",
    },
  ];

  $effect(() => {
    loadConfig();
    loadModels();
  });
</script>

<div class="mx-auto max-w-3xl space-y-8 p-6">
  <h1 class="text-2xl font-bold text-zinc-100">设置</h1>

  {#if message}
    <p class="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-violet-400">
      {message}
    </p>
  {/if}

  <!-- Provider API Keys -->
  {#each providerSections as p}
    <section
      class="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5"
    >
      <h2 class="text-lg font-semibold text-zinc-200">{p.name}</h2>
      <p class="text-sm text-zinc-500">API Key 保存在本地数据库中</p>
      <div class="flex gap-3">
        <input
          type="password"
          value={p.key()}
          oninput={(e) => p.setKey((e.target as HTMLInputElement).value)}
          placeholder={p.placeholder}
          class="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
        />
        <button
          onclick={() => saveKey(p.id, p.key())}
          disabled={savingProvider === p.id}
          class="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >保存</button
        >
      </div>
      <div class="flex items-center justify-between pt-2">
        <span class="text-sm text-zinc-500">
          {models.filter((m) => m.provider === p.id).length} 个模型
        </span>
        <button
          onclick={() => refreshProvider(p.id)}
          disabled={refreshingProvider === p.id}
          class="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >{refreshingProvider === p.id ? "获取中..." : "刷新模型"}</button
        >
      </div>
      {#if models.filter((m) => m.provider === p.id).length > 0}
        <div
          class="max-h-48 space-y-1 overflow-y-auto border-t border-zinc-800 pt-3"
        >
          {#each models.filter((m) => m.provider === p.id) as m}
            <div
              class="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-zinc-800"
            >
              <button
                onclick={() => toggleFavorite(m.id)}
                class="text-sm {favoriteModels.includes(m.id)
                  ? 'text-yellow-400'
                  : 'text-zinc-600'} hover:text-yellow-300"
                >{favoriteModels.includes(m.id) ? "★" : "☆"}</button
              >
              <span class="flex-1 text-sm text-zinc-300">{m.name}</span>
              {#if defaultModel === m.id}
                <span class="text-xs text-violet-400">默认</span>
              {/if}
              <button
                onclick={() => {
                  defaultModel = m.id;
                  saveDefaultModel();
                }}
                class="text-xs text-zinc-500 hover:text-violet-400"
                >设为默认</button
              >
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/each}

  <!-- SearXNG Web Search -->
  <section class="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
    <h2 class="text-lg font-semibold text-zinc-200">SearXNG Web Search</h2>
    <p class="text-sm text-zinc-500">
      为 Agent 提供联网搜索能力（自部署的 SearXNG 实例）
    </p>
    <div class="flex gap-3">
      <input
        type="text"
        bind:value={searxngUrl}
        placeholder="http://localhost:8888"
        class="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
      />
      <button
        onclick={saveSearxngUrl}
        disabled={savingSearxng}
        class="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >{savingSearxng ? "保存中..." : "保存"}</button
      >
    </div>
  </section>

  <!-- Favorites -->
  {#if favoriteModels.length > 0}
    <section
      class="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5"
    >
      <h2 class="text-lg font-semibold text-zinc-200">收藏的模型</h2>
      <div class="flex flex-wrap gap-2">
        {#each favoriteModels as fid}
          {@const m = models.find((x) => x.id === fid)}
          <span
            class="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300"
          >
            {m?.name || fid}
          </span>
        {/each}
      </div>
    </section>
  {/if}
</div>
