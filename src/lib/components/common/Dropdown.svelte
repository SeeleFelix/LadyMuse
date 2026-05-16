<script lang="ts">
  import { onMount } from "svelte";

  let {
    value = $bindable(),
    options = [] as { value: string; label: string }[],
    onchange,
  }: {
    value?: string;
    options: { value: string; label: string }[];
    onchange?: (value: string) => void;
  } = $props();

  let open = $state(false);
  let el = $state<HTMLDivElement | null>(null);

  let selected = $derived(options.find((o) => o.value === value));

  function select(val: string) {
    value = val;
    open = false;
    onchange?.(val);
  }

  function outside(e: MouseEvent) {
    if (el && !el.contains(e.target as Node)) open = false;
  }

  onMount(() => {
    document.addEventListener("click", outside);
    return () => document.removeEventListener("click", outside);
  });
</script>

<div bind:this={el} class="relative">
  <button
    type="button"
    onclick={() => (open = !open)}
    class="flex items-center gap-2 rounded-lg bg-zinc-800/80 border border-zinc-700/80 px-3 py-2 text-sm transition-all duration-150 hover:bg-zinc-800 hover:border-zinc-600 {open
      ? 'border-violet-500/60 bg-zinc-800 ring-1 ring-violet-500/20'
      : ''}"
  >
    <span class="text-zinc-200">{selected?.label}</span>
    <svg
      class="h-3.5 w-3.5 text-zinc-500 transition-transform duration-200 {open
        ? '-rotate-180'
        : ''}"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  </button>

  {#if open}
    <div
      class="absolute top-full left-0 mt-1.5 min-w-full z-50 rounded-lg border border-zinc-700/80 bg-zinc-850 shadow-xl shadow-black/50 py-1 overflow-hidden"
      style="background-color: #1c1c1f"
    >
      {#each options as opt}
        <button
          type="button"
          onclick={() => select(opt.value)}
          class="w-full px-3.5 py-2 text-left text-sm transition-colors whitespace-nowrap
            {opt.value === value
            ? 'text-violet-300 bg-violet-500/10'
            : 'text-zinc-300 hover:bg-zinc-700/60'}"
        >
          {opt.label}
        </button>
      {/each}
    </div>
  {/if}
</div>
