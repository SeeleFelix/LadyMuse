<script lang="ts">
  const COLORS = [
    { value: "red", class: "bg-red-500" },
    { value: "yellow", class: "bg-yellow-500" },
    { value: "green", class: "bg-green-500" },
    { value: "blue", class: "bg-blue-500" },
    { value: "purple", class: "bg-purple-500" },
  ];

  let { value = $bindable(null as string | null) }: { value?: string | null } =
    $props();
</script>

<div class="flex items-center gap-1.5">
  {#each COLORS as c}
    <button
      onclick={() => (value = value === c.value ? null : c.value)}
      class="w-4 h-4 rounded-full {c.class} transition-opacity {value ===
      c.value
        ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-900 opacity-100'
        : 'opacity-40 hover:opacity-70'}"
      title={c.value}
    ></button>
  {/each}
  {#if value}
    <button
      onclick={() => (value = null)}
      class="text-xs text-zinc-500 hover:text-zinc-300 ml-1">✕</button
    >
  {/if}
</div>
