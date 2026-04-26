<script lang="ts">
  interface Tag {
    id: number;
    name: string;
    slug: string;
  }

  let {
    tags = [],
    allTags = [],
    onadd,
    onremove,
  }: {
    tags: Tag[];
    allTags: Tag[];
    onadd: (name: string) => void;
    onremove: (tagId: number) => void;
  } = $props();

  let input = $state("");
  let suggestions = $derived(
    input.trim().length > 0
      ? allTags
          .filter((t) => t.name.toLowerCase().includes(input.toLowerCase()))
          .filter((t) => !tags.some((et) => et.id === t.id))
          .slice(0, 5)
      : [],
  );

  function addTag(name: string) {
    if (name.trim()) {
      onadd(name.trim());
      input = "";
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      addTag(input);
    }
  }
</script>

<div>
  <div class="flex flex-wrap gap-1 mb-2">
    {#each tags as tag}
      <span
        class="inline-flex items-center gap-1 rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-200"
      >
        {tag.name}
        <button
          onclick={() => onremove(tag.id)}
          class="text-zinc-400 hover:text-white">×</button
        >
      </span>
    {/each}
  </div>
  <div class="relative">
    <input
      type="text"
      bind:value={input}
      onkeydown={handleKeydown}
      placeholder="添加标签..."
      class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
    />
    {#if suggestions.length > 0}
      <div
        class="absolute z-10 mt-1 w-full rounded border border-zinc-700 bg-zinc-800 shadow-lg"
      >
        {#each suggestions as s}
          <button
            onclick={() => addTag(s.name)}
            class="block w-full px-2 py-1 text-left text-xs text-zinc-300 hover:bg-zinc-700"
            >{s.name}</button
          >
        {/each}
      </div>
    {/if}
  </div>
</div>
