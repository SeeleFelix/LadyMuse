<script lang="ts">
  import MetadataViewer from "./MetadataViewer.svelte";
  import StarRating from "./StarRating.svelte";

  let {
    filename,
    fileSize,
    width,
    height,
    fileFormat,
    rating,
    extractedModels = [],
    extractedLoras = [],
    extractedSamplers = [],
    extractedSchedulers = [],
    steps,
    cfgScale,
    seed,
    positivePrompt,
    negativePrompt,
  }: {
    filename: string;
    fileSize: number | null;
    width: number | null;
    height: number | null;
    fileFormat: string | null;
    rating: number | null;
    extractedModels?: string[];
    extractedLoras?: string[];
    extractedSamplers?: string[];
    extractedSchedulers?: string[];
    steps?: number | null;
    cfgScale?: number | null;
    seed?: string | null;
    positivePrompt?: string | null;
    negativePrompt?: string | null;
  } = $props();

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  function hasMetadata(): boolean {
    return !!(
      extractedModels.length > 0 ||
      extractedLoras.length > 0 ||
      extractedSamplers.length > 0 ||
      steps ||
      cfgScale ||
      seed ||
      positivePrompt ||
      negativePrompt
    );
  }

  function getMetadata() {
    return {
      models: extractedModels,
      loras: extractedLoras,
      samplers: extractedSamplers.map((name, i) => ({
        id: `sampler-${i}`,
        classType: name,
        seed: seed ? parseInt(seed, 10) : null,
        steps,
        cfg: cfgScale,
        samplerName: name,
        scheduler: extractedSchedulers[i] || null,
        denoise: null,
      })),
      positivePrompts: positivePrompt ? [positivePrompt] : [],
      negativePrompts: negativePrompt ? [negativePrompt] : [],
    };
  }
</script>

<div class="space-y-4">
  <!-- Rating (read-only) -->
  {#if (rating ?? 0) > 0}
    <div>
      <div class="text-xs text-zinc-500 mb-1">评分</div>
      <StarRating value={rating ?? 0} onchange={() => {}} />
    </div>
  {/if}

  <!-- File info -->
  <div class="space-y-1.5">
    <div class="text-xs text-zinc-500 mb-1">文件信息</div>
    <div class="text-xs">
      <span class="text-zinc-500">文件名:</span>
      <span class="text-zinc-300 ml-1">{filename}</span>
    </div>
    <div class="text-xs">
      <span class="text-zinc-500">大小:</span>
      <span class="text-zinc-300 ml-1">{formatFileSize(fileSize)}</span>
    </div>
    <div class="text-xs">
      <span class="text-zinc-500">尺寸:</span>
      <span class="text-zinc-300 ml-1"
        >{width && height ? `${width}×${height}` : "-"}</span
      >
    </div>
    <div class="text-xs">
      <span class="text-zinc-500">格式:</span>
      <span class="text-zinc-300 ml-1">{fileFormat || "-"}</span>
    </div>
  </div>

  <!-- Generation metadata -->
  {#if hasMetadata()}
    <div>
      <div class="text-xs text-zinc-500 mb-2">生成参数</div>
      <MetadataViewer metadata={getMetadata()} {width} {height} />
    </div>
  {/if}
</div>
