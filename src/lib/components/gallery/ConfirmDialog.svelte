<script lang="ts">
  let {
    title = "确认删除",
    message = "",
    requireInput = "",
    onconfirm,
    oncancel,
  }: {
    title?: string;
    message?: string;
    requireInput?: string;
    onconfirm: () => void;
    oncancel: () => void;
  } = $props();

  let input = $state("");
  let confirmed = $state(false);
  let inputMatches = $derived(
    requireInput.length === 0 || input === requireInput,
  );

  function handleConfirm() {
    if (requireInput && !inputMatches) return;
    if (!confirmed) {
      confirmed = true;
      return;
    }
    onconfirm();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") oncancel();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/80">
  <div
    class="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
  >
    <h3 class="text-lg font-semibold text-red-400 mb-3">{title}</h3>
    <p class="text-sm text-zinc-300 mb-4">{message}</p>

    {#if requireInput && !confirmed}
      <div class="mb-4">
        <p class="text-xs text-zinc-500 mb-2">
          请输入 <code class="text-zinc-300 bg-zinc-800 px-1 rounded"
            >{requireInput}</code
          > 确认：
        </p>
        <input
          type="text"
          bind:value={input}
          class="w-full rounded border {inputMatches
            ? 'border-zinc-600'
            : 'border-red-500/50'} bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
        />
      </div>
    {/if}

    {#if confirmed}
      <div class="mb-4 p-3 rounded bg-red-500/10 border border-red-500/30">
        <p class="text-sm text-red-300">
          此操作不可逆，图片将被永久删除。确定继续？
        </p>
      </div>
    {/if}

    <div class="flex justify-end gap-3">
      <button
        onclick={oncancel}
        class="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-800"
        >取消</button
      >
      {#if !confirmed}
        <button
          onclick={handleConfirm}
          disabled={requireInput.length > 0 && !inputMatches}
          class="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
          >下一步</button
        >
      {:else}
        <button
          onclick={handleConfirm}
          class="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-500"
          >确认删除</button
        >
      {/if}
    </div>
  </div>
</div>
