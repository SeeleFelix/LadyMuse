<script lang="ts">
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
    samplers: SamplerInfo[];
  }

  let {
    metadata,
    width,
    height,
  }: {
    metadata: ComfyUIMetadata | null;
    width: number | null;
    height: number | null;
  } = $props();
</script>

{#if metadata}
  <!-- Resolution -->
  {#if width && height}
    <div class="mb-4">
      <div class="text-xs">
        <span class="text-zinc-500">分辨率:</span>
        <span class="text-zinc-300">{width}×{height}</span>
      </div>
    </div>
  {/if}

  <!-- Models -->
  {#if metadata.models.length > 0}
    <div class="mb-4">
      <div class="text-xs text-zinc-500 mb-2">模型</div>
      <div class="flex flex-wrap gap-1">
        {#each metadata.models as m}
          <span class="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
            >{m}</span
          >
        {/each}
      </div>
    </div>
  {/if}

  <!-- LoRAs -->
  {#if metadata.loras.length > 0}
    <div class="mb-4">
      <div class="text-xs text-zinc-500 mb-2">LoRA</div>
      <div class="flex flex-wrap gap-1">
        {#each metadata.loras as l}
          <span class="rounded bg-zinc-800 px-2 py-0.5 text-xs text-violet-300"
            >{l}</span
          >
        {/each}
      </div>
    </div>
  {/if}

  <!-- Samplers -->
  {#if metadata.samplers.length > 0}
    <div class="mb-4">
      <div class="text-xs text-zinc-500 mb-2">
        采样器 ({metadata.samplers.length})
      </div>
      <div class="space-y-2">
        {#each metadata.samplers as s, i}
          <div class="rounded bg-zinc-800 px-3 py-2 text-xs space-y-1">
            <div class="text-zinc-400">#{i + 1} {s.classType}</div>
            {#if s.seed != null}
              <div>
                <span class="text-zinc-500">Seed:</span>
                <span class="text-zinc-300">{s.seed}</span>
              </div>
            {/if}
            {#if s.steps != null}
              <div>
                <span class="text-zinc-500">Steps:</span>
                <span class="text-zinc-300">{s.steps}</span>
              </div>
            {/if}
            {#if s.cfg != null}
              <div>
                <span class="text-zinc-500">CFG:</span>
                <span class="text-zinc-300">{s.cfg}</span>
              </div>
            {/if}
            {#if s.samplerName}
              <div>
                <span class="text-zinc-500">Sampler:</span>
                <span class="text-zinc-300">{s.samplerName}</span>
              </div>
            {/if}
            {#if s.scheduler}
              <div>
                <span class="text-zinc-500">Scheduler:</span>
                <span class="text-zinc-300">{s.scheduler}</span>
              </div>
            {/if}
            {#if s.denoise != null}
              <div>
                <span class="text-zinc-500">Denoise:</span>
                <span class="text-zinc-300">{s.denoise}</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Positive Prompts -->
  {#if metadata.positivePrompts.length > 0}
    <div class="mb-4">
      <div class="text-xs text-zinc-500 mb-1">
        正向提示词 ({metadata.positivePrompts.length})
      </div>
      {#each metadata.positivePrompts as prompt}
        <div
          class="rounded bg-zinc-800 p-3 text-xs text-zinc-300 max-h-40 overflow-y-auto whitespace-pre-wrap mb-1"
        >
          {prompt}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Negative Prompts -->
  {#if metadata.negativePrompts.length > 0}
    <div class="mb-4">
      <div class="text-xs text-zinc-500 mb-1">
        反向提示词 ({metadata.negativePrompts.length})
      </div>
      {#each metadata.negativePrompts as prompt}
        <div
          class="rounded bg-zinc-800 p-3 text-xs text-zinc-300 max-h-40 overflow-y-auto whitespace-pre-wrap mb-1"
        >
          {prompt}
        </div>
      {/each}
    </div>
  {/if}
{:else}
  <div class="text-xs text-zinc-600">无法提取元数据</div>
{/if}
