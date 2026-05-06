<script lang="ts">
  let {
    flag = null as string | null,
    onchange,
  }: { flag?: string | null; onchange?: (flag: string | null) => void } =
    $props();

  function toggle(target: string) {
    onchange?.(flag === target ? null : target);
  }
</script>

<div class="flex items-center gap-2">
  <button
    onclick={() => toggle("pick")}
    class="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors {flag ===
    'pick'
      ? 'bg-white/10 text-white'
      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}"
  >
    <svg
      class="w-3.5 h-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M5 13l4 4L19 7"
      />
    </svg>
    Pick
  </button>
  <button
    onclick={() => toggle("reject")}
    class="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors {flag ===
    'reject'
      ? 'bg-red-500/20 text-red-300'
      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}"
  >
    <svg
      class="w-3.5 h-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
    Reject
  </button>
</div>
