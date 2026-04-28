<script lang="ts">
  interface ModuleConfig {
    file: string;
    enabled: boolean;
  }

  interface ToolConfig {
    name: string;
    enabled: boolean;
  }

  let modules = $state<ModuleConfig[]>([]);
  let tools = $state<ToolConfig[]>([]);
  let jbEnabled = $state(false);
  let jbPrompt = $state("");
  let loading = $state(true);
  let saving = $state(false);
  let message = $state("");
  let messageTimer: ReturnType<typeof setTimeout> | null = null;

  function flash(msg: string) {
    message = msg;
    if (messageTimer) clearTimeout(messageTimer);
    messageTimer = setTimeout(() => (message = ""), 2500);
  }

  async function loadConfig() {
    loading = true;
    try {
      const res = await fetch("/api/agent-config");
      if (res.ok) {
        const config = await res.json();
        modules = config.modules;
        tools = config.tools;
      }
      const cfgRes = await fetch("/api/config");
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        jbEnabled = cfg.jailbreak_enabled === "true";
        jbPrompt = cfg.jailbreak_prompt || "";
      }
    } catch {
      flash("加载失败");
    }
    loading = false;
  }

  async function saveConfig() {
    saving = true;
    try {
      const res = await fetch("/api/agent-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modules, tools }),
      });
      await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "jailbreak_enabled",
          value: jbEnabled ? "true" : "false",
        }),
      });
      await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "jailbreak_prompt", value: jbPrompt }),
      });
      flash(res.ok ? "已保存" : "保存失败");
    } catch {
      flash("网络错误");
    }
    saving = false;
  }

  function toggleModule(index: number) {
    modules[index].enabled = !modules[index].enabled;
  }

  function toggleTool(index: number) {
    tools[index].enabled = !tools[index].enabled;
  }

  loadConfig();
</script>

<div class="mx-auto max-w-3xl p-6">
  <h1 class="mb-6 text-2xl font-bold text-zinc-100">Agent 配置</h1>

  {#if message}
    <div
      class="mb-4 rounded-lg bg-sky-500/10 px-4 py-2 text-sm text-sky-400 transition-opacity"
    >
      {message}
    </div>
  {/if}

  {#if loading}
    <div class="py-12 text-center text-zinc-500">加载中...</div>
  {:else}
    <!-- Prompt 模块 -->
    <section class="mb-8">
      <h2 class="mb-3 text-lg font-semibold text-zinc-200">Prompt 模块</h2>
      <div
        class="overflow-hidden rounded-lg border border-zinc-800/60 bg-zinc-900/50"
      >
        {#each modules as mod, i}
          <button
            onclick={() => toggleModule(i)}
            class="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-zinc-800/40 {i <
            modules.length - 1
              ? 'border-b border-zinc-800/40'
              : ''}"
          >
            <div class="flex items-center gap-3">
              <span class="text-sm text-zinc-100">{mod.file}</span>
            </div>
            <span
              class="rounded-md px-2.5 py-0.5 text-xs font-medium {mod.enabled
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-zinc-700/50 text-zinc-500'}"
            >
              {mod.enabled ? "启用" : "禁用"}
            </span>
          </button>
        {/each}
      </div>
    </section>

    <!-- 越狱提示词 -->
    <section class="mb-8">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold text-zinc-200">越狱提示词</h2>
        <button
          onclick={() => (jbEnabled = !jbEnabled)}
          class="rounded-md px-2.5 py-0.5 text-xs font-medium {jbEnabled
            ? 'bg-amber-500/15 text-amber-400'
            : 'bg-zinc-700/50 text-zinc-500'}"
        >
          {jbEnabled ? "已启用" : "已禁用"}
        </button>
      </div>
      {#if jbEnabled}
        <textarea
          bind:value={jbPrompt}
          placeholder="输入越狱提示词内容，会追加在消息列表末尾..."
          rows="6"
          class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 placeholder-zinc-500 focus:border-amber-500 focus:outline-none resize-y"
        ></textarea>
      {/if}
    </section>

    <!-- 工具管理 -->
    <section class="mb-8">
      <h2 class="mb-3 text-lg font-semibold text-zinc-200">工具管理</h2>
      <div
        class="overflow-hidden rounded-lg border border-zinc-800/60 bg-zinc-900/50"
      >
        {#each tools as tool, i}
          <button
            onclick={() => toggleTool(i)}
            class="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-zinc-800/40 {i <
            tools.length - 1
              ? 'border-b border-zinc-800/40'
              : ''}"
          >
            <div class="flex items-center gap-3">
              <span class="font-mono text-sm text-zinc-100">{tool.name}</span>
            </div>
            <span
              class="rounded-md px-2.5 py-0.5 text-xs font-medium {tool.enabled
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-zinc-700/50 text-zinc-500'}"
            >
              {tool.enabled ? "启用" : "禁用"}
            </span>
          </button>
        {/each}
      </div>
    </section>

    <button
      onclick={saveConfig}
      disabled={saving}
      class="rounded-lg bg-sky-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
    >
      {saving ? "保存中..." : "保存配置"}
    </button>
  {/if}
</div>
