<script lang="ts">
  import type { TrashListItem } from "$lib/stores/gallery-store.svelte";

  let {
    items = [],
    onrestore,
    onpurge,
    onempty,
    onback,
  }: {
    items: TrashListItem[];
    onrestore: (id: number) => void;
    onpurge: (id: number) => void;
    onempty: () => void;
    onback: () => void;
  } = $props();

  let confirmEmpty = $state(false);

  // Build a trash-thumbnail URL by encoding each path segment on its own.
  // Encoding the whole ".trash/<id>/<basename>" as one string turns the slashes
  // into %2F, which SvelteKit's [...path] matcher tolerates but proxies/CDNs may
  // mangle — segment-wise encoding keeps the slashes literal and portable.
  function trashThumbUrl(item: TrashListItem): string {
    const basename =
      item.originalRelativePath.split(/[\\/]/).pop() ??
      item.originalRelativePath;
    const segments = [".trash", String(item.id), basename].map(
      encodeURIComponent,
    );
    return `/api/comfyui/images/${segments.join("/")}`;
  }
</script>

<div class="flex h-full flex-col gap-3 p-4">
  <div class="flex items-center gap-3">
    <button
      onclick={onback}
      class="rounded border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:text-zinc-100"
    >
      ← 返回图库
    </button>
    <h2 class="text-sm font-medium text-zinc-200">回收站 ({items.length})</h2>
    <div class="ml-auto">
      {#if confirmEmpty}
        <span class="mr-2 text-xs text-red-400">确认清空？此操作不可撤销</span>
        <button
          onclick={() => {
            onempty();
            confirmEmpty = false;
          }}
          class="mr-1 rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20"
          >确认清空</button
        >
        <button
          onclick={() => (confirmEmpty = false)}
          class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400"
          >取消</button
        >
      {:else}
        <button
          onclick={() => (confirmEmpty = true)}
          class="rounded border border-red-500/20 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10"
          disabled={items.length === 0}>清空回收站</button
        >
      {/if}
    </div>
  </div>

  {#if items.length === 0}
    <div class="flex flex-1 items-center justify-center text-sm text-zinc-600">
      回收站为空
    </div>
  {:else}
    <div
      class="grid flex-1 content-start gap-3 overflow-y-auto"
      style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));"
    >
      {#each items as item (item.id)}
        <div
          class="group relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
        >
          <img
            src={trashThumbUrl(item)}
            alt=""
            class="aspect-square w-full object-cover opacity-60"
            loading="lazy"
            onerror={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <div class="p-2">
            <div
              class="truncate text-xs text-zinc-300"
              title={item.originalRelativePath}
            >
              {item.originalRelativePath.split(/[\\/]/).pop()}
            </div>
            <div class="text-[10px] text-zinc-600">
              {new Date(item.deletedAt).toLocaleString()}
            </div>
          </div>
          <div class="flex gap-1 p-2 pt-0">
            <button
              onclick={() => onrestore(item.id)}
              class="flex-1 rounded border border-emerald-500/20 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/10"
              >恢复</button
            >
            <button
              onclick={() => onpurge(item.id)}
              class="flex-1 rounded border border-red-500/20 px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/10"
              >彻底删除</button
            >
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
