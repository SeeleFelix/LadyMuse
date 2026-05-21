<script lang="ts">
  import { onMount } from "svelte";
  import { Marked } from "marked";
  import Dropdown from "$lib/components/common/Dropdown.svelte";
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
    options?: {
      question: string;
      options: { label: string; text: string }[];
      choice?: string;
    };
    toolCallId?: string;
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
  let messageTimings = $state<
    Map<
      number,
      {
        promptBuildMs: number;
        firstTokenMs: number;
        firstReasoningMs: number;
        reasoningDurationMs: number;
        totalStreamMs: number;
        toolTimings: { name: string; durationMs: number }[];
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
  let optionsDisabled = $state(false);
  let customInputIdx = $state(-1);
  let customInputText = $state("");
  let savedMessageIndices = new Set<number>();

  let agentModules = $state<
    { file: string; enabled: boolean; exclusive_group?: string }[]
  >([]);
  let agentTools = $state<{ name: string; enabled: boolean }[]>([]);
  let jailbreakEnabled = $state(false);
  let jailbreakPrompt = $state("");
  let showAdvanced = $state(false);

  let targetModel = $state("zit");
  let outputLanguage = $state("zh");
  let promptStyle = $state<"tags" | "hybrid" | "natural">("hybrid");

  const imageModelProfiles = [
    { id: "zit", name: "Z Image Turbo", defaultStyle: "natural" as const },
    {
      id: "illustrious",
      name: "Illustrious XL",
      defaultStyle: "tags" as const,
    },
  ];

  const providers = [
    { id: "openrouter", name: "OpenRouter" },
    { id: "deepseek", name: "DeepSeek" },
  ];

  let filteredModels = $derived(
    models.filter((m) => m.provider === selectedProvider),
  );

  const TOOL_NAMES: Record<string, string> = {
    explore_dimension: "知识库 · 浏览维度",
    get_concept: "知识库 · 查看概念",
    find_concepts: "知识库 · 搜索概念",
    find_patterns: "知识库 · 匹配模式",
    find_references: "知识库 · 查找参考",
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
    stopGeneration();
    messages = [];
    currentSessionId = null;
    showSidebar = false;
    optionsDisabled = false;
    customInputIdx = -1;
    customInputText = "";
    isLoading = false;
  }

  async function switchSession(id: number) {
    stopGeneration();
    optionsDisabled = false;
    customInputIdx = -1;
    customInputText = "";
    isLoading = false;
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        messages = data.messages.map((m: any) => {
          const msg: ChatMessage = {
            role: m.role,
            content: m.content,
            toolDetail: m.toolDetail,
          };
          if (m.role === "tool" && m.toolDetail) {
            try {
              const d = JSON.parse(m.toolDetail);
              if (d.name === "present_options") {
                msg.options = {
                  question: d.input.question,
                  options: d.input.options,
                  choice: d.choice || undefined,
                };
              }
            } catch {}
          }
          return msg;
        });
        messageCosts = new Map();
        messageTimings = new Map();
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

  async function selectOption(idx: number, label: string) {
    if (optionsDisabled) return;
    const msg = messages[idx];
    if (!msg.toolCallId || !msg.options) return;

    msg.options.choice = label;
    msg.content = `${msg.options.question} → ${label}`;
    msg.toolDetail = JSON.stringify({
      name: "present_options",
      input: { question: msg.options.question, options: msg.options.options },
      choice: label,
    });
    optionsDisabled = true;
    customInputIdx = -1;
    customInputText = "";
    messages = [...messages];

    try {
      const res = await fetch("/api/studio/resolve-tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolCallId: msg.toolCallId, choice: label }),
      });
      if (!res.ok) {
        console.error("[selectOption] resolve failed:", res.status);
        optionsDisabled = false;
        messages = [...messages];
      }
    } catch (e) {
      console.error("[selectOption] fetch failed:", e);
      optionsDisabled = false;
      messages = [...messages];
    }

    await appendToSession(msg.role, msg.content, msg.toolDetail);
    savedMessageIndices.add(idx);
  }

  async function sendMessage() {
    if (!input.trim() || isLoading) return;

    const userContent = input.trim();
    messages = [...messages, { role: "user", content: userContent }];
    input = "";
    isLoading = true;
    optionsDisabled = true;
    customInputIdx = -1;
    customInputText = "";

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
                if (event.name === "present_options") {
                  const msg: ChatMessage = {
                    role: "tool",
                    content: event.input.question,
                    toolDetail: JSON.stringify({
                      name: event.name,
                      input: event.input,
                    }),
                    options: {
                      question: event.input.question,
                      options: event.input.options,
                    },
                    toolCallId: event.toolCallId,
                  };
                  messages = [...messages, msg];
                  pendingToolIdx = messages.length - 1;
                  optionsDisabled = false;
                } else {
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
                }
              } else if (event.type === "tool-result") {
                if (event.name === "present_options") {
                  // Clear toolCallId so old buttons stay disabled when
                  // a new present_options resets optionsDisabled later.
                  if (pendingToolIdx >= 0) {
                    messages[pendingToolIdx].toolCallId = undefined;
                  }
                  pendingToolIdx = -1;
                  const newAssistant: ChatMessage = {
                    role: "assistant",
                    content: "",
                  };
                  messages = [...messages, newAssistant];
                  textTargetIdx = messages.length - 1;
                  costIdx = textTargetIdx;
                } else if (pendingToolIdx >= 0) {
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
              } else if (event.type === "timing") {
                messageTimings.set(costIdx, {
                  promptBuildMs: event.promptBuildMs,
                  firstTokenMs: event.firstTokenMs,
                  firstReasoningMs: event.firstReasoningMs || 0,
                  reasoningDurationMs: event.reasoningDurationMs || 0,
                  totalStreamMs: event.totalStreamMs,
                  toolTimings: event.toolTimings || [],
                });
                messageTimings = new Map(messageTimings);
              }

              messages = [...messages];
            } catch {}
          }
        }
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        for (const m of messages) {
          if (m.role === "tool") m.toolCallId = undefined;
        }
        optionsDisabled = true;
      } else {
        messages[textTargetIdx].content = `[错误: ${e.message}]`;
      }
    }

    for (let i = newMsgStart; i < messages.length; i++) {
      if (savedMessageIndices.has(i)) {
        savedMessageIndices.delete(i);
        continue;
      }
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

  const MODULE_LABELS: Record<string, string> = {
    "00-persona.md": "直接生成人格",
    "interactive-persona.md": "交互创作人格",
    "01-creative-methodology.md": "创作方法论",
    "02-civitai-guidance.md": "CivitAI 指引",
    "03-light-methodology.md": "光影方法论",
    "04-composition-methodology.md": "构图方法论",
    "05-color-methodology.md": "色彩方法论",
    "06-camera-methodology.md": "镜头方法论",
    "07-texture-methodology.md": "质感方法论",
    "08-danbooru-guidance.md": "Danbooru 标签库",
  };

  const TOOL_LABELS: Record<string, string> = {
    explore_dimension: "知识库 · 浏览维度",
    get_concept: "知识库 · 查看概念",
    find_concepts: "知识库 · 搜索概念",
    find_patterns: "知识库 · 匹配模式",
    find_references: "知识库 · 查找参考",
    search_my_prompts: "搜索历史提示词",
    save_prompt: "保存提示词",
    get_user_profile: "获取用户画像",
    update_user_profile: "更新用户画像",
    save_session_summary: "保存会话摘要",
    search_civitai_models: "搜索 CivitAI 模型",
    search_civitai_prompts: "搜索 CivitAI 提示词",
    search_civitai_tags: "搜索 CivitAI 标签",
    web_search: "网页搜索",
    present_options: "选项交互",
    search_danbooru_tags: "Danbooru · 搜索标签",
    browse_danbooru_tags: "Danbooru · 浏览分类",
    get_danbooru_tag: "Danbooru · 查看标签",
  };

  async function loadAgentConfig() {
    try {
      const res = await fetch("/api/agent-config");
      if (res.ok) {
        const config = await res.json();
        agentModules = config.shared_modules || [];
        agentTools = config.tools || [];
      }
    } catch {}
    try {
      const res = await fetch("/api/config");
      if (res.ok) {
        const config = await res.json();
        jailbreakEnabled = config.jailbreak_enabled === "true";
        jailbreakPrompt = config.jailbreak_prompt || "";
      }
    } catch {}
  }

  async function toggleModule(idx: number) {
    const mod = agentModules[idx];
    const updated = [...agentModules];
    const newEnabled = !mod.enabled;
    updated[idx] = { ...mod, enabled: newEnabled };

    // Handle exclusive_group: disable others in same group
    if (newEnabled && mod.exclusive_group) {
      for (let i = 0; i < updated.length; i++) {
        if (i !== idx && updated[i].exclusive_group === mod.exclusive_group) {
          updated[i] = { ...updated[i], enabled: false };
        }
      }
    }

    agentModules = updated;
    await fetch("/api/agent-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shared_modules: updated }),
    });
  }

  async function toggleAgentTool(idx: number) {
    const updated = [...agentTools];
    updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled };
    agentTools = updated;
    await fetch("/api/agent-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tools: updated }),
    });
  }

  async function saveJailbreak() {
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "jailbreak_enabled",
        value: jailbreakEnabled ? "true" : "false",
      }),
    });
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "jailbreak_prompt", value: jailbreakPrompt }),
    });
  }

  onMount(() => {
    loadModels();
    loadSessions();
    loadAssistantConfig();
    loadAgentConfig();
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
    <div class="flex items-center gap-4 border-b border-zinc-800 px-6 py-3">
      <button
        onclick={() => (showSidebar = !showSidebar)}
        class="text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <svg
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
          />
        </svg>
      </button>

      <span class="text-base font-medium text-zinc-200 tracking-tight"
        >创作伙伴</span
      >

      {#if sessionCost() > 0}
        <span class="text-xs text-zinc-600 tabular-nums"
          >¥{sessionCost().toFixed(4)}</span
        >
      {/if}

      <button
        onclick={newChat}
        class="rounded-lg px-3 py-1 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
        >新对话</button
      >

      <div class="ml-auto flex items-center gap-3">
        <Dropdown
          value={selectedProvider}
          onchange={(v: string) => {
            selectedProvider = v;
            saveAssistantSetting("default_provider", v);
          }}
          options={providers.map((p) => ({ value: p.id, label: p.name }))}
        />
        <Dropdown
          value={selectedModel}
          onchange={(v: string) => {
            selectedModel = v;
            saveAssistantSetting("default_model", v);
          }}
          options={filteredModels.map((m) => ({ value: m.id, label: m.name }))}
        />

        <button
          onclick={() => (showAssistantSettings = !showAssistantSettings)}
          class="rounded-lg p-2 transition-all duration-200 {showAssistantSettings
            ? 'text-violet-400 bg-violet-500/10'
            : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}"
          title="创作设置"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
            />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Assistant settings bar -->
    {#if showAssistantSettings}
      <div class="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
        <!-- Core settings -->
        <div class="flex items-center px-6 py-2.5 gap-2">
          <span
            class="text-[11px] text-zinc-600 tracking-wider uppercase select-none"
            >生成配置</span
          >
          <span class="w-px h-4 bg-zinc-800"></span>
          <Dropdown
            value={targetModel}
            onchange={onModelChange}
            options={imageModelProfiles.map((p) => ({
              value: p.id,
              label: p.name,
            }))}
          />
          <Dropdown
            value={outputLanguage}
            onchange={onLanguageChange}
            options={[
              { value: "zh", label: "中文" },
              { value: "en", label: "English" },
            ]}
          />
          <Dropdown
            value={promptStyle}
            onchange={onStyleChange}
            options={[
              { value: "tags", label: "标签" },
              { value: "hybrid", label: "混合" },
              { value: "natural", label: "自然语言" },
            ]}
          />
          <Dropdown
            value={agentModules.find(
              (m) => m.exclusive_group === "persona" && m.enabled,
            )?.file || "00-persona.md"}
            onchange={(val: string) => {
              const idx = agentModules.findIndex((m) => m.file === val);
              if (idx >= 0) toggleModule(idx);
            }}
            options={[
              { value: "00-persona.md", label: "直接生成" },
              { value: "interactive-persona.md", label: "交互创作" },
            ]}
          />
          <span class="w-px h-4 bg-zinc-800"></span>
          <button
            onclick={() => (showAdvanced = !showAdvanced)}
            class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-all duration-200 {showAdvanced
              ? 'text-violet-300 bg-violet-500/10'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80'}"
          >
            <svg
              class="h-3 w-3 transition-transform duration-200 {showAdvanced
                ? 'rotate-90'
                : ''}"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
            高级
          </button>
        </div>

        <!-- Advanced config -->
        {#if showAdvanced}
          <div
            class="border-t border-zinc-800/60 bg-zinc-950/50 px-6 py-3.5 space-y-4"
          >
            <!-- Modules -->
            <div>
              <div
                class="text-[10px] text-zinc-600 font-medium uppercase tracking-widest mb-2"
              >
                方法论模块
              </div>
              <div class="flex flex-wrap gap-1.5">
                {#each agentModules.filter((m) => !m.exclusive_group) as mod}
                  {@const realIdx = agentModules.indexOf(mod)}
                  <button
                    onclick={() => toggleModule(realIdx)}
                    class="rounded-md px-2.5 py-1 text-xs border transition-all duration-150
                      {mod.enabled
                      ? 'bg-violet-500/10 border-violet-500/20 text-violet-300'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80'}"
                    >{MODULE_LABELS[mod.file] || mod.file}</button
                  >
                {/each}
              </div>
            </div>
            <!-- Tools -->
            <div>
              <div
                class="text-[10px] text-zinc-600 font-medium uppercase tracking-widest mb-2"
              >
                工具
              </div>
              <div class="flex flex-wrap gap-1.5">
                {#each agentTools as tool, i}
                  <button
                    onclick={() => toggleAgentTool(i)}
                    class="rounded-md px-2.5 py-1 text-xs border transition-all duration-150
                      {tool.enabled
                      ? 'bg-violet-500/10 border-violet-500/20 text-violet-300'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80'}"
                    >{TOOL_LABELS[tool.name] || tool.name}</button
                  >
                {/each}
              </div>
            </div>
            <!-- Jailbreak -->
            <div>
              <div
                class="text-[10px] text-zinc-600 font-medium uppercase tracking-widest mb-2"
              >
                Jailbreak
              </div>
              <div class="flex items-center gap-2">
                <button
                  onclick={() => {
                    jailbreakEnabled = !jailbreakEnabled;
                    saveJailbreak();
                  }}
                  class="rounded-md px-2.5 py-1 text-xs border transition-all duration-150
                    {jailbreakEnabled
                    ? 'bg-violet-500/10 border-violet-500/20 text-violet-300'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80'}"
                  >{jailbreakEnabled ? "已启用" : "关闭"}</button
                >
                {#if jailbreakEnabled}
                  <input
                    type="text"
                    bind:value={jailbreakPrompt}
                    onblur={saveJailbreak}
                    placeholder="输入自定义 jailbreak prompt..."
                    class="flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:border-violet-500/40 focus:outline-none transition-colors"
                  />
                {/if}
              </div>
            </div>
          </div>
        {/if}
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
          {#if msg.options}
            <div class="flex justify-start">
              <div
                class="max-w-[75%] rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden"
              >
                <p class="px-4 py-2 text-xs text-zinc-500">
                  {msg.options.question}
                </p>
                {#each msg.options.options as opt}
                  {@const isSelected = msg.options.choice === opt.label}
                  <button
                    onclick={() => selectOption(i, opt.label)}
                    disabled={isSelected || optionsDisabled || !msg.toolCallId}
                    class="w-full px-4 py-2.5 text-left text-sm border-t border-zinc-800 transition-colors
                      {isSelected
                      ? 'bg-violet-600/20 border-l-2 border-l-violet-500 text-violet-300'
                      : 'text-zinc-400 hover:bg-zinc-800/50'}
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span class="font-medium text-violet-400">{opt.label}</span>
                    <span class="ml-2">{opt.text}</span>
                    {#if isSelected}
                      <span class="ml-auto text-violet-400">✓</span>
                    {/if}
                  </button>
                {/each}
                {#if msg.options.choice && !msg.options.options.some((opt) => opt.label === msg.options.choice)}
                  <div
                    class="px-4 py-2.5 text-sm border-t border-zinc-800 bg-violet-600/20 border-l-2 border-l-violet-500 text-violet-300 flex items-center"
                  >
                    <span class="font-medium text-violet-400">你的想法</span>
                    <span class="ml-2">{msg.options.choice}</span>
                    <span class="ml-auto text-violet-400">✓</span>
                  </div>
                {/if}
                {#if customInputIdx === i}
                  <div class="flex gap-2 px-4 py-2 border-t border-zinc-800">
                    <input
                      type="text"
                      bind:value={customInputText}
                      placeholder="输入你的想法..."
                      class="flex-1 rounded border border-violet-500/50 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
                      onkeydown={(e) => {
                        if (e.key === "Enter" && customInputText.trim())
                          selectOption(i, customInputText);
                      }}
                    />
                    <button
                      onclick={() => selectOption(i, customInputText)}
                      disabled={!customInputText.trim() || optionsDisabled}
                      class="rounded bg-violet-600 px-3 py-1.5 text-sm text-white hover:bg-violet-500 disabled:opacity-50"
                      >确定</button
                    >
                  </div>
                {:else if !msg.options.choice && !optionsDisabled && msg.toolCallId}
                  <button
                    onclick={() => {
                      customInputIdx = i;
                      customInputText = "";
                    }}
                    class="w-full px-4 py-2 text-left text-sm text-zinc-500 border-t border-zinc-800 hover:bg-zinc-800/50 transition-colors"
                    >其他...</button
                  >
                {/if}
              </div>
            </div>
          {:else}
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
                  <span class="text-xs text-zinc-400 flex-1">{msg.content}</span
                  >
                </button>
                {#if expandedTools.has(i) && msg.toolDetail}
                  <div class="border-t border-zinc-700 px-4 py-2">
                    <pre
                      class="text-xs text-zinc-500 whitespace-pre-wrap font-mono max-h-[32rem] overflow-y-auto">{msg.toolDetail}</pre>
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        {:else}
          <div
            class="flex min-w-0 {msg.role === 'user'
              ? 'justify-end'
              : 'justify-start'}"
          >
            <div
              class="flex flex-col max-w-[75%] {msg.role === 'user'
                ? 'items-end'
                : 'items-start'}"
            >
              <div
                class="rounded-xl px-4 py-3 {msg.role === 'user'
                  ? 'bg-violet-600 text-white'
                  : 'bg-zinc-800 text-zinc-200 prose prose-invert prose-sm max-w-none overflow-hidden'}"
              >
                {#if msg.role === "user"}
                  <div class="whitespace-pre-wrap text-sm leading-relaxed">
                    {msg.content}
                  </div>
                {:else}
                  {@html renderMarkdown(msg.content)}
                {/if}
              </div>
              {#if msg.role === "assistant" && messageCosts.has(i)}
                {@const cost = messageCosts.get(i)!}
                {@const timing = messageTimings.get(i)}
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
                  {#if timing}
                    <span class="text-zinc-700">|</span>
                    <span class="text-zinc-500"
                      >{(timing.totalStreamMs / 1000).toFixed(1)}s</span
                    >
                    {#if timing.firstReasoningMs}
                      <span class="text-zinc-700">|</span>
                      <span class="text-amber-600"
                        >思考 {(timing.reasoningDurationMs / 1000).toFixed(
                          1,
                        )}s</span
                      >
                    {/if}
                    <span class="text-zinc-700">|</span>
                    <span class="text-zinc-600"
                      >首字 {(timing.firstTokenMs / 1000).toFixed(1)}s</span
                    >
                    {#if timing.toolTimings.length > 0}
                      <span class="text-zinc-700">|</span>
                      <span class="text-zinc-600"
                        >工具 {timing.toolTimings.reduce(
                          (s, t) => s + t.durationMs,
                          0,
                        ) / 1000}s ({timing.toolTimings
                          .map(
                            (t) =>
                              `${t.name.replace(/_/g, " ")} ${(t.durationMs / 1000).toFixed(1)}s`,
                          )
                          .join(", ")})</span
                      >
                    {/if}
                  {/if}
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
