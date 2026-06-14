<script lang="ts">
  let {
    visible = false,
    onclose,
    children,
  }: {
    visible: boolean;
    onclose: () => void;
    children?: import("svelte").Snippet;
  } = $props();

  let touchStartY = $state(0);
  let translateY = $state(0);
  let dismissing = $state(false);

  function handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartY = touch.clientY;
  }

  function handleTouchMove(e: TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    const delta = touch.clientY - touchStartY;
    if (delta > 0) translateY = delta;
  }

  function handleTouchEnd() {
    if (translateY > 80) {
      dismissing = true;
      setTimeout(onclose, 200);
    } else {
      translateY = 0;
    }
  }

  $effect(() => {
    if (visible) {
      translateY = 0;
      dismissing = false;
    }
  });
</script>

{#if visible}
  <button
    class="fixed inset-0 z-50 bg-black/60"
    onclick={onclose}
    aria-label="关闭菜单"
  ></button>

  <div
    class="fixed bottom-0 left-0 right-0 z-50 bg-zinc-800 border-t border-zinc-700 rounded-t-xl max-h-[70vh] overflow-y-auto transition-transform duration-200"
    style="transform: translateY({dismissing ? '100%' : translateY + 'px'});"
    ontouchstart={handleTouchStart}
    ontouchmove={handleTouchMove}
    ontouchend={handleTouchEnd}
  >
    <div class="flex justify-center py-2">
      <div class="w-10 h-1 rounded-full bg-zinc-600"></div>
    </div>
    <div class="px-4 pb-6 pt-1">
      {@render children?.()}
    </div>
  </div>
{/if}
