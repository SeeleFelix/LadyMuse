<script lang="ts">
  import { onMount } from "svelte";
  import { Marked } from "marked";
  import hljs from "highlight.js";

  interface Session {
    id: number;
    title: string;
    created_at: string;
    updated_at: string;
  }

  interface ChatMessage {
    role: "user" | "assistant" | "tool";
    content: string;
    toolDetail?: string;
  }

  let messages = $state<ChatMessage[]>([]);
  let input = $state("");
  let isLoading = $state(false);
  let abortController = $state<AbortController | null>(null);
  let expandedTools = $state<Set<number>>(new Set());
  let messagesEl = $state<HTMLDivElement | null>(null);
  let messageCosts = $state<
    Map<
      number,
      {
        cost: number;
        currency: string;
        inputTokens: number;
        outputTokens: number;
        cacheHitTokens: number;
        source: string;
      }
    >
  >(new Map());
  let sessionCost = $derived(() => {
    let total = 0;
    for (const v of messageCosts.values()) total += v.cost;
    return total;
  });

  let selectedProvider = $state("openrouter");
  let selectedModel = $state("");
  let models = $state<{ id: string; name: string; provider: string }[]>([]);

  let sessions = $state<Session[]>([]);
  let currentSessionId = $state<number | null>(null);
  let showSidebar = $state(false);
  let showAssistantSettings = $state(true);

  let targetModel = $state("zit");
  let outputLanguage = $state("zh");
  let promptStyle = $state<"tags" | "hybrid" | "natural">("hybrid");

  const imageModelProfiles = [
    { id: "zit", name: "Z Image Turbo", defaultStyle: "hybrid" as const },
    { id: "sdxl", name: "SDXL", defaultStyle: "hybrid" as const },
    { id: "sd15", name: "SD 1.5", defaultStyle: "tags" as const },
    { id: "flux", name: "FLUX", defaultStyle: "natural" as const },
  ];

  const providers = [
    { id: "openrouter", name: "OpenRouter" },
    { id: "deepseek", name: "DeepSeek" },
  ];

  let filteredModels = $derived(
    models.filter((m) => m.provider === selectedProvider),
  );

  const TOOL_NAMES: Record<string, string> = {
    knowledge_search: "搜索知识库",
    search_my_prompts: "搜索历史提示词",
    save_prompt: "保存提示词",
    get_user_profile: "获取用户画像",
    update_user_profile: "更新用户画像",
    save_session_summary: "保存会话摘要",
  };

  const marked = new Marked({
    renderer: {
      code({ text, lang }: { text: string; lang?: string }) {
        const language = lang && hljs.getLanguage(lang) ? lang : undefined;
        const highlighted = language
          ? hljs.highlight(text, { language }).value
          : hljs.highlightAuto(text).value;
        return `<pre class="hljs"><code class="${language ? `language-${language}` : ""}">${highlighted}</code></pre>`;
      },
    },
  });

  function renderMarkdown(text: string): string {
    if (!text) return "";
    return marked.parse(text) as string;
  }

  $effect(() => {
    if (
      filteredModels.length > 0 &&
      !filteredModels.find((m) => m.id === selectedModel)
    ) {
      selectedModel = filteredModels[0].id;
    }
  });

  $effect(() => {
    messages;
    if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  });

  async function loadModels() {
    try {
      const res = await fetch("/api/models");
      if (res.ok) {
        models = (await res.json()).map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          provider: m.provider || "openrouter",
        }));
      }
    } catch {}
    if (models.length === 0) {
      models = [
        {
          id: "anthropic/claude-sonnet-4-6",
          name: "Claude Sonnet",
          provider: "openrouter",
        },
        {
          id: "anthropic/claude-opus-4-7",
          name: "Claude Opus",
          provider: "openrouter",
        },
        { id: "openai/gpt-4o", name: "GPT-4o", provider: "openrouter" },
        {
          id: "deepseek-v4-flash",
          name: "DeepSeek V4 Flash",
          provider: "deepseek",
        },
        {
          id: "deepseek-v4-pro",
          name: "DeepSeek V4 Pro",
          provider: "deepseek",
        },
      ];
    }
  }

  async function loadSessions() {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) sessions = await res.json();
    } catch {}
  }

  async function newChat() {
    messages = [];
    currentSessionId = null;
    showSidebar = false;
  }

  async function switchSession(id: number) {
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        messages = data.messages.map((m: any) => ({
          role: m.role,
          content: m.content,
          toolDetail: m.toolDetail,
        }));
        messageCosts = new Map();
        data.messages.forEach((m: any, i: number) => {
          if (m.role === "assistant" && m.usageJson) {
            try {
              messageCosts.set(i, JSON.parse(m.usageJson));
            } catch {}
          }
        });
        messageCosts = new Map(messageCosts);
        currentSessionId = id;
        showSidebar = false;
      }
    } catch {}
  }

  async function deleteSession(id: number, e: MouseEvent) {
    e.stopPropagation();
    await fetch("/api/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    sessions = sessions.filter((s) => s.id !== id);
    if (currentSessionId === id) {
      messages = [];
      currentSessionId = null;
    }
  }

  async function ensureSession(): Promise<number> {
    if (currentSessionId) return currentSessionId;
    const firstUserMsg = messages.find((m) => m.role === "user");
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: firstUserMsg?.content?.slice(0, 30) || "新对话",
      }),
    });
    const session = await res.json();
    currentSessionId = session.id;
    return session.id;
  }

  async function appendToSession(
    role: string,
    content: string,
    toolDetail?: string,
    usageJson?: string,
  ) {
    try {
      const sid = await ensureSession();
      await fetch(`/api/sessions/${sid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          content,
          tool_detail: toolDetail,
          usage_json: usageJson,
        }),
      });
    } catch {}
  }

  function summarizeToolResult(result: any): string {
    if (typeof result === "string") return result.slice(0, 200);
    if (Array.isArray(result)) return `找到 ${result.length} 条结果`;
    return JSON.stringify(result).slice(0, 200);
  }

  function stopGeneration() {
    if (abortController) {
      abortController.abort();
      abortController = null;
      isLoading = false;
    }
  }

  async function sendMessage() {
    if (!input.trim() || isLoading) return;

    const userContent = input.trim();
    messages = [...messages, { role: "user", content: userContent }];
    input = "";
    isLoading = true;

    const newMsgStart = messages.length - 1;
    messages = [...messages, { role: "assistant", content: "" }];

    let textTargetIdx = messages.length - 1;
    let pendingToolIdx = -1;
    let costIdx = textTargetIdx;

    const apiMessages = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    const controller = new AbortController();
    abortController = controller;

    await ensureSession();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages.slice(0, -1),
          model: selectedModel,
          provider: selectedProvider,
          sessionId: currentSessionId,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        messages[textTargetIdx].content = `[请求失败: ${err}]`;
        isLoading = false;
        abortController = null;
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);

              if (event.type === "text") {
                messages[textTargetIdx].content += event.content;
              } else if (event.type === "tool-call") {
                const toolName = TOOL_NAMES[event.name] || event.name;
                const toolMsg: ChatMessage = {
                  role: "tool",
                  content: `🔍 ${toolName}...`,
                  toolDetail: JSON.stringify(
                    { name: event.name, input: event.input },
                    null,
                    2,
                  ),
                };
                messages = [...messages, toolMsg];
                pendingToolIdx = messages.length - 1;
              } else if (event.type === "tool-result") {
                if (pendingToolIdx >= 0) {
                  const toolName = TOOL_NAMES[event.name] || event.name;
                  const summary = summarizeToolResult(event.output);
                  const detail = messages[pendingToolIdx].toolDetail || "";
                  const fullDetail =
                    detail +
                    "\n\n--- 结果 ---\n" +
                    (typeof event.output === "string"
                      ? event.output
                      : JSON.stringify(event.output, null, 2));
                  messages[pendingToolIdx].content =
                    `🔍 ${toolName}: ${summary}`;
                  messages[pendingToolIdx].toolDetail = fullDetail;
                  pendingToolIdx = -1;
                  const newAssistant: ChatMessage = {
                    role: "assistant",
                    content: "",
                  };
                  messages = [...messages, newAssistant];
                  textTargetIdx = messages.length - 1;
                  costIdx = textTargetIdx;
                }
              } else if (event.type === "error") {
                messages[textTargetIdx].content += `[错误: ${event.content}]`;
              } else if (event.type === "usage") {
                messageCosts.set(costIdx, {
                  cost: event.cost,
                  currency: event.currency,
                  inputTokens: event.inputTokens,
                  outputTokens: event.outputTokens,
                  cacheHitTokens: event.cacheHitTokens || 0,
                  source: event.source,
                });
                messageCosts = new Map(messageCosts);
              }

              messages = [...messages];
            } catch {}
          }
        }
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        // User stopped generation, keep partial content
      } else {
        messages[textTargetIdx].content = `[错误: ${e.message}]`;
      }
    }

    for (let i = newMsgStart; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.content && msg.content.trim()) {
        let usageJson: string | undefined;
        if (msg.role === "assistant" && messageCosts.has(i)) {
          usageJson = JSON.stringify(messageCosts.get(i));
        }
        await appendToSession(msg.role, msg.content, msg.toolDetail, usageJson);
      }
    }
    loadSessions();

    isLoading = false;
    abortController = null;
  }

  function toggleTool(idx: number) {
    const next = new Set(expandedTools);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    expandedTools = next;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function loadAssistantConfig() {
    const res = await fetch("/api/config");
    if (res.ok) {
      const config = await res.json();
      if (config.default_provider) selectedProvider = config.default_provider;
      if (config.default_model) selectedModel = config.default_model;
      targetModel = config.target_image_model || "zit";
      outputLanguage = config.output_language || "zh";
      promptStyle =
        (config.prompt_style as "tags" | "hybrid" | "natural") ||
        imageModelProfiles.find((p) => p.id === targetModel)?.defaultStyle ||
        "hybrid";
    }
  }

  async function saveAssistantSetting(key: string, value: string) {
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
  }

  function onModelChange(newModelId: string) {
    targetModel = newModelId;
    const profile = imageModelProfiles.find((p) => p.id === newModelId);
    if (profile) promptStyle = profile.defaultStyle;
    saveAssistantSetting("target_image_model", newModelId);
    saveAssistantSetting("prompt_style", promptStyle);
  }

  function onLanguageChange(lang: string) {
    outputLanguage = lang;
    saveAssistantSetting("output_language", lang);
  }

  function onStyleChange(style: string) {
    promptStyle = style as "tags" | "hybrid" | "natural";
    saveAssistantSetting("prompt_style", style);
  }

  onMount(() => {
    loadModels();
    loadSessions();
    loadAssistantConfig();
  });
</script>

<div class="flex h-full">
  <!-- Sidebar -->
  {#if showSidebar}
    <div
      class="w-64 flex-shrink-0 border-r border-zinc-800 bg-zinc-900 flex flex-col"
    >
      <div
        class="flex items-center justify-between border-b border-zinc-800 px-4 py-3"
      >
        <span class="text-sm font-medium text-zinc-300">对话历史</span>
        <button
          onclick={() => (showSidebar = false)}
          class="text-zinc-500 hover:text-zinc-300"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            /></svg
          >
        </button>
      </div>
      <button
        onclick={newChat}
        class="mx-3 mt-3 rounded-lg border border-dashed border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:border-violet-500 hover:text-violet-400"
      >
        + 新对话
      </button>
      <div class="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {#each sessions as s}
          <button
            onclick={() => switchSession(s.id)}
            class="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm {currentSessionId ===
            s.id
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'}"
          >
            <span class="flex-1 truncate">{s.title}</span>
            <span
              class="hidden text-zinc-600 hover:text-red-400 group-hover:inline"
              onclick={(e) => deleteSession(s.id, e)}
            >
              <svg
                class="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                /></svg
              >
            </span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Main chat area -->
  <div class="flex h-full flex-1 flex-col">
    <!-- Header -->
    <div class="flex items-center gap-3 border-b border-zinc-800 px-6 py-3">
      <button
        onclick={() => (showSidebar = !showSidebar)}
        class="text-zinc-400 hover:text-zinc-200"
      >
        <svg
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          ><path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 6h16M4 12h16M4 18h16"
          /></svg
        >
      </button>
      <h1 class="text-lg font-semibold text-zinc-100">创作伙伴</h1>
      {#if sessionCost() > 0}
        <span class="text-xs text-zinc-500 ml-1"
          >¥{sessionCost().toFixed(4)}</span
        >
      {/if}
      <button
        onclick={newChat}
        class="ml-3 rounded-md border border-dashed border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:border-violet-500 hover:text-violet-400 transition-colors"
      >
        + 新对话
      </button>
      <div class="ml-auto flex items-center gap-2">
        <select
          value={selectedProvider}
          onchange={(e) => {
            selectedProvider = (e.target as HTMLSelectElement).value;
            saveAssistantSetting("default_provider", selectedProvider);
          }}
          class="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 focus:border-violet-500 focus:outline-none"
        >
          {#each providers as p}
            <option value={p.id}>{p.name}</option>
          {/each}
        </select>
        <select
          value={selectedModel}
          onchange={(e) => {
            selectedModel = (e.target as HTMLSelectElement).value;
            saveAssistantSetting("default_model", selectedModel);
          }}
          class="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 focus:border-violet-500 focus:outline-none"
        >
          {#each filteredModels as m}
            <option value={m.id}>{m.name}</option>
          {/each}
        </select>
        <button
          onclick={() => (showAssistantSettings = !showAssistantSettings)}
          class="rounded-md border {showAssistantSettings
            ? 'border-violet-500 text-violet-400'
            : 'border-zinc-700 text-zinc-400'} p-1.5 hover:border-violet-500 hover:text-violet-400 transition-colors"
          title="创作助手设置"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            /><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            /></svg
          >
        </button>
      </div>
    </div>

    <!-- Assistant settings bar -->
    {#if showAssistantSettings}
      <div
        class="flex items-center gap-4 border-b border-zinc-800 bg-zinc-900/50 px-6 py-2.5 text-xs"
      >
        <div class="flex items-center gap-2">
          <span class="text-zinc-500">图像模型</span>
          <select
            value={targetModel}
            onchange={(e) =>
              onModelChange((e.target as HTMLSelectElement).value)}
            class="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 focus:border-violet-500 focus:outline-none"
          >
            {#each imageModelProfiles as p}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-zinc-500">语言</span>
          <button
            onclick={() => onLanguageChange("zh")}
            class="rounded px-2 py-0.5 {outputLanguage === 'zh'
              ? 'bg-violet-600/20 text-violet-300'
              : 'text-zinc-500 hover:text-zinc-300'}">中</button
          >
          <button
            onclick={() => onLanguageChange("en")}
            class="rounded px-2 py-0.5 {outputLanguage === 'en'
              ? 'bg-violet-600/20 text-violet-300'
              : 'text-zinc-500 hover:text-zinc-300'}">EN</button
          >
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-zinc-500">风格</span>
          <button
            onclick={() => onStyleChange("tags")}
            class="rounded px-2 py-0.5 {promptStyle === 'tags'
              ? 'bg-violet-600/20 text-violet-300'
              : 'text-zinc-500 hover:text-zinc-300'}">标签</button
          >
          <button
            onclick={() => onStyleChange("hybrid")}
            class="rounded px-2 py-0.5 {promptStyle === 'hybrid'
              ? 'bg-violet-600/20 text-violet-300'
              : 'text-zinc-500 hover:text-zinc-300'}">混合</button
          >
          <button
            onclick={() => onStyleChange("natural")}
            class="rounded px-2 py-0.5 {promptStyle === 'natural'
              ? 'bg-violet-600/20 text-violet-300'
              : 'text-zinc-500 hover:text-zinc-300'}">自然语言</button
          >
        </div>
      </div>
    {/if}

    <!-- Messages -->
    <!-- svelte-ignore binding_property_non_reactive -->
    <div
      bind:this={messagesEl}
      class="flex-1 overflow-y-auto px-6 py-4 space-y-4"
    >
      {#if messages.length === 0}
        <div class="flex h-full items-center justify-center">
          <div class="text-center text-zinc-600">
            <p class="text-lg">跟 LadyMuse 聊聊你的创作想法</p>
            <p class="mt-2 text-sm">试试说：我想要空灵但暗黑的感觉</p>
          </div>
        </div>
      {/if}

      {#each messages as msg, i}
        {#if msg.role === "tool"}
          <div class="flex justify-start">
            <div
              class="max-w-[75%] rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden"
            >
              <button
                onclick={() => toggleTool(i)}
                class="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-zinc-800/50 transition-colors"
              >
                <svg
                  class="h-3 w-3 text-zinc-500 transition-transform {expandedTools.has(
                    i,
                  )
                    ? 'rotate-90'
                    : ''}"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 5l7 7-7 7"
                  /></svg
                >
                <span class="text-xs text-zinc-400 flex-1">{msg.content}</span>
              </button>
              {#if expandedTools.has(i) && msg.toolDetail}
                <div class="border-t border-zinc-700 px-4 py-2">
                  <pre
                    class="text-xs text-zinc-500 whitespace-pre-wrap font-mono max-h-[32rem] overflow-y-auto">{msg.toolDetail}</pre>
                </div>
              {/if}
            </div>
          </div>
        {:else}
          <div
            class="flex min-w-0 {msg.role === 'user'
              ? 'justify-end'
              : 'justify-start'}"
          >
            <div
              class="flex flex-col {msg.role === 'user'
                ? 'items-end'
                : 'items-start'}"
            >
              <div
                class="max-w-[75%] min-w-0 rounded-xl px-4 py-3 {msg.role ===
                'user'
                  ? 'bg-violet-600 text-white'
                  : 'bg-zinc-800 text-zinc-200 prose prose-invert prose-sm max-w-none overflow-hidden'}"
              >
                {#if msg.role === "user"}
                  <pre
                    class="whitespace-pre-wrap font-sans text-sm leading-relaxed">{msg.content}</pre>
                {:else}
                  {@html renderMarkdown(msg.content)}
                {/if}
              </div>
              {#if msg.role === "assistant" && messageCosts.has(i)}
                {@const cost = messageCosts.get(i)!}
                <div
                  class="mt-1 flex items-center gap-2 text-[10px] text-zinc-600 px-1"
                >
                  <span>{cost.inputTokens + cost.outputTokens} tokens</span>
                  <span class="text-zinc-700">|</span>
                  <span class="text-zinc-500"
                    >{cost.currency === "CNY" ? "¥" : "$"}{cost.cost.toFixed(
                      4,
                    )}</span
                  >
                  <span class="text-zinc-700">|</span>
                  <span>{cost.source === "reported" ? "实际" : "计算"}</span>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      {/each}

      {#if isLoading && messages.length > 0 && messages[messages.length - 1].role === "assistant" && !messages[messages.length - 1].content}
        <div class="flex justify-start">
          <div class="bg-zinc-800 text-zinc-400 rounded-xl px-4 py-3 text-sm">
            思考中...
          </div>
        </div>
      {/if}
    </div>

    <!-- Input -->
    <div class="border-t border-zinc-800 px-6 py-4">
      <div class="flex gap-3">
        <textarea
          bind:value={input}
          onkeydown={handleKeydown}
          placeholder="描述你的感觉、上传参考图、或说出图反馈..."
          rows="2"
          class="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-500 focus:border-violet-500 focus:outline-none resize-none"
        ></textarea>
        {#if isLoading}
          <button
            type="button"
            onclick={stopGeneration}
            class="rounded-xl bg-red-600 px-5 py-3 text-sm font-medium text-white hover:bg-red-500"
            >停止</button
          >
        {:else}
          <button
            type="button"
            onclick={sendMessage}
            disabled={!input.trim()}
            class="rounded-xl bg-violet-600 px-5 py-3 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >发送</button
          >
        {/if}
      </div>
    </div>
  </div>
</div>
