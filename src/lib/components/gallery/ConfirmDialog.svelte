<script lang="ts">
  let {
    title = "确认删除",
    message = "",
    onconfirm,
    oncancel,
  }: {
    title?: string;
    message?: string;
    onconfirm: () => void;
    oncancel: () => void;
  } = $props();

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

    <div class="mb-4 p-3 rounded bg-red-500/10 border border-red-500/30">
      <p class="text-sm text-red-300">此操作不可逆，图片将被永久删除。</p>
    </div>

    <div class="flex justify-end gap-3">
      <button
        onclick={oncancel}
        class="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-800"
        >取消</button
      >
      <button
        onclick={onconfirm}
        class="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-500"
        >确认删除</button
      >
    </div>
  </div>
</div>
