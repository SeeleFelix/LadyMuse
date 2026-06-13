<script lang="ts">
  import StarRating from "./StarRating.svelte";
  import ColorLabel from "./ColorLabel.svelte";
  import FlagButtons from "./FlagButtons.svelte";
  import TagEditor from "./TagEditor.svelte";
  import MetadataViewer from "./MetadataViewer.svelte";
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

  let showPrompt = $state(false);

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return "-";
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

  function getFilename(): string {
    if (!image) return "";
    return image.relativePath.split("/").pop() || image.relativePath;
  }

  function getImageUrl(): string {
    if (!image) return "";
    return `/api/comfyui/images/${encodeURIComponent(image.relativePath)}`;
  }

  $effect(() => {
    console.log("[img-debug] DetailPanel render", {
      propPath: image?.relativePath ?? null,
      url: image ? getImageUrl() : null,
    });
  });

  function hasMetadata(): boolean {
    if (!image) return false;
    return !!(
      image.extractedModels.length > 0 ||
      image.extractedLoras.length > 0 ||
      image.extractedSamplers.length > 0 ||
      image.steps ||
      image.cfgScale ||
      image.seed ||
      image.positivePrompt ||
      image.negativePrompt
    );
  }

  // Convert ImageResult to MetadataViewer format
  function getMetadata() {
    if (!image) return null;
    return {
      models: image.extractedModels,
      loras: image.extractedLoras,
      samplers: image.extractedSamplers.map((name, i) => ({
        id: `sampler-${i}`,
        classType: name,
        seed: image.seed ? parseInt(image.seed, 10) : null,
        steps: image.steps,
        cfg: image.cfgScale,
        samplerName: name,
        scheduler: image.extractedSchedulers[i] || null,
        denoise: null,
      })),
      positivePrompts: image.positivePrompt ? [image.positivePrompt] : [],
      negativePrompts: image.negativePrompt ? [image.negativePrompt] : [],
    };
  }

  async function sendToComfyUI() {
    if (!image || !image.positivePrompt) return;
    // This will be connected to the ComfyUI integration later
    console.log("Send to ComfyUI:", image.relativePath);
  }
</script>

<div
  class="w-96 shrink-0 border-l border-zinc-800 bg-zinc-900/50 overflow-y-auto p-4"
>
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-sm font-medium text-zinc-300">图片详情</h3>
    {#if image}
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
    {/if}
  </div>

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
    <!-- Image preview -->
    <div class="rounded-lg overflow-hidden bg-zinc-800 mb-4">
      {#if image.isMissing}
        <div class="aspect-square flex items-center justify-center">
          <div class="text-center">
            <svg
              class="w-12 h-12 text-zinc-600 mx-auto mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 2.502-3.618V13.38c0-1.951-.962-3.618-2.502-3.618H5.114c-1.54 0-2.502 1.667-2.502 3.618v1.414c0 1.951.962 3.618 2.502 3.618z"
              />
            </svg>
            <p class="text-sm text-zinc-600">文件已丢失</p>
          </div>
        </div>
      {:else}
        <img
          src={getImageUrl()}
          alt=""
          class="w-full cursor-pointer"
          style="aspect-ratio: {image.aspectRatio ||
            '1/1'}; object-fit: contain;"
        />
      {/if}
    </div>

    <!-- Rating -->
    <div class="mb-3">
      <div class="text-xs text-zinc-500 mb-1">评分</div>
      <StarRating value={image.rating ?? 0} onchange={onrate} />
    </div>

    <!-- Color Label -->
    <div class="mb-3">
      <div class="text-xs text-zinc-500 mb-1">颜色标记</div>
      <ColorLabel value={image.colorLabel ?? null} onchange={oncolor} />
    </div>

    <!-- Pick/Reject -->
    <div class="mb-3">
      <div class="text-xs text-zinc-500 mb-1">标记</div>
      <FlagButtons flag={image.flag ?? null} onchange={onflag} />
    </div>

    <!-- Tags -->
    <div class="mb-4">
      <div class="text-xs text-zinc-500 mb-1">标签</div>
      <TagEditor
        tags={image.tags}
        {allTags}
        onadd={onaddtag}
        onremove={onremovetag}
      />
    </div>

    <!-- File info -->
    <div class="space-y-2 mb-4">
      <div class="text-xs text-zinc-500 mb-2">文件信息</div>
      <div class="text-xs">
        <span class="text-zinc-500">文件名:</span>
        <span class="text-zinc-300" title={getFilename()}>{getFilename()}</span>
      </div>
      <div class="text-xs">
        <span class="text-zinc-500">大小:</span>
        <span class="text-zinc-300">{formatFileSize(image.fileSize)}</span>
      </div>
      <div class="text-xs">
        <span class="text-zinc-500">尺寸:</span>
        <span class="text-zinc-300"
          >{image.width && image.height
            ? `${image.width}×${image.height}`
            : "-"}</span
        >
      </div>
      <div class="text-xs">
        <span class="text-zinc-500">格式:</span>
        <span class="text-zinc-300">{image.fileFormat || "-"}</span>
      </div>
      <div class="text-xs">
        <span class="text-zinc-500">创建时间:</span>
        <span class="text-zinc-300">{formatDate(image.createdAt)}</span>
      </div>
    </div>

    <!-- Metadata -->
    {#if hasMetadata()}
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <div class="text-xs text-zinc-500">生成参数</div>
          {#if image.positivePrompt || image.negativePrompt}
            <button
              onclick={() => (showPrompt = !showPrompt)}
              class="text-xs text-zinc-400 hover:text-zinc-300"
            >
              {showPrompt ? "隐藏" : "显示"}提示词
            </button>
          {/if}
        </div>
        <MetadataViewer
          metadata={getMetadata()}
          width={image.width}
          height={image.height}
        />
      </div>
    {/if}

    <!-- Send to ComfyUI button -->
    {#if image.positivePrompt}
      <button
        onclick={sendToComfyUI}
        class="w-full rounded border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-300 hover:bg-violet-500/20 transition-colors flex items-center justify-center gap-2"
      >
        <svg
          class="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
        发送到 ComfyUI
      </button>
    {/if}

    <!-- Delete -->
    <button
      onclick={ondelete}
      class="w-full rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
      >删除图片</button
    >
  {/if}
</div>
