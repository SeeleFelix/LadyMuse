<script lang="ts">
  let {
    value = 0,
    onchange,
  }: { value?: number; onchange?: (r: number) => void } = $props();

  function set(r: number) {
    onchange?.(r === value ? 0 : r);
  }
</script>

<div class="flex items-center gap-1">
  {#each [1, 2, 3, 4, 5] as r}
    <button
      onclick={() => set(r)}
      class="text-lg {r <= value
        ? 'text-amber-400'
        : 'text-zinc-600'} hover:text-amber-300 transition-colors">★</button
    >
  {/each}
  {#if value > 0}
    <button
      onclick={() => onchange?.(0)}
      class="text-xs text-zinc-600 hover:text-zinc-300 ml-1 transition-colors"
      title="清除评分">✕</button
    >
  {/if}
</div>
