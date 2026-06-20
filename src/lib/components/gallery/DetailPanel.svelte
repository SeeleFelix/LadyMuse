<script lang="ts">
  import ImageDetail from "./ImageDetail.svelte";
  import type { ImageResult } from "$lib/stores/gallery-store.svelte";

  interface Tag {
    id: number;
    name: string;
    slug: string;
  }

  let {
    image,
    allTags = [],
    onrate,
    oncolor,
    onflag,
    onaddtag,
    onremovetag,
    onclose,
    ondelete,
  }: {
    image: ImageResult | null;
    allTags?: Tag[];
    onrate: (rating: number) => void;
    oncolor: (color: string | null) => void;
    onflag: (flag: string | null) => void;
    onaddtag: (tagName: string) => void;
    onremovetag: (tagId: number) => void;
    onclose: () => void;
    ondelete: () => void;
  } = $props();

  function getImageUrl(relativePath: string): string {
    return `/api/comfyui/images/${encodeURIComponent(relativePath)}`;
  }
</script>

<div
  class="w-96 shrink-0 border-l border-zinc-800 bg-zinc-900/50 overflow-y-auto p-4"
>
  {#if !image}
    <div class="flex flex-col items-center justify-center h-64 text-center">
      <svg
        class="w-10 h-10 text-zinc-700 mb-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <p class="text-sm text-zinc-600">点击或选择图片</p>
      <p class="text-xs text-zinc-700 mt-1">查看详情和元数据</p>
    </div>
  {:else}
    <ImageDetail
      filename={image.relativePath.split("/").pop() || image.relativePath}
      fileSize={image.fileSize}
      width={image.width}
      height={image.height}
      fileFormat={image.fileFormat}
      rating={image.rating}
      colorLabel={image.colorLabel}
      flag={image.flag}
      tags={image.tags}
      {allTags}
      extractedModels={image.extractedModels}
      extractedLoras={image.extractedLoras}
      extractedSamplers={image.extractedSamplers}
      extractedSchedulers={image.extractedSchedulers}
      steps={image.steps}
      cfgScale={image.cfgScale}
      seed={image.seed}
      positivePrompt={image.positivePrompt}
      negativePrompt={image.negativePrompt}
      readonly={false}
      showThumbnail={true}
      showDelete={true}
      closeable={true}
      thumbnailUrl={image.isMissing ? "" : getImageUrl(image.relativePath)}
      isMissing={image.isMissing ?? false}
      {onclose}
      {onrate}
      {oncolor}
      {onflag}
      {onaddtag}
      {onremovetag}
      {ondelete}
    />
  {/if}
</div>
