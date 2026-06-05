<script lang="ts">
  import StarRating from "./StarRating.svelte";
  import ColorLabel from "./ColorLabel.svelte";
  import FlagButtons from "./FlagButtons.svelte";

  let {
    selectedCount = 0,
    onRate,
    onColor,
    onFlag,
    onDelete,
    onDeselect,
  }: {
    selectedCount: number;
    onRate?: (rating: number) => void;
    onColor?: (color: string | null) => void;
    onFlag?: (flag: string | null) => void;
    onDelete?: () => void;
    onDeselect?: () => void;
  } = $props();

  let showDeleteConfirm = $state(false);

  function handleDelete() {
    showDeleteConfirm = true;
  }

  function confirmDelete() {
    showDeleteConfirm = false;
    onDelete?.();
  }
</script>

{#if selectedCount > 1}
  <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
    <div
      class="bg-zinc-900/95 backdrop-blur border border-zinc-700 rounded-lg shadow-2xl p-3"
    >
      <div class="flex items-center gap-4">
        <div class="text-zinc-400 text-sm font-medium">
          {selectedCount} selected
        </div>

        <div class="h-6 w-px bg-zinc-700"></div>

        <!-- Rating -->
        {#if onRate}
          <div class="flex items-center gap-2">
            <span class="text-xs text-zinc-500">Rate</span>
            <StarRating onchange={(r) => onRate(r)} />
          </div>
        {/if}

        <div class="h-6 w-px bg-zinc-700"></div>

        <!-- Color label -->
        {#if onColor}
          <div class="flex items-center gap-2">
            <span class="text-xs text-zinc-500">Color</span>
            <ColorLabel onchange={(c) => onColor(c)} />
          </div>
        {/if}

        <div class="h-6 w-px bg-zinc-700"></div>

        <!-- Flags -->
        {#if onFlag}
          <FlagButtons onchange={(f) => onFlag(f)} />
        {/if}

        <div class="h-6 w-px bg-zinc-700"></div>

        <!-- Actions -->
        <div class="flex items-center gap-2">
          {#if onDelete}
            <button
              onclick={handleDelete}
              class="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Delete
            </button>
          {/if}
          {#if onDeselect}
            <button
              onclick={onDeselect}
              class="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
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
              Deselect
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Delete confirmation dialog -->
  {#if showDeleteConfirm}
    <div class="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        class="absolute inset-0 bg-black/60"
        onclick={() => (showDeleteConfirm = false)}
      ></div>
      <div
        class="relative bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-6 max-w-sm"
      >
        <h3 class="text-lg font-semibold text-white mb-2">
          Delete {selectedCount} images?
        </h3>
        <p class="text-zinc-400 text-sm mb-6">
          This action cannot be undone. The images will be permanently removed
          from your library.
        </p>
        <div class="flex justify-end gap-3">
          <button
            onclick={() => (showDeleteConfirm = false)}
            class="px-4 py-2 rounded text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onclick={confirmDelete}
            class="px-4 py-2 rounded text-sm bg-red-600 text-white hover:bg-red-500 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}
