<script lang="ts">
  import { onMount } from "svelte";

  interface Technique {
    id: number;
    name: string;
    nameZh: string | null;
    promptKeywords: string;
    nlDescription: string | null;
    weightHint: number | null;
    negativeKeywords: string | null;
  }

  interface SelectedItem {
    technique: Technique;
    weight: number;
  }

  interface Style {
    id: number;
    name: string;
    nameZh: string | null;
    positiveTemplate: string;
    nlTemplate: string | null;
    negativePrompt: string | null;
    qualityTags: string | null;
  }

  interface Subcategory {
    id: number;
    name: string;
    nameZh: string | null;
    categoryId: number;
    techniques: Technique[];
  }

  interface Category {
    id: number;
    slug: string;
    name: string;
    nameZh: string | null;
    icon: string | null;
    subcategories: Subcategory[];
  }

  let categories = $state<Category[]>([]);
  let allStyles = $state<Style[]>([]);
  let subject = $state("");
  let selectedStyle = $state<Style | null>(null);
  let searchQuery = $state("");
  let promptMode = $state<"tag" | "nl">("tag");
  let copied = $state(false);
  let copiedNeg = $state(false);
  let loading = $state(true);

  let slots: Record<string, SelectedItem[]> = $state({
    lighting: [],
    composition: [],
    color: [],
    camera: [],
    atmosphere: [],
  });

  const slotLabels: Record<string, string> = {
    lighting: "光影",
    composition: "构图",
    color: "色彩",
    camera: "视角",
    atmosphere: "氛围",
  };

  onMount(async () => {
    const [techRes, styleRes] = await Promise.all([
      fetch("/api/knowledge"),
      fetch("/api/styles?flat=true"),
    ]);
    if (techRes.ok) categories = await techRes.json();
    if (styleRes.ok) allStyles = await styleRes.json();
    loading = false;
  });

  function getTechniquesForSlot(slotKey: string): Technique[] {
    const cat = categories.find((c) => c.slug === slotKey);
    if (!cat) return [];
    const all = cat.subcategories.flatMap((s) => s.techniques);
    const selectedIds = new Set(
      Object.values(slots)
        .flat()
        .map((i) => i.technique.id),
    );
    return all.filter((t) => !selectedIds.has(t.id));
  }

  function addToSlot(slot: string, tech: Technique) {
    if (slots[slot].find((i) => i.technique.id === tech.id)) return;
    slots[slot] = [
      ...slots[slot],
      { technique: tech, weight: tech.weightHint ?? 1.0 },
    ];
  }

  function removeFromSlot(slot: string, techId: number) {
    slots[slot] = slots[slot].filter((i) => i.technique.id !== techId);
  }

  let positivePrompt = $derived.by(() => {
    if (promptMode === "nl") return buildNLPrompt();
    return buildTagPrompt();
  });

  let negativePrompt = $derived.by(() => {
    const parts: string[] = [];
    if (selectedStyle?.negativePrompt) parts.push(selectedStyle.negativePrompt);
    for (const items of Object.values(slots)) {
      for (const item of items) {
        if (item.technique.negativeKeywords)
          parts.push(item.technique.negativeKeywords);
      }
    }
    return [
      ...new Set(
        parts
          .join(", ")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ].join(", ");
  });

  function buildTagPrompt(): string {
    const parts: string[] = [];
    if (subject.trim()) parts.push(subject.trim());
    if (selectedStyle) {
      const tpl = selectedStyle.positiveTemplate
        .replace("{subject}", "")
        .replace(/,\s*,/, ",")
        .replace(/^,\s*/, "");
      if (tpl.trim()) parts.push(tpl.trim());
    }
    for (const items of Object.values(slots)) {
      for (const item of items) {
        const kws = item.technique.promptKeywords;
        if (item.weight !== 1.0) {
          const weighted = kws
            .split(",")
            .map((k) => `(${k.trim()}:${item.weight})`)
            .join(", ");
          parts.push(weighted);
        } else {
          parts.push(kws);
        }
      }
    }
    if (selectedStyle?.qualityTags) parts.push(selectedStyle.qualityTags);
    return parts.join(", ");
  }

  function buildNLPrompt(): string {
    const subjectText = subject.trim() || "a scene";
    const nlParts: string[] = [];

    if (selectedStyle?.nlTemplate) {
      nlParts.push(selectedStyle.nlTemplate.replace("{subject}", subjectText));
    } else if (selectedStyle) {
      nlParts.push(
        `An image of ${subjectText} in ${selectedStyle.nameZh || selectedStyle.name} style`,
      );
    } else {
      nlParts.push(`An image of ${subjectText}`);
    }

    for (const items of Object.values(slots)) {
      for (const item of items) {
        if (item.technique.nlDescription) {
          nlParts.push(item.technique.nlDescription);
        } else {
          nlParts.push(item.technique.promptKeywords);
        }
      }
    }

    if (selectedStyle?.qualityTags) nlParts.push(selectedStyle.qualityTags);

    return nlParts.join(", ");
  }

  function copyPositive() {
    navigator.clipboard.writeText(positivePrompt);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  function copyNegative() {
    navigator.clipboard.writeText(negativePrompt);
    copiedNeg = true;
    setTimeout(() => (copiedNeg = false), 2000);
  }
</script>

<div class="flex h-full">
  <!-- Left: Technique palette -->
  <div
    class="w-80 shrink-0 border-r border-zinc-800 bg-zinc-900/50 overflow-y-auto p-4"
  >
    <h2 class="text-lg font-semibold text-zinc-200 mb-3">技法库</h2>

    <input
      type="text"
      placeholder="搜索技法..."
      bind:value={searchQuery}
      class="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
    />

    {#if loading}
      <div class="mt-4 text-zinc-500">加载中...</div>
    {:else}
      {#each Object.entries(slotLabels) as [slotKey, label]}
        {@const techs = getTechniquesForSlot(slotKey)}
        {@const filtered = searchQuery
          ? techs.filter(
              (t) =>
                (t.nameZh || t.name).includes(searchQuery) ||
                t.promptKeywords
                  .toLowerCase()
                  .includes(searchQuery.toLowerCase()),
            )
          : techs}
        {#if filtered.length > 0}
          <div class="mt-4">
            <h3 class="text-sm font-medium text-zinc-400 mb-2">{label}</h3>
            <div class="flex flex-wrap gap-1">
              {#each filtered.slice(0, 20) as tech}
                <button
                  onclick={() => addToSlot(slotKey, tech)}
                  class="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:border-violet-500 hover:text-violet-300 transition-colors"
                  >{tech.nameZh || tech.name}</button
                >
              {/each}
              {#if filtered.length > 20}
                <span class="text-xs text-zinc-600"
                  >+{filtered.length - 20} 更多</span
                >
              {/if}
            </div>
          </div>
        {/if}
      {/each}
    {/if}
  </div>

  <!-- Right: Builder -->
  <div class="flex-1 overflow-y-auto p-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-zinc-100">提示词构建器</h1>
      <div class="flex gap-1 rounded-lg border border-zinc-700 p-1">
        <button
          onclick={() => (promptMode = "tag")}
          class="rounded-md px-3 py-1 text-xs {promptMode === 'tag'
            ? 'bg-violet-600 text-white'
            : 'text-zinc-400 hover:text-zinc-200'}">标签 (SD)</button
        >
        <button
          onclick={() => (promptMode = "nl")}
          class="rounded-md px-3 py-1 text-xs {promptMode === 'nl'
            ? 'bg-violet-600 text-white'
            : 'text-zinc-400 hover:text-zinc-200'}">自然语言 (FLUX)</button
        >
      </div>
    </div>

    <!-- Subject -->
    <div class="mt-6">
      <label class="text-sm font-medium text-zinc-300">主体描述</label>
      <textarea
        bind:value={subject}
        placeholder={promptMode === "nl"
          ? "用自然语言描述场景... 例如：一个女人站在古老的教堂中殿，阳光透过彩色玻璃窗洒落"
          : "描述你的主体... 例如：一个站在古教堂里的女人"}
        rows="2"
        class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-violet-500 focus:outline-none resize-none"
      ></textarea>
    </div>

    <!-- Style -->
    <div class="mt-4">
      <label class="text-sm font-medium text-zinc-300">风格</label>
      <div class="mt-1 flex flex-wrap gap-2">
        <button
          onclick={() => (selectedStyle = null)}
          class="rounded-lg border px-3 py-2 text-xs {!selectedStyle
            ? 'border-violet-500 bg-violet-600/20 text-violet-300'
            : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'}"
          >无</button
        >
        {#each allStyles as style}
          <button
            onclick={() =>
              (selectedStyle = selectedStyle?.id === style.id ? null : style)}
            class="rounded-lg border px-3 py-2 text-xs {selectedStyle?.id ===
            style.id
              ? 'border-violet-500 bg-violet-600/20 text-violet-300'
              : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'}"
            >{style.nameZh || style.name}</button
          >
        {/each}
      </div>
    </div>

    <!-- Dimension slots -->
    <div class="mt-6 space-y-3">
      {#each Object.entries(slotLabels) as [slot, label]}
        <div class="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-medium text-zinc-300">{label}</h3>
            <span class="text-xs text-zinc-600">{slots[slot].length} 已选</span>
          </div>
          <div class="mt-2 flex flex-wrap gap-1.5">
            {#each slots[slot] as item (item.technique.id)}
              <span
                class="inline-flex items-center gap-1 rounded bg-violet-600/20 px-2 py-1 text-xs text-violet-300"
              >
                {item.technique.nameZh || item.technique.name}
                {#if promptMode === "tag"}
                  <input
                    type="number"
                    value={item.weight}
                    min="0.5"
                    max="2"
                    step="0.1"
                    class="w-10 rounded bg-zinc-800 px-1 py-0.5 text-center text-xs text-zinc-300"
                    onchange={(e) => {
                      const val = parseFloat(
                        (e.target as HTMLInputElement).value,
                      );
                      if (!isNaN(val)) item.weight = val;
                    }}
                  />
                {/if}
                <button
                  onclick={() => removeFromSlot(slot, item.technique.id)}
                  class="text-zinc-500 hover:text-red-400">x</button
                >
              </span>
            {/each}
            {#if slots[slot].length === 0}
              <span class="text-xs text-zinc-600">未选择</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <!-- Generated Prompt -->
    <div class="mt-6 rounded-lg border border-violet-600/30 bg-zinc-900 p-4">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-medium text-zinc-300">
          正向提示词 ({promptMode === "tag" ? "标签模式" : "自然语言模式"})
        </h3>
        <button
          onclick={copyPositive}
          class="rounded bg-violet-600 px-3 py-1 text-xs text-white hover:bg-violet-500"
          >{copied ? "已复制!" : "复制"}</button
        >
      </div>
      <pre
        class="whitespace-pre-wrap text-xs text-zinc-300 leading-relaxed">{positivePrompt ||
          "开始添加元素来构建提示词..."}</pre>
    </div>

    {#if negativePrompt}
      <div class="mt-3 rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-medium text-zinc-300">反向提示词</h3>
          <button
            onclick={copyNegative}
            class="rounded bg-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
            >{copiedNeg ? "已复制!" : "复制"}</button
          >
        </div>
        <pre
          class="whitespace-pre-wrap text-xs text-red-300/70 leading-relaxed">{negativePrompt}</pre>
      </div>
    {/if}
  </div>
</div>
