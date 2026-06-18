<script lang="ts">
  interface Props {
    relativePath: string;
    index: number;
    onclick: (index: number) => void;
  }

  let { relativePath, index, onclick }: Props = $props();

  function getThumbnailUrl(): string {
    return `/api/share/thumbnails/${encodeURIComponent(relativePath)}`;
  }
</script>

<button
  onclick={() => onclick(index)}
  class="aspect-square bg-zinc-900 rounded-lg overflow-hidden cursor-pointer border border-zinc-800 hover:border-zinc-600 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500"
>
  <img
    src={getThumbnailUrl()}
    alt=""
    loading="lazy"
    class="w-full h-full object-contain"
  />
</button>
