<script lang="ts">
	import { onMount } from 'svelte';

	interface Technique {
		id: number;
		name: string;
		nameZh: string | null;
		description: string | null;
		promptKeywords: string;
		negativeKeywords: string | null;
		moodTags: string | null;
		difficulty: string | null;
	}

	interface Subcategory {
		id: number;
		name: string;
		nameZh: string | null;
		techniques: Technique[];
	}

	interface Category {
		id: number;
		name: string;
		nameZh: string | null;
		icon: string | null;
		subcategories: Subcategory[];
	}

	let categories = $state<Category[]>([]);
	let selectedTechnique = $state<Technique | null>(null);
	let searchQuery = $state('');
	let moodFilter = $state('');
	let loading = $state(true);
	let copied = $state(false);

	const moodMap: Record<string, string> = {
		dramatic: '戏剧性', peaceful: '宁静', energetic: '活力',
		mysterious: '神秘', romantic: '浪漫', dark: '暗黑',
		bright: '明亮', warm: '温暖', cool: '清冷',
		dreamy: '梦幻', futuristic: '未来感', ethereal: '空灵'
	};

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		loading = true;
		const params = new URLSearchParams();
		if (searchQuery) params.set('search', searchQuery);
		if (moodFilter) params.set('mood', moodFilter);
		const res = await fetch(`/api/knowledge?${params}`);
		if (res.ok) categories = await res.json();
		loading = false;
	}

	function copyKeywords(keywords: string) {
		navigator.clipboard.writeText(keywords);
		copied = true;
		setTimeout(() => copied = false, 2000);
	}

	const difficultyMap: Record<string, string> = {
		beginner: '入门', intermediate: '进阶', advanced: '高级'
	};
</script>

<div class="flex h-full">
	<div class="w-72 shrink-0 border-r border-zinc-800 bg-zinc-900/50 p-4 overflow-y-auto">
		<h2 class="text-lg font-semibold text-zinc-200 mb-4">艺术知识库</h2>

		<input
			type="text"
			placeholder="搜索技法..."
			bind:value={searchQuery}
			oninput={() => loadData()}
			class="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
		/>

		<div class="mt-3 flex flex-wrap gap-1.5">
			<button
				onclick={() => { moodFilter = ''; loadData(); }}
				class="rounded-full px-2.5 py-1 text-xs {!moodFilter ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}"
			>全部</button>
			{#each Object.entries(moodMap) as [key, label]}
				<button
					onclick={() => { moodFilter = key; loadData(); }}
					class="rounded-full px-2.5 py-1 text-xs {moodFilter === key ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}"
				>{label}</button>
			{/each}
		</div>

		<div class="mt-4 space-y-2">
			{#each categories as cat}
				{@const allTechs = cat.subcategories.flatMap((s) => s.techniques)}
				{#if allTechs.length > 0}
					<div>
						<div class="flex items-center gap-2 text-sm font-medium text-zinc-300">
							<span>{cat.icon || '●'}</span>
							<span>{cat.nameZh || cat.name}</span>
							<span class="text-xs text-zinc-600">({allTechs.length})</span>
						</div>
						<div class="ml-4 mt-1 space-y-0.5">
							{#each cat.subcategories as sub}
								{#if sub.techniques.length > 0}
									<div class="text-xs text-zinc-500 font-medium mt-1.5">{sub.nameZh || sub.name}</div>
									{#each sub.techniques as tech}
										<button
											onclick={() => selectedTechnique = tech}
											class="block w-full text-left rounded px-2 py-1 text-xs {selectedTechnique?.id === tech.id ? 'bg-violet-600/20 text-violet-300' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}"
										>{tech.nameZh || tech.name}</button>
									{/each}
								{/if}
							{/each}
						</div>
					</div>
				{/if}
			{/each}
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-6">
		{#if loading}
			<div class="text-zinc-500">加载中...</div>
		{:else if selectedTechnique}
			<div>
				<div class="flex items-start justify-between">
					<div>
						<h1 class="text-2xl font-bold text-zinc-100">{selectedTechnique.nameZh || selectedTechnique.name}</h1>
						<p class="mt-1 text-base text-zinc-500">{selectedTechnique.name}</p>
					</div>
					{#if selectedTechnique.difficulty}
						<span class="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">{difficultyMap[selectedTechnique.difficulty] || selectedTechnique.difficulty}</span>
					{/if}
				</div>

				{#if selectedTechnique.description}
					<div class="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
						<h3 class="text-sm font-medium text-zinc-300 mb-2">说明</h3>
						<p class="text-sm text-zinc-400 leading-relaxed">{selectedTechnique.description}</p>
					</div>
				{/if}

				<div class="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
					<div class="flex items-center justify-between mb-2">
						<h3 class="text-sm font-medium text-zinc-300">正向关键词</h3>
						<button
							onclick={() => copyKeywords(selectedTechnique!.promptKeywords)}
							class="rounded bg-violet-600 px-3 py-1 text-xs text-white hover:bg-violet-500"
						>{copied ? '已复制!' : '复制'}</button>
					</div>
					<div class="flex flex-wrap gap-1.5">
						{#each selectedTechnique.promptKeywords.split(',').map((k) => k.trim()).filter(Boolean) as keyword}
							<span class="rounded bg-violet-600/20 px-2.5 py-1 text-xs text-violet-300">{keyword}</span>
						{/each}
					</div>
				</div>

				{#if selectedTechnique.negativeKeywords}
					<div class="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
						<h3 class="text-sm font-medium text-zinc-300 mb-2">反向关键词</h3>
						<div class="flex flex-wrap gap-1.5">
							{#each selectedTechnique.negativeKeywords.split(',').map((k) => k.trim()).filter(Boolean) as keyword}
								<span class="rounded bg-red-600/20 px-2.5 py-1 text-xs text-red-300">{keyword}</span>
							{/each}
						</div>
					</div>
				{/if}

				{#if selectedTechnique.moodTags}
					<div class="mt-4">
						<h3 class="text-sm font-medium text-zinc-300 mb-2">氛围标签</h3>
						<div class="flex flex-wrap gap-1.5">
							{#each selectedTechnique.moodTags.split(',').map((m) => m.trim()).filter(Boolean) as tag}
								<span class="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">{tag}</span>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<div class="flex h-full items-center justify-center text-zinc-600">
				从左侧选择一个技法查看详情
			</div>
		{/if}
	</div>
</div>
