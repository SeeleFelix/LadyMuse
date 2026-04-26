<script lang="ts">
  interface Collection {
    id: number;
    name: string;
    description: string | null;
    coverImagePath: string | null;
    isSmart: boolean;
    smartCriteria: string | null;
    imageCount: number;
  }

  let {
    collections = [],
    activeCollectionId = null,
    onselect,
    oncreate,
    ondelete,
  }: {
    collections: Collection[];
    activeCollectionId?: number | null;
    onselect?: (id: number | null) => void;
    oncreate?: (name: string) => void;
    ondelete?: (id: number) => void;
  } = $props();

  let newName = $state("");
  let showInput = $state(false);

  function create() {
    if (newName.trim() && oncreate) {
      oncreate(newName.trim());
      newName = "";
      showInput = false;
    }
  }
</script>

<div
  class="w-56 shrink-0 border-r border-zinc-800 bg-zinc-900 flex flex-col overflow-hidden"
>
  <div
    class="px-3 py-2 border-b border-zinc-800 flex items-center justify-between"
  >
    <h3 class="text-xs font-medium text-zinc-400">收藏集</h3>
    <button
      onclick={() => (showInput = !showInput)}
      class="text-zinc-500 hover:text-zinc-300"
    >
      <svg
        class="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 4v16m8-8H4"
        />
      </svg>
    </button>
  </div>

  {#if showInput}
    <div class="px-3 py-2 border-b border-zinc-800">
      <div class="flex gap-1">
        <input
          type="text"
          bind:value={newName}
          onkeydown={(e) => e.key === "Enter" && create()}
          placeholder="收藏集名称"
          class="flex-1 min-w-0 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
        />
        <button
          onclick={create}
          class="text-xs text-violet-400 hover:text-violet-300">✓</button
        >
      </div>
    </div>
  {/if}

  <div class="flex-1 overflow-y-auto">
    <!-- All images -->
    <button
      onclick={() => onselect?.(null)}
      class="w-full text-left px-3 py-2 text-xs {activeCollectionId === null
        ? 'bg-zinc-800 text-zinc-100'
        : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}"
    >
      全部图片
    </button>

    {#each collections as c}
      <div class="group flex items-center">
        <button
          onclick={() => onselect?.(c.id)}
          class="flex-1 text-left px-3 py-2 text-xs truncate {activeCollectionId ===
          c.id
            ? 'bg-zinc-800 text-zinc-100'
            : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}"
        >
          <span class="truncate">{c.name}</span>
          <span class="text-zinc-600 ml-1">{c.imageCount}</span>
          {#if c.isSmart}
            <span class="text-violet-500 ml-1" title="智能收藏集">⚡</span>
          {/if}
        </button>
        {#if !c.isSmart && ondelete}
          <button
            onclick={() => ondelete(c.id)}
            class="hidden group-hover:block px-2 text-zinc-600 hover:text-red-400"
            >×</button
          >
        {/if}
      </div>
    {/each}
  </div>
</div>
