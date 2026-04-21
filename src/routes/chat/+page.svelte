<script lang="ts">
	import { onMount } from 'svelte';

	interface Session {
		id: number;
		title: string;
		created_at: string;
		updated_at: string;
	}

	interface ChatMessage {
		role: 'user' | 'assistant' | 'tool';
		content: string;
	}

	let messages = $state<ChatMessage[]>([]);
	let input = $state('');
	let isLoading = $state(false);

	let selectedProvider = $state('openrouter');
	let selectedModel = $state('');
	let models = $state<{ id: string; name: string; provider: string }[]>([]);

	let sessions = $state<Session[]>([]);
	let currentSessionId = $state<number | null>(null);
	let showSidebar = $state(false);

	const providers = [
		{ id: 'openrouter', name: 'OpenRouter' },
		{ id: 'deepseek', name: 'DeepSeek' }
	];

	let filteredModels = $derived(models.filter((m) => m.provider === selectedProvider));

	const TOOL_NAMES: Record<string, string> = {
		knowledge_search: '搜索知识库',
		search_my_prompts: '搜索历史提示词',
		save_prompt: '保存提示词',
		get_user_profile: '获取用户画像',
		update_user_profile: '更新用户画像',
		save_session_summary: '保存会话摘要'
	};

	$effect(() => {
		if (filteredModels.length > 0 && !filteredModels.find((m) => m.id === selectedModel)) {
			selectedModel = filteredModels[0].id;
		}
	});

	async function loadModels() {
		try {
			const res = await fetch('/api/models');
			if (res.ok) {
				models = (await res.json()).map((m: any) => ({
					id: m.id,
					name: m.name || m.id,
					provider: m.provider || 'openrouter'
				}));
			}
		} catch {}
		if (models.length === 0) {
			models = [
				{ id: 'anthropic/claude-sonnet-4-6', name: 'Claude Sonnet', provider: 'openrouter' },
				{ id: 'anthropic/claude-opus-4-7', name: 'Claude Opus', provider: 'openrouter' },
				{ id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'openrouter' },
				{ id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek' },
				{ id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', provider: 'deepseek' }
			];
		}
	}

	async function loadSessions() {
		try {
			const res = await fetch('/api/sessions');
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
					content: m.content
				}));
				currentSessionId = id;
				showSidebar = false;
			}
		} catch {}
	}

	async function deleteSession(id: number, e: MouseEvent) {
		e.stopPropagation();
		await fetch('/api/sessions', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id })
		});
		sessions = sessions.filter((s) => s.id !== id);
		if (currentSessionId === id) {
			messages = [];
			currentSessionId = null;
		}
	}

	async function ensureSession(): Promise<number> {
		if (currentSessionId) return currentSessionId;
		const firstUserMsg = messages.find((m) => m.role === 'user');
		const res = await fetch('/api/sessions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: firstUserMsg?.content?.slice(0, 30) || '新对话' })
		});
		const session = await res.json();
		currentSessionId = session.id;
		return session.id;
	}

	async function appendToSession(role: string, content: string) {
		try {
			const sid = await ensureSession();
			await fetch(`/api/sessions/${sid}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ role, content })
			});
		} catch {}
	}

	function summarizeToolResult(result: any): string {
		if (typeof result === 'string') return result.slice(0, 200);
		if (Array.isArray(result)) return `找到 ${result.length} 条结果`;
		return JSON.stringify(result).slice(0, 200);
	}

	async function sendMessage() {
		if (!input.trim() || isLoading) return;

		const userContent = input.trim();
		messages = [...messages, { role: 'user', content: userContent }];
		input = '';
		isLoading = true;

		// Track which indices are new (for saving later)
		const newMsgStart = messages.length - 1;

		// Add initial assistant message for text output
		messages = [...messages, { role: 'assistant', content: '' }];

		// Current text target: the assistant message that receives text
		let textTargetIdx = messages.length - 1;
		let pendingToolIdx = -1;

		const apiMessages = messages.filter((m) => m.role === 'user' || m.role === 'assistant').map((m) => ({ role: m.role, content: m.content }));

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages: apiMessages.slice(0, -1),
					model: selectedModel,
					provider: selectedProvider
				})
			});

			if (!res.ok) {
				const err = await res.text();
				messages[textTargetIdx].content = `[请求失败: ${err}]`;
				isLoading = false;
				return;
			}

			const reader = res.body?.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			if (reader) {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });

					const lines = buffer.split('\n');
					buffer = lines.pop() || '';

					for (const line of lines) {
						if (!line.trim()) continue;
						try {
							const event = JSON.parse(line);

							if (event.type === 'text') {
								messages[textTargetIdx].content += event.content;
							} else if (event.type === 'tool-call') {
								const toolName = TOOL_NAMES[event.name] || event.name;
								const toolMsg: ChatMessage = { role: 'tool', content: `🔍 ${toolName}...` };
								messages = [...messages, toolMsg];
								pendingToolIdx = messages.length - 1;
							} else if (event.type === 'tool-result') {
								if (pendingToolIdx >= 0) {
									const toolName = TOOL_NAMES[event.name] || event.name;
									const summary = summarizeToolResult(event.output);
									messages[pendingToolIdx].content = `🔍 ${toolName}: ${summary}`;
									pendingToolIdx = -1;
									// After tool result, new assistant message for subsequent text
									const newAssistant: ChatMessage = { role: 'assistant', content: '' };
									messages = [...messages, newAssistant];
									textTargetIdx = messages.length - 1;
								}
							} else if (event.type === 'error') {
								messages[textTargetIdx].content += `[错误: ${event.content}]`;
							}

							messages = [...messages];
						} catch {}
					}
				}
			}
		} catch (e: any) {
			messages[textTargetIdx].content = `[错误: ${e.message}]`;
		}

		// Save all new messages to session
		for (let i = newMsgStart; i < messages.length; i++) {
			const msg = messages[i];
			if (msg.content && msg.content.trim()) {
				await appendToSession(msg.role, msg.content);
			}
		}
		loadSessions();

		isLoading = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	onMount(() => {
		loadModels();
		loadSessions();
	});
</script>

<div class="flex h-full">
	<!-- Sidebar -->
	{#if showSidebar}
		<div class="w-64 flex-shrink-0 border-r border-zinc-800 bg-zinc-900 flex flex-col">
			<div class="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
				<span class="text-sm font-medium text-zinc-300">对话历史</span>
				<button onclick={() => (showSidebar = false)} class="text-zinc-500 hover:text-zinc-300">
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
				</button>
			</div>
			<button onclick={newChat} class="mx-3 mt-3 rounded-lg border border-dashed border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:border-violet-500 hover:text-violet-400">
				+ 新对话
			</button>
			<div class="flex-1 overflow-y-auto px-3 py-2 space-y-1">
				{#each sessions as s}
					<button
						onclick={() => switchSession(s.id)}
						class="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm {currentSessionId === s.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'}"
					>
						<span class="flex-1 truncate">{s.title}</span>
						<span class="hidden text-zinc-600 hover:text-red-400 group-hover:inline" onclick={(e) => deleteSession(s.id, e)}>
							<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
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
			<button onclick={() => (showSidebar = !showSidebar)} class="text-zinc-400 hover:text-zinc-200">
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
			</button>
			<h1 class="text-lg font-semibold text-zinc-100">创作伙伴</h1>
			<div class="ml-auto flex items-center gap-2">
				<select
					bind:value={selectedProvider}
					class="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 focus:border-violet-500 focus:outline-none"
				>
					{#each providers as p}
						<option value={p.id}>{p.name}</option>
					{/each}
				</select>
				<select
					bind:value={selectedModel}
					class="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 focus:border-violet-500 focus:outline-none"
				>
					{#each filteredModels as m}
						<option value={m.id}>{m.name}</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Messages -->
		<div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
			{#if messages.length === 0}
				<div class="flex h-full items-center justify-center">
					<div class="text-center text-zinc-600">
						<p class="text-lg">跟 LadyMuse 聊聊你的创作想法</p>
						<p class="mt-2 text-sm">试试说：我想要空灵但暗黑的感觉</p>
					</div>
				</div>
			{/if}

			{#each messages as msg}
				{#if msg.role === 'tool'}
					<div class="flex justify-start">
						<div class="max-w-[75%] rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs text-zinc-500">
							{msg.content}
						</div>
					</div>
				{:else}
					<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
						<div
							class="max-w-[75%] rounded-xl px-4 py-3 {msg.role === 'user'
								? 'bg-violet-600 text-white'
								: 'bg-zinc-800 text-zinc-200'}"
						>
							<pre class="whitespace-pre-wrap font-sans text-sm leading-relaxed">{msg.content}</pre>
						</div>
					</div>
				{/if}
			{/each}

			{#if isLoading && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !messages[messages.length - 1].content}
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
				<button
					type="button"
					onclick={sendMessage}
					disabled={isLoading || !input.trim()}
					class="rounded-xl bg-violet-600 px-5 py-3 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
				>{isLoading ? '...' : '发送'}</button>
			</div>
		</div>
	</div>
</div>
