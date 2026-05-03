<script lang="ts">
  import StarRating from "./StarRating.svelte";
  import ColorLabel from "./ColorLabel.svelte";
  import FlagButtons from "./FlagButtons.svelte";
  import TagEditor from "./TagEditor.svelte";
  import MetadataViewer from "./MetadataViewer.svelte";

  interface SamplerInfo {
    id: string;
    classType: string;
    seed: number | null;
    steps: number | null;
    cfg: number | null;
    samplerName: string | null;
    scheduler: string | null;
    denoise: number | null;
  }

  interface ComfyUIMetadata {
    positivePrompts: string[];
    negativePrompts: string[];
    models: string[];
    loras: string[];
    width: number | null;
    height: number | null;
    samplers: SamplerInfo[];
  }

  interface Attributes {
    rating: number;
    colorLabel: string | null;
    flag: string | null;
    notes: string | null;
    stackId: number | null;
  }

  interface Tag {
    id: number;
    name: string;
    slug: string;
  }

  interface BrowseImage {
    filename: string;
    relativePath: string;
    size: number;
    modifiedAt: string;
    width: number | null;
    height: number | null;
    metadata: ComfyUIMetadata | null;
  }

  let {
    image,
    attributes = null,
    tags = [],
    allTags = [],
    onclose,
    onrate,
    oncolor,
    onflag,
    onaddtag,
    onremovetag,
    onzoom,
    ondelete,
  }: {
    image: BrowseImage;
    attributes?: Attributes | null;
    tags?: Tag[];
    allTags?: Tag[];
    onclose: () => void;
    onrate: (rating: number) => void;
    oncolor: (color: string | null) => void;
    onflag: (flag: string | null) => void;
    onaddtag: (name: string) => void;
    onremovetag: (tagId: number) => void;
    onzoom?: () => void;
    ondelete?: () => void;
  } = $props();

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  function formatDate(d: string | null): string {
    if (!d) return "";
    return new Date(d).toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getImageUrl(relativePath: string, modifiedAt?: string): string {
    const base = `/api/comfyui/images/${encodeURIComponent(relativePath)}`;
    return modifiedAt ? `${base}?t=${new Date(modifiedAt).getTime()}` : base;
  }

  let colorValue = $state(attributes?.colorLabel ?? null);
  let flagValue = $state(attributes?.flag ?? null);

  $effect(() => {
    if (colorValue !== (attributes?.colorLabel ?? null)) {
      oncolor(colorValue);
    }
  });
  $effect(() => {
    if (flagValue !== (attributes?.flag ?? null)) {
      onflag(flagValue);
    }
  });
</script>

<div
  class="w-96 shrink-0 border-l border-zinc-800 bg-zinc-900/50 overflow-y-auto p-4"
>
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-sm font-medium text-zinc-300">图片详情</h3>
    <div class="flex items-center gap-2">
      {#if onzoom}
        <button
          onclick={onzoom}
          class="text-zinc-500 hover:text-zinc-300"
          title="放大查看"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
            />
          </svg>
        </button>
      {/if}
      {#if ondelete}
        <button
          onclick={ondelete}
          class="text-zinc-500 hover:text-red-400"
          title="删除图片"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      {/if}
      <button onclick={onclose} class="text-zinc-500 hover:text-zinc-300">
        <svg
          class="h-4 w-4"
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
      </button>
    </div>
  </div>

  <!-- Image preview -->
  <div class="rounded-lg overflow-hidden bg-zinc-800 mb-4">
    <img
      src={getImageUrl(image.relativePath, image.modifiedAt)}
      alt=""
      class="w-full cursor-pointer"
      onclick={onzoom}
    />
  </div>

  <!-- Rating -->
  <div class="mb-3">
    <div class="text-xs text-zinc-500 mb-1">评分</div>
    <StarRating value={attributes?.rating ?? 0} onchange={onrate} />
  </div>

  <!-- Color Label -->
  <div class="mb-3">
    <div class="text-xs text-zinc-500 mb-1">颜色标记</div>
    <ColorLabel bind:value={colorValue} />
  </div>

  <!-- Pick/Reject -->
  <div class="mb-3">
    <div class="text-xs text-zinc-500 mb-1">标记</div>
    <FlagButtons bind:flag={flagValue} />
  </div>

  <!-- Tags -->
  <div class="mb-4">
    <div class="text-xs text-zinc-500 mb-1">标签</div>
    <TagEditor {tags} {allTags} onadd={onaddtag} onremove={onremovetag} />
  </div>

  <!-- File info -->
  <div class="space-y-2 mb-4">
    <div class="text-xs text-zinc-500 mb-2">文件信息</div>
    <div class="text-xs">
      <span class="text-zinc-500">文件名:</span>
      <span class="text-zinc-300" title={image.filename}>{image.filename}</span>
    </div>
    <div class="text-xs">
      <span class="text-zinc-500">大小:</span>
      <span class="text-zinc-300">{formatFileSize(image.size)}</span>
    </div>
    <div class="text-xs">
      <span class="text-zinc-500">修改时间:</span>
      <span class="text-zinc-300">{formatDate(image.modifiedAt)}</span>
    </div>
  </div>

  <!-- Metadata -->
  <div class="mb-4">
    <div class="text-xs text-zinc-500 mb-2">生成参数</div>
    <MetadataViewer
      metadata={image.metadata}
      width={image.width}
      height={image.height}
    />
  </div>
</div>
