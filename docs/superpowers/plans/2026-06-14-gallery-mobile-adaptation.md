# Gallery Mobile Adaptation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/generations` gallery page usable on mobile browsers with responsive layout, touch interactions, and download support.

**Architecture:** Adapt the existing gallery UI using TailwindCSS responsive classes and Svelte 5 runes. Add a MobileActionSheet component for mobile context menus, touch gesture handlers to Lightbox and ThumbnailCard, a shared download utility, and restructure the toolbar for narrow viewports. The sidebar in `+layout.svelte` gains a mobile overlay mode.

**Tech Stack:** Svelte 5 (runes mode), TailwindCSS 4, TypeScript

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/routes/+layout.svelte` | Modify | Mobile hamburger toggle + sidebar overlay |
| `src/lib/utils/download-image.ts` | Create | Shared `downloadImage(url, filename)` helper |
| `src/lib/components/gallery/MobileActionSheet.svelte` | Create | Bottom sheet for mobile context actions |
| `src/lib/components/gallery/ThumbnailCard.svelte` | Modify | Download button + long-press handler |
| `src/lib/components/gallery/VirtualGrid.svelte` | Modify | Mobile-responsive gap, pass long-press callback |
| `src/lib/components/gallery/Lightbox.svelte` | Modify | Touch gestures (swipe, pinch, double-tap), download + copy link buttons |
| `src/lib/components/gallery/GalleryToolbar.svelte` | Modify | Mobile-responsive layout with bottom sheet for sort/filter |
| `src/lib/components/gallery/InspectView.svelte` | Modify | Download button in toolbar |
| `src/routes/generations/+page.svelte` | Modify | Wire mobile action sheet state + download + long-press integration |

---

### Task 1: Download Image Utility

**Files:**
- Create: `src/lib/utils/download-image.ts`

- [ ] **Step 1: Create the download utility**

```typescript
export async function downloadImage(imageUrl: string, filename: string): Promise<void> {
  const res = await fetch(imageUrl);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(objectUrl);
}

export function copyImageUrl(imageUrl: string): Promise<void> {
  return navigator.clipboard.writeText(
    new URL(imageUrl, window.location.origin).toString()
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/utils/download-image.ts
git commit -m "feat: add downloadImage and copyImageUrl utilities"
```

---

### Task 2: Responsive Sidebar

**Files:**
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Add mobile sidebar state and hamburger toggle**

Replace the current `<script>` block content. The key changes:
- Add `isMobileOpen` state
- Add hamburger icon button (hidden on md+ screens)
- Sidebar gets `fixed` positioning on mobile with overlay and z-index
- Overlay backdrop dismisses sidebar on tap

```svelte
<script lang="ts">
  import "../app.css";

  let { children } = $props();
  let sidebarOpen = $state(true);
  let mobileMenuOpen = $state(false);

  const navItems = [
    { href: "/", label: "首页", icon: "◉" },
    { href: "/chat", label: "创作伙伴", icon: "◈" },
    { href: "/knowledge", label: "知识库", icon: "◈" },
    { href: "/builder", label: "构建器", icon: "⚡" },
    { href: "/styles", label: "风格库", icon: "◆" },
    { href: "/prompts", label: "提示词", icon: "□" },
    { href: "/generations", label: "图库", icon: "◈" },
    { href: "/inspiration", label: "灵感", icon: "✦" },
    { href: "/settings", label: "设置", icon: "⚙" },
    { href: "/danbooru", label: "Danbooru", icon: "◇" },
    { href: "/usage", label: "用量", icon: "◎" },
  ];
</script>

<div class="flex h-screen bg-zinc-950 text-zinc-100">
  <!-- Mobile overlay backdrop -->
  {#if mobileMenuOpen}
    <button
      class="fixed inset-0 z-40 bg-black/60 md:hidden"
      onclick={() => (mobileMenuOpen = false)}
      aria-label="关闭菜单"
    ></button>
  {/if}

  <!-- Mobile hamburger button -->
  <button
    class="fixed top-3 left-3 z-50 p-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-zinc-100 md:hidden"
    onclick={() => (mobileMenuOpen = true)}
    aria-label="打开菜单"
  >
    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  </button>

  <aside
    class="flex flex-col border-r border-zinc-800 bg-zinc-900 transition-all duration-200
      hidden md:flex
      {sidebarOpen ? 'md:w-56' : 'md:w-14'}
      {mobileMenuOpen
        ? 'fixed left-0 top-0 z-50 h-full w-56 flex'
        : ''}"
  >
    <div
      class="flex h-14 items-center justify-between border-b border-zinc-800 px-4"
    >
      {#if sidebarOpen || mobileMenuOpen}
        <span class="text-lg font-bold text-violet-400">LadyMuse</span>
      {/if}
      <!-- Mobile close button -->
      <button
        onclick={() => (mobileMenuOpen = false)}
        class="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors md:hidden"
        aria-label="关闭菜单"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <!-- Desktop toggle -->
      <button
        onclick={() => (sidebarOpen = !sidebarOpen)}
        class="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors hidden md:block"
        title={sidebarOpen ? "收起菜单" : "展开菜单"}
      >
        <svg
          class="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {#if sidebarOpen}
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          {:else}
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 5l7 7-7 7M5 5l7 7-7 7"
            />
          {/if}
        </svg>
      </button>
    </div>

    <nav class="flex-1 py-2">
      {#each navItems as item}
        <a
          href={item.href}
          onclick={() => (mobileMenuOpen = false)}
          class="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <span class="text-base">{item.icon}</span>
          {#if sidebarOpen || mobileMenuOpen}
            <span>{item.label}</span>
          {/if}
        </a>
      {/each}
    </nav>
  </aside>

  <main class="flex-1 overflow-y-auto overflow-x-hidden pt-12 md:pt-0">
    {@render children()}
  </main>
</div>
```

Key changes:
- `mobileMenuOpen` rune drives the mobile sidebar overlay
- Sidebar uses `hidden md:flex` — hidden on mobile, visible as flex on desktop via responsive class
- Mobile hamburger button in top-left with `fixed` positioning, `md:hidden`
- Overlay backdrop `z-40`, sidebar `z-50`, hamburger `z-50`
- `main` gets `pt-12 md:pt-0` to clear the fixed hamburger on mobile
- Nav links call `onclick={() => (mobileMenuOpen = false)}` to dismiss after navigation

- [ ] **Step 2: Commit**

```bash
git add src/routes/+layout.svelte
git commit -m "feat: add responsive sidebar with mobile hamburger overlay"
```

---

### Task 3: Mobile Action Sheet Component

**Files:**
- Create: `src/lib/components/gallery/MobileActionSheet.svelte`

- [ ] **Step 1: Create the bottom sheet component**

```svelte
<script lang="ts">
  let {
    visible = false,
    onclose,
  }: {
    visible: boolean;
    onclose: () => void;
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
  <!-- Backdrop -->
  <button
    class="fixed inset-0 z-50 bg-black/60"
    onclick={onclose}
    aria-label="关闭菜单"
  ></button>

  <!-- Sheet -->
  <div
    class="fixed bottom-0 left-0 right-0 z-50 bg-zinc-800 border-t border-zinc-700 rounded-t-xl max-h-[70vh] overflow-y-auto transition-transform duration-200"
    style="transform: translateY({dismissing ? '100%' : translateY + 'px'});"
    ontouchstart={handleTouchStart}
    ontouchmove={handleTouchMove}
    ontouchend={handleTouchEnd}
  >
    <!-- Drag handle -->
    <div class="flex justify-center py-2">
      <div class="w-10 h-1 rounded-full bg-zinc-600"></div>
    </div>
    <div class="px-4 pb-6 pt-1">
      {@render children?.()}
    </div>
  </div>
{/if}

{#snippet children()}{/snippet}
```

The component:
- Slides up from the bottom when `visible` is true
- Has a drag handle that users can swipe down to dismiss
- Backdrop tap also dismisses
- Uses svelte snippet for flexible content
- `max-h-[70vh]` prevents it from being too tall
- Touch events for drag-to-dismiss

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/MobileActionSheet.svelte
git commit -m "feat: add MobileActionSheet bottom sheet component"
```

---

### Task 4: ThumbnailCard — Download Button + Long-Press

**Files:**
- Modify: `src/lib/components/gallery/ThumbnailCard.svelte`

- [ ] **Step 1: Add download button and long-press event**

Replace the current `ThumbnailCard.svelte` to add:
- A download icon button in the bottom-right corner
- Long-press detection via `touchstart`/`touchend` timers
- New `onlongpress` callback prop

```svelte
<script lang="ts">
  import type { ImageResult } from "$lib/stores/gallery-store.svelte";

  let {
    image,
    selected = false,
    active = false,
    onselect,
    ondblclick,
    oncontextmenu,
    onlongpress,
    ondownload,
  }: {
    image: ImageResult;
    selected?: boolean;
    active?: boolean;
    onselect: (path: string, e: MouseEvent) => void;
    ondblclick: () => void;
    oncontextmenu: (path: string, e: MouseEvent) => void;
    onlongpress?: (path: string) => void;
    ondownload?: (path: string) => void;
  } = $props();

  const colorClassMap: Record<string, string> = {
    red: "bg-red-500",
    yellow: "bg-yellow-500",
    green: "bg-green-500",
    blue: "bg-blue-500",
    purple: "bg-purple-500",
  };

  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let touchStartPos = { x: 0, y: 0 };

  function getImageUrl(): string {
    return `/api/comfyui/images/${encodeURIComponent(image.relativePath)}`;
  }

  function getFilename(): string {
    return image.relativePath.split("/").pop() || image.relativePath;
  }

  function handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    longPressTimer = setTimeout(() => {
      onlongpress?.(image.relativePath);
    }, 500);
  }

  function handleTouchMove(e: TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    const dx = Math.abs(touch.clientX - touchStartPos.x);
    const dy = Math.abs(touch.clientY - touchStartPos.y);
    if (dx > 10 || dy > 10) {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }
  }

  function handleTouchEnd() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function handleDownload(e: Event) {
    e.stopPropagation();
    e.preventDefault();
    ondownload?.(image.relativePath);
  }
</script>

<button
  onclick={(e) => onselect(image.relativePath, e)}
  ondblclick={ondblclick}
  oncontextmenu={(e) => oncontextmenu(image.relativePath, e)}
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  tabindex="0"
  class="group relative rounded-lg border {selected
    ? 'border-violet-500 ring-1 ring-violet-500/30'
    : active
      ? 'border-violet-500/50'
      : 'border-zinc-800'} bg-zinc-900 overflow-hidden hover:border-zinc-700 transition-colors text-left focus:outline-none focus:ring-1 focus:ring-violet-500/50"
>
  <div
    class="aspect-square bg-zinc-800 flex items-center justify-center relative"
  >
    {#if image.isMissing}
      <div
        class="absolute inset-0 bg-zinc-900/80 flex items-center justify-center"
      >
        <div class="text-center">
          <svg class="w-8 h-8 text-zinc-600 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 2.502-3.618V13.38c0-1.951-.962-3.618-2.502-3.618H5.114c-1.54 0-2.502 1.667-2.502 3.618v1.414c0 1.951.962 3.618 2.502 3.618z" />
          </svg>
          <p class="text-xs text-zinc-600">文件缺失</p>
        </div>
      </div>
    {:else}
      <img
        src={getImageUrl()}
        alt=""
        loading="lazy"
        class="w-full h-full object-contain"
      />
    {/if}

    {#if image.colorLabel}
      <div
        class="absolute top-1.5 right-1.5 w-3 h-3 rounded-full {colorClassMap[image.colorLabel] || ''} ring-1 ring-black/30"
      ></div>
    {/if}

    {#if image.flag === "pick"}
      <div class="absolute bottom-1 right-1 text-green-400 text-xs font-bold bg-black/50 rounded px-1">P</div>
    {:else if image.flag === "reject"}
      <div class="absolute bottom-1 right-1 text-red-400 text-xs font-bold bg-black/50 rounded px-1">R</div>
    {/if}

    <div
      class="absolute top-1.5 left-1.5 w-4 h-4 rounded border {selected
        ? 'bg-violet-500 border-violet-500'
        : 'bg-black/40 border-zinc-500'} flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity {selected
        ? 'opacity-100'
        : ''}"
    >
      {#if selected}
        <svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
        </svg>
      {/if}
    </div>

    {#if (image.rating ?? 0) > 0}
      <div class="absolute bottom-1 left-1 flex items-center bg-black/50 rounded px-1">
        {#each [1, 2, 3, 4, 5] as r}
          <span class="text-xs {r <= (image.rating ?? 0) ? 'text-amber-400' : 'text-zinc-700'}">★</span>
        {/each}
      </div>
    {/if}

    <!-- Download button -->
    {#if !image.isMissing}
      <button
        onclick={handleDownload}
        class="absolute bottom-1 right-1 w-7 h-7 rounded bg-black/60 hover:bg-black/80 text-zinc-300 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        title="下载"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </button>
    {/if}
  </div>

  <div class="p-2">
    <div class="mt-0.5 text-xs text-zinc-500 truncate" title={getFilename()}>{getFilename()}</div>
    <div class="text-xs text-zinc-600">
      {#if image.width && image.height}
        {image.width}×{image.height}
      {:else if image.fileSize}
        {(image.fileSize / 1024).toFixed(0)}KB
      {/if}
    </div>
  </div>
</button>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/ThumbnailCard.svelte
git commit -m "feat: add download button and long-press support to ThumbnailCard"
```

---

### Task 5: VirtualGrid — Mobile Gap + Long-Press Prop

**Files:**
- Modify: `src/lib/components/gallery/VirtualGrid.svelte`

- [ ] **Step 1: Adjust gap for mobile and pass long-press/on-download callbacks**

Change the grid class from `gap-3` to `gap-2 md:gap-3` and add new callback props to pass through to ThumbnailCard.

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import ThumbnailCard from "./ThumbnailCard.svelte";
  import type { ImageResult } from "$lib/stores/gallery-store.svelte";

  let {
    images = [],
    selectedPaths = new Set(),
    activePath = null,
    onselect,
    ondblclick,
    oncontextmenu,
    onloadmore,
    hasMore = false,
    loadingMore = false,
    onlongpress,
    ondownload,
  }: {
    images: ImageResult[];
    selectedPaths: Set<string>;
    activePath: string | null;
    onselect: (path: string, e: MouseEvent) => void;
    ondblclick: (path: string) => void;
    oncontextmenu: (path: string, e: MouseEvent) => void;
    onloadmore: () => void;
    hasMore?: boolean;
    loadingMore?: boolean;
    onlongpress?: (path: string) => void;
    ondownload?: (path: string) => void;
  } = $props();

  let sentinelEl: HTMLDivElement | undefined;
  let observer: IntersectionObserver | null = null;

  onMount(() => {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          onloadmore();
        }
      },
      { rootMargin: "200px", threshold: 0 },
    );

    if (sentinelEl) {
      observer.observe(sentinelEl);
    }

    return () => observer?.disconnect();
  });

  $effect(() => {
    if (!loadingMore && hasMore && observer && sentinelEl) {
      observer.unobserve(sentinelEl);
      requestAnimationFrame(() => {
        if (sentinelEl) observer?.observe(sentinelEl);
      });
    }
  });
</script>

<div
  class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 md:gap-3"
>
  {#each images as image (image.relativePath)}
    <ThumbnailCard
      {image}
      selected={selectedPaths.has(image.relativePath)}
      active={activePath === image.relativePath}
      {onselect}
      ondblclick={() => ondblclick(image.relativePath)}
      {oncontextmenu}
      {onlongpress}
      {ondownload}
    />
  {/each}
</div>

<div bind:this={sentinelEl} class="py-4 flex justify-center">
  {#if loadingMore}
    <p class="text-zinc-500 text-sm">加载更多...</p>
  {:else if !hasMore}
    <p class="text-zinc-600 text-xs">已加载全部图片</p>
  {:else}
    <p class="text-zinc-600 text-xs"></p>
  {/if}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/VirtualGrid.svelte
git commit -m "feat: add mobile-responsive gap and new callback props to VirtualGrid"
```

---

### Task 6: Lightbox — Touch Gestures + Download

**Files:**
- Modify: `src/lib/components/gallery/Lightbox.svelte`

- [ ] **Step 1: Add swipe, pinch-to-zoom, double-tap, and download/copy buttons**

Replace the Lightbox component with touch-enabled version. Key additions:
- Swipe left/right for navigation (pointer events for cross-platform)
- Double-tap to toggle zoom (1x ↔ 3x)
- Pinch-to-zoom with two-pointer distance tracking
- Download button and copy link button in toolbar

```svelte
<script lang="ts">
  let {
    images = [],
    currentIndex = 0,
    contextMenuOpen = false,
    onclose,
    onnavigate,
    oncontextmenu,
    ondownload,
  }: {
    images: { relativePath: string; filename: string; modifiedAt?: string }[];
    currentIndex: number;
    contextMenuOpen?: boolean;
    onclose: () => void;
    onnavigate?: (index: number) => void;
    oncontextmenu?: (e: MouseEvent) => void;
    ondownload?: (imageUrl: string, filename: string) => void;
  } = $props();

  let scale = $state(1);
  let translateX = $state(0);
  let translateY = $state(0);
  let isDragging = $state(false);
  let didDrag = $state(false);
  let dragStart = { x: 0, y: 0 };
  let containerEl: HTMLDivElement | undefined = $state();

  const MIN_SCALE = 0.1;
  const MAX_SCALE = 10;

  // Touch/swipe state
  let pointerStartX = $state(0);
  let pointerStartY = $state(0);
  let pointerActive = $state(false);
  let swipeHandled = $state(false);

  // Pinch state
  let pinchStartDistance = $state(0);
  let pinchStartScale = $state(1);

  // Double-tap state
  let lastTapTime = $state(0);
  let lastTapPos = { x: 0, y: 0 };

  let currentImage = $derived(images[currentIndex]);
  let copied = $state(false);

  function resetTransform() {
    scale = 1;
    translateX = 0;
    translateY = 0;
  }

  function getImageUrl(relativePath: string, modifiedAt?: string): string {
    const base = `/api/comfyui/images/${encodeURIComponent(relativePath)}`;
    return modifiedAt ? `${base}?t=${new Date(modifiedAt).getTime()}` : base;
  }

  function goNext() {
    if (currentIndex < images.length - 1) {
      resetTransform();
      onnavigate?.(currentIndex + 1);
    }
  }

  function goPrev() {
    if (currentIndex > 0) {
      resetTransform();
      onnavigate?.(currentIndex - 1);
    }
  }

  // === Mouse/Zoom handlers ===
  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale + delta * scale));
    if (scale <= 1) {
      translateX = 0;
      translateY = 0;
    }
  }

  function handleMouseDown(e: MouseEvent) {
    if (scale > 1) {
      isDragging = true;
      didDrag = false;
      dragStart = { x: e.clientX - translateX, y: e.clientY - translateY };
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (isDragging && scale > 1) {
      const nx = e.clientX - dragStart.x;
      const ny = e.clientY - dragStart.y;
      if (Math.abs(nx - translateX) > 2 || Math.abs(ny - translateY) > 2) didDrag = true;
      translateX = nx;
      translateY = ny;
    }
  }

  function handleMouseUp() {
    isDragging = false;
  }

  function toggleZoom(e: MouseEvent) {
    if (didDrag) { didDrag = false; return; }
    if (scale > 1) {
      resetTransform();
    } else {
      scale = 3;
    }
  }

  // === Touch / Pointer handlers ===

  function handlePointerDown(e: PointerEvent) {
    if (e.pointerType === "touch" && scale <= 1) {
      pointerStartX = e.clientX;
      pointerStartY = e.clientY;
      pointerActive = true;
      swipeHandled = false;

      // Double-tap detection
      const now = Date.now();
      const dist = Math.hypot(e.clientX - lastTapPos.x, e.clientY - lastTapPos.y);
      if (now - lastTapTime < 300 && dist < 30) {
        e.preventDefault();
        if (scale > 1) resetTransform();
        else scale = 3;
        lastTapTime = 0;
        return;
      }
      lastTapTime = now;
      lastTapPos = { x: e.clientX, y: e.clientY };
    }
  }

  function handlePointerMove(e: PointerEvent) {
    if (!pointerActive) return;

    // Detect two-finger pinch
    const touches = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    if (touches.length >= 2 || (e as any).touches?.length >= 2) {
      swipeHandled = true;
      // Simple pinch: just use wheel-based zoom as fallback on non-touch
      return;
    }

    const dx = Math.abs(e.clientX - pointerStartX);
    const dy = Math.abs(e.clientY - pointerStartY);
    if (!swipeHandled && dx > 30 && dx > dy * 1.5) {
      swipeHandled = true;
    }
  }

  function handlePointerUp(e: PointerEvent) {
    if (!pointerActive) return;
    pointerActive = false;

    if (swipeHandled) {
      const dx = e.clientX - pointerStartX;
      if (dx < -50) goNext();
      else if (dx > 50) goPrev();
    }
  }

  // Pinch zoom via pointer events
  function handleTouchMovePinch(e: TouchEvent) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);

      if (pinchStartDistance === 0) {
        pinchStartDistance = dist;
        pinchStartScale = scale;
      } else {
        scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchStartScale * (dist / pinchStartDistance)));
        if (scale <= 1) { translateX = 0; translateY = 0; }
      }
    }
  }

  function resetPinch() {
    pinchStartDistance = 0;
  }

  function getFullImageUrl(): string {
    if (!currentImage) return "";
    return new URL(getImageUrl(currentImage.relativePath, currentImage.modifiedAt), window.location.origin).toString();
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(getFullImageUrl());
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {}
  }

  function handleDownload() {
    if (!currentImage) return;
    const filename = currentImage.filename || currentImage.relativePath.split("/").pop() || "image";
    ondownload?.(getImageUrl(currentImage.relativePath, currentImage.modifiedAt), filename);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (contextMenuOpen) return;
      onclose();
    } else if (e.key === "ArrowRight") goNext();
    else if (e.key === "ArrowLeft") goPrev();
    else if (e.key === "+" || e.key === "=") scale = Math.min(MAX_SCALE, scale * 1.2);
    else if (e.key === "-") scale = Math.max(MIN_SCALE, scale / 1.2);
  }

  $effect(() => { resetTransform(); });
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 bg-black/95 flex flex-col"
  onwheel={handleWheel}
  onmousedown={handleMouseDown}
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
  onmouseleave={handleMouseUp}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  ontouchmove={handleTouchMovePinch}
  ontouchend={resetPinch}
  role="dialog"
>
  <!-- Toolbar -->
  <div class="flex items-center justify-between px-4 py-2 bg-black/50">
    <div class="text-sm text-zinc-300 truncate max-w-[200px] md:max-w-md">
      {currentImage?.filename || ""}
    </div>
    <div class="flex items-center gap-2 md:gap-3">
      <span class="text-xs text-zinc-500">{Math.round(scale * 100)}%</span>
      <span class="text-xs text-zinc-500">{currentIndex + 1}/{images.length}</span>
      <button onclick={resetTransform} class="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-zinc-800">适应</button>
      <button onclick={() => (scale = 1)} class="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-zinc-800 hidden md:block">1:1</button>

      <!-- Copy link -->
      <button onclick={handleCopyLink} class="text-zinc-400 hover:text-white p-1.5 rounded hover:bg-zinc-800" title="复制链接">
        {#if copied}
          <svg class="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        {:else}
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        {/if}
      </button>

      <!-- Download -->
      <button onclick={handleDownload} class="text-zinc-400 hover:text-white p-1.5 rounded hover:bg-zinc-800" title="下载">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </button>

      <button onclick={onclose} class="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>

  <!-- Image area -->
  <div class="flex-1 flex items-center justify-center overflow-hidden relative" bind:this={containerEl}>
    {#if currentImage}
      <!-- Navigation arrows (hidden on mobile, replaced by swipe) -->
      {#if currentIndex > 0}
        <button onclick={goPrev} class="absolute left-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 hidden md:block">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      {/if}
      {#if currentIndex < images.length - 1}
        <button onclick={goNext} class="absolute right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 hidden md:block">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      {/if}

      <img
        src={getImageUrl(currentImage.relativePath, currentImage.modifiedAt)}
        alt=""
        onclick={(e) => toggleZoom(e)}
        oncontextmenu={(e) => {
          e.preventDefault();
          oncontextmenu?.(e);
        }}
        class="max-w-full max-h-full select-none {scale <= 1 ? 'object-contain cursor-zoom-in' : 'cursor-zoom-out'}"
        style="transform: scale({scale}) translate({translateX / scale}px, {translateY / scale}px); transition: {isDragging ? 'none' : 'transform 0.2s ease'}; touch-action: manipulation;"
        draggable="false"
      />
    {/if}
  </div>

  <!-- Filmstrip (hidden on mobile) -->
  {#if images.length > 1}
    <div class="h-16 bg-black/50 hidden md:flex items-center gap-1 px-4 overflow-x-auto">
      {#each images as img, i}
        <button
          onclick={() => { resetTransform(); onnavigate?.(i); }}
          class="shrink-0 w-12 h-12 rounded {i === currentIndex ? 'ring-2 ring-violet-500' : 'opacity-60 hover:opacity-100'} overflow-hidden"
        >
          <img
            src={getImageUrl(img.relativePath, img.modifiedAt)}
            alt=""
            class="w-full h-full object-cover"
            loading="lazy"
          />
        </button>
      {/each}
    </div>
    <!-- Mobile page dots -->
    <div class="flex md:hidden justify-center items-center gap-1.5 py-2 bg-black/50">
      {#each images as _, i}
        <div class="w-1.5 h-1.5 rounded-full {i === currentIndex ? 'bg-violet-400' : 'bg-zinc-600'}"></div>
      {/each}
    </div>
  {/if}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/Lightbox.svelte
git commit -m "feat: add touch gestures, download and copy link to Lightbox"
```

---

### Task 7: GalleryToolbar — Mobile Responsive Layout

**Files:**
- Modify: `src/lib/components/gallery/GalleryToolbar.svelte`

- [ ] **Step 1: Restructure toolbar for mobile with icon-only buttons and bottom sheet for sort**

The toolbar receives a new `onopensort` callback that the mobile layout will use. On mobile: search input full-width, icon-only buttons for the rest. On desktop: existing layout preserved.

```svelte
<script lang="ts">
  import type {
    ViewMode,
    SortOption,
  } from "$lib/stores/gallery-store.svelte";

  let {
    viewMode = "library",
    searchQuery = "",
    sortOption,
    totalImages = 0,
    trashCount = 0,
    onviewmodechange,
    onsearchchange,
    onsortchange,
    onrefresh,
    onopentrash,
    ontogglefilter,
  }: {
    viewMode?: ViewMode;
    searchQuery?: string;
    sortOption: SortOption;
    totalImages?: number;
    trashCount?: number;
    onviewmodechange: (mode: ViewMode) => void;
    onsearchchange: (query: string) => void;
    onsortchange: (sort: SortOption) => void;
    onrefresh: () => void;
    onopentrash?: () => void;
    ontogglefilter?: () => void;
  } = $props();

  let searchInput = $state(searchQuery);
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  function handleSearchInput(e: Event) {
    const target = e.target as HTMLInputElement;
    searchInput = target.value;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      onsearchchange(searchInput);
    }, 300);
  }

  const viewModes: { key: ViewMode; label: string; shortcut: string; icon: string }[] = [
    { key: "library", label: "Library", shortcut: "G", icon: "grid" },
    { key: "inspect", label: "Inspect", shortcut: "E", icon: "image" },
    { key: "compare", label: "Compare", shortcut: "C", icon: "columns" },
  ];

  const sortOptions: { label: string; value: SortOption }[] = [
    { label: "最新优先", value: { field: "modified_at", direction: "desc" } },
    { label: "最旧优先", value: { field: "modified_at", direction: "asc" } },
    { label: "评分从高到低", value: { field: "rating", direction: "desc" } },
    { label: "评分从低到高", value: { field: "rating", direction: "asc" } },
    { label: "文件名 (A-Z)", value: { field: "filename", direction: "asc" } },
    { label: "文件名 (Z-A)", value: { field: "filename", direction: "desc" } },
    { label: "文件大小从大到小", value: { field: "file_size", direction: "desc" } },
    { label: "文件大小从小到大", value: { field: "file_size", direction: "asc" } },
  ];

  function getSortLabel(): string {
    const option = sortOptions.find(
      (o) => o.value.field === sortOption.field && o.value.direction === sortOption.direction,
    );
    return option?.label || "排序";
  }
</script>

<div class="border-b border-zinc-800 bg-zinc-900/30">
  <!-- Search row (full width on mobile) -->
  <div class="px-3 md:px-4 pt-2.5 pb-2 md:py-2.5 flex items-center gap-2 md:gap-3">
    <!-- View mode: icon-only on mobile -->
    <div class="flex items-center gap-0.5 md:gap-1">
      {#each viewModes as mode}
        <button
          onclick={() => onviewmodechange(mode.key)}
          class="rounded px-1.5 md:px-2 py-1 text-xs transition-colors {viewMode === mode.key
            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
            : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}"
          title={mode.label}
        >
          <span class="hidden md:inline">{mode.shortcut}</span>
          <span class="md:hidden text-[10px]">{mode.label}</span>
        </button>
      {/each}
    </div>

    <!-- Search input: full width on mobile -->
    <div class="flex-1 md:max-w-xs">
      <input
        type="text"
        value={searchInput}
        oninput={handleSearchInput}
        placeholder="搜索提示词..."
        class="w-full rounded border border-zinc-700 bg-zinc-800 px-2 md:px-3 py-1 text-xs text-zinc-300 placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
      />
    </div>
  </div>

  <!-- Second row: sort, filter, actions -->
  <div class="px-3 md:px-4 pb-2.5 md:pb-2 flex items-center gap-2">
    <!-- Sort dropdown on desktop, button on mobile -->
    <select
      onchange={(e) => {
        const idx = (e.target as HTMLSelectElement).selectedIndex;
        onsortchange(sortOptions[idx].value);
      }}
      class="hidden md:block rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 focus:border-violet-500 focus:outline-none"
    >
      {#each sortOptions as opt}
        <option
          value={opt.value.field + "-" + opt.value.direction}
          selected={opt.value.field === sortOption.field && opt.value.direction === sortOption.direction}
        >
          {opt.label}
        </option>
      {/each}
    </select>

    <!-- Mobile sort button -->
    <button
      onclick={() => {
        const wrapper = document.getElementById("mobile-sort-select");
        if (wrapper) {
          const sel = wrapper.querySelector("select") as HTMLSelectElement;
          sel?.focus();
          sel?.dispatchEvent(new Event("mousedown"));
        }
      }}
      class="md:hidden rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 flex items-center gap-1"
    >
      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
      </svg>
      <span class="text-zinc-500">{getSortLabel()}</span>
    </button>
    <!-- Hidden native select triggered by mobile button -->
    <div id="mobile-sort-select" class="relative md:hidden">
      <select
        onchange={(e) => {
          const idx = (e.target as HTMLSelectElement).selectedIndex;
          onsortchange(sortOptions[idx].value);
        }}
        class="absolute inset-0 opacity-0 w-full"
      >
        {#each sortOptions as opt}
          <option
            value={opt.value.field + "-" + opt.value.direction}
            selected={opt.value.field === sortOption.field && opt.value.direction === sortOption.direction}
          >
            {opt.label}
          </option>
        {/each}
      </select>
    </div>

    <!-- Filter toggle (mobile: icon-only) -->
    <button
      onclick={ontogglefilter}
      class="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-600 transition-colors flex items-center gap-1"
      title="筛选"
    >
      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>
      <span class="hidden md:inline text-xs">筛选</span>
    </button>

    <div class="ml-auto flex items-center gap-1 md:gap-2">
      <!-- Trash -->
      <button
        onclick={() => onopentrash?.()}
        class="rounded border border-zinc-700 bg-zinc-800 px-1.5 md:px-2 py-1 text-xs text-zinc-300 hover:border-zinc-600 hover:text-amber-300 transition-colors flex items-center gap-1"
        title="回收站"
      >
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        <span class="hidden md:inline">回收站</span>
        {#if trashCount > 0}
          <span class="rounded-full bg-amber-500/20 px-1.5 text-[10px] text-amber-300">{trashCount}</span>
        {/if}
      </button>

      <!-- Image count (hidden on mobile) -->
      <span class="hidden md:inline text-xs text-zinc-500">{totalImages} 张图片</span>

      <!-- Refresh -->
      <button
        onclick={onrefresh}
        class="rounded border border-zinc-700 bg-zinc-800 px-1.5 md:px-2 py-1 text-xs text-zinc-300 hover:border-zinc-600 transition-colors"
        title="刷新"
      >
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  </div>
</div>
```

Key changes:
- Toolbar split into two rows: search+view mode row, then sort+filter+actions row
- Mobile: icon-first buttons, labels hidden with `hidden md:inline`
- Sort uses a hidden native `<select>` triggered by visible button on mobile, normal dropdown on desktop
- View mode buttons show abbreviated text labels on mobile instead of keyboard shortcuts
- `ontogglefilter` new prop for showing/hiding the filter panel on mobile

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/GalleryToolbar.svelte
git commit -m "feat: restructure GalleryToolbar for mobile with two-row layout"
```

---

### Task 8: InspectView — Add Download Button

**Files:**
- Modify: `src/lib/components/gallery/InspectView.svelte`

- [ ] **Step 1: Add download button to the toolbar**

In the toolbar section (around line 143-167), add a download button next to the back button:

```svelte
<script lang="ts">
  // ... keep existing imports and props, add ondownload:

  let {
    store,
    allTags = [],
    oncontextmenu,
    ondownload,
  }: {
    store: GalleryStore;
    allTags?: Tag[];
    oncontextmenu?: (path: string, e: MouseEvent) => void;
    ondownload?: (imageUrl: string, filename: string) => void;
  } = $props();

  // ... keep existing state and functions ...

  function getFullImageUrl(image: ImageResult): string {
    return `/api/comfyui/images/${encodeURIComponent(image.relativePath)}`;
  }

  function handleDownload() {
    if (!store.activeImage) return;
    const url = getFullImageUrl(store.activeImage);
    const filename = store.activeImage.relativePath.split("/").pop() || "image";
    ondownload?.(url, filename);
  }
</script>

<!-- In the toolbar, after "返回" button, add: -->
<div class="flex items-center gap-2">
  <button
    onclick={() => store.setViewMode("library")}
    class="text-zinc-400 hover:text-zinc-200 text-xs px-2 py-1 rounded hover:bg-zinc-800 flex items-center gap-1"
  >
    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
    </svg>
    返回
  </button>

  <!-- Download button -->
  {#if store.activeImage && !store.activeImage.isMissing}
    <button
      onclick={handleDownload}
      class="text-zinc-400 hover:text-zinc-200 text-xs px-2 py-1 rounded hover:bg-zinc-800 flex items-center gap-1"
      title="下载"
    >
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    </button>
  {/if}

  <span class="text-xs text-zinc-500">
    {currentIndex >= 0 ? currentIndex + 1 : 0} / {store.images.length}
  </span>
</div>
```

The exact changes:
1. Add `ondownload` to props destructuring
2. Add `getFullImageUrl` and `handleDownload` functions
3. Insert download button in toolbar next to the back button
4. Only show when an image is active and not missing

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/InspectView.svelte
git commit -m "feat: add download button to InspectView toolbar"
```

---

### Task 9: Wire Everything in /generations Page

**Files:**
- Modify: `src/routes/generations/+page.svelte`

- [ ] **Step 1: Add mobile action sheet state, long-press handler, download handler, and filter toggle**

The page needs:
- MobileActionSheet import and state
- `mobileSheetImage` state to track which image the sheet is for
- Long-press handler that opens the sheet
- Download handler using the utility
- Filter panel toggle state for mobile
- Pass new props to components

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { createGalleryStore } from "$lib/stores/gallery-store.svelte";
  import { galleryAPI } from "$lib/services/gallery-api";
  import { createSSEClient } from "$lib/services/sse-client";
  import LibraryView from "$lib/components/gallery/LibraryView.svelte";
  import InspectView from "$lib/components/gallery/InspectView.svelte";
  import CompareView from "$lib/components/gallery/CompareView.svelte";
  import KeyboardShortcuts from "$lib/components/gallery/KeyboardShortcuts.svelte";
  import BatchActionsBar from "$lib/components/gallery/BatchActionsBar.svelte";
  import Toast from "$lib/components/gallery/Toast.svelte";
  import Lightbox from "$lib/components/gallery/Lightbox.svelte";
  import ContextMenu from "$lib/components/gallery/ContextMenu.svelte";
  import MobileActionSheet from "$lib/components/gallery/MobileActionSheet.svelte";
  import ConfirmDialog from "$lib/components/gallery/ConfirmDialog.svelte";
  import CollectionPanel from "$lib/components/gallery/CollectionPanel.svelte";
  import DetailPanel from "$lib/components/gallery/DetailPanel.svelte";
  import GalleryDetail from "$lib/components/gallery/GalleryDetail.svelte";
  import { downloadImage } from "$lib/utils/download-image";
  import type { ImageResult } from "$lib/stores/gallery-store.svelte";

  interface Collection {
    id: number;
    name: string;
    description: string | null;
    coverImagePath: string | null;
    isSmart: boolean;
    smartCriteria: string | null;
    imageCount: number;
  }

  interface Tag {
    id: number;
    name: string;
    slug: string;
  }

  // Store setup
  const store = createGalleryStore({
    query: (filters, sort, pagination) =>
      galleryAPI.query(filters, sort, pagination),
    updateAttributes: (path, updates) =>
      galleryAPI.updateAttributes(path, updates),
  });

  // Collections state
  let collections = $state<Collection[]>([]);
  let allTags = $state<Tag[]>([]);

  // Lightbox state
  let lightboxOpen = $state(false);
  let lightboxIndex = $state(0);

  // Context menu state (desktop)
  let contextMenuVisible = $state(false);
  let contextMenuX = $state(0);
  let contextMenuY = $state(0);
  let contextMenuImage = $state<ImageResult | null>(null);

  // Mobile action sheet state
  let mobileSheetVisible = $state(false);
  let mobileSheetImage = $state<ImageResult | null>(null);

  // Filter panel toggle (mobile)
  let filterPanelOpen = $state(false);

  // Delete confirmation state
  let deleteConfirm = $state<{
    paths: string[];
    message: string;
  } | null>(null);

  // Toast state
  let toasts = $state<
    { id: number; message: string; type: "info" | "success" | "error" }[]
  >([]);
  let toastCounter = 0;

  // Helper functions
  function showToast(
    message: string,
    type: "info" | "success" | "error" = "info",
  ) {
    const id = ++toastCounter;
    toasts = [...toasts, { id, message, type }];
  }

  function dismissToast(id: number) {
    toasts = toasts.filter((t) => t.id !== id);
  }

  function getImageUrl(image: ImageResult): string {
    return `/api/comfyui/images/${encodeURIComponent(image.relativePath)}`;
  }

  function getFilename(image: ImageResult): string {
    return image.relativePath.split("/").pop() || image.relativePath;
  }

  // Download handler
  async function handleDownload(path: string) {
    const image = store.images.find((img) => img.relativePath === path);
    if (!image || image.isMissing) return;
    try {
      await downloadImage(getImageUrl(image), getFilename(image));
    } catch {
      showToast("下载失败", "error");
    }
  }

  // Lightbox download
  async function handleLightboxDownload(imageUrl: string, filename: string) {
    try {
      await downloadImage(imageUrl, filename);
    } catch {
      showToast("下载失败", "error");
    }
  }

  // Long-press handler → opens mobile action sheet
  function handleLongPress(path: string) {
    const image = store.images.find((img) => img.relativePath === path);
    if (!image) return;
    if (store.selectedPaths.size > 1 && store.selectedPaths.has(path)) {
      // Multiple selected — use selected set
      mobileSheetImage = null;
    } else {
      store.select(path, false, false);
      mobileSheetImage = image;
    }
    mobileSheetVisible = true;
  }

  // ... (keep existing data loading, SSE, action handlers, etc.)
```

The page component changes:
1. Import `MobileActionSheet` and `downloadImage`
2. Add `mobileSheetVisible`, `mobileSheetImage`, `filterPanelOpen` state runes
3. Add `handleDownload`, `handleLightboxDownload`, `handleLongPress` functions
4. Pass `onlongpress`, `ondownload` to LibraryView → VirtualGrid → ThumbnailCard chain
5. Pass `ondownload` to Lightbox and InspectView
6. Pass `ontogglefilter` to GalleryToolbar
7. Conditionally render FilterPanel based on `filterPanelOpen` on mobile
8. Render MobileActionSheet with action buttons

The component needs to pass `ondownload` and `onlongpress` callbacks through LibraryView. Let me trace the prop chain:

`page → LibraryView → VirtualGrid → ThumbnailCard`

LibraryView needs two new optional callback props. Let me also account for filter panel visibility toggling.

- [ ] **Step 2: Update LibraryView to pass through new props**

LibraryView needs to accept and forward `onlongpress` and `ondownload` to VirtualGrid:

```svelte
<!-- In LibraryView.svelte script, add to props: -->
let {
  store,
  oncontextmenu,
  allTags = [],
  ontrashaction,
  onlongpress,
  ondownload,
}: {
  store: GalleryStore;
  oncontextmenu?: (path: string, e: MouseEvent) => void;
  allTags?: Tag[];
  ontrashaction?: (action: "restore" | "purge" | "empty", id?: number) => void;
  onlongpress?: (path: string) => void;
  ondownload?: (path: string) => void;
} = $props();
```

And pass them to VirtualGrid in the template:
```svelte
<VirtualGrid
  images={...}
  {onselect}
  {ondblclick}
  {oncontextmenu}
  {onloadmore}
  {onlongpress}
  {ondownload}
  ...
/>
```

- [ ] **Step 3: Wire filter panel toggle on mobile**

In the page template, filter panel visibility:
```svelte
<!-- Filter panel - conditionally shown on mobile -->
{#if filterPanelOpen || typeof window !== 'undefined' && window.innerWidth >= 768}
  <FilterPanel
    filters={store.filters}
    onfilterschange={(f) => store.setFilters(f)}
  />
{/if}
```

But better — use a reactive approach with a CSS class on mobile:

```svelte
<div class:hidden={!filterPanelOpen} class="md:block">
  <FilterPanel
    filters={store.filters}
    onfilterschange={(f) => store.setFilters(f)}
  />
</div>
```

Pass `ontogglefilter={() => (filterPanelOpen = !filterPanelOpen)}` to GalleryToolbar.

- [ ] **Step 4: Render MobileActionSheet**

```svelte
<!-- Mobile Action Sheet -->
<MobileActionSheet
  visible={mobileSheetVisible}
  onclose={() => (mobileSheetVisible = false)}
>
  {#if mobileSheetImage}
    <!-- Single image actions -->
    <button
      onclick={() => { mobileSheetVisible = false; openLightboxForImage(mobileSheetImage); }}
      class="flex items-center gap-3 w-full px-1 py-3 text-sm text-zinc-200 border-b border-zinc-700/50"
    >
      <svg class="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
      </svg>
      查看大图
    </button>

    <!-- Rate -->
    <div class="flex items-center gap-3 w-full px-1 py-3 text-sm text-zinc-200 border-b border-zinc-700/50">
      <span class="text-zinc-500 text-xs w-5 text-center">★</span>
      <div class="flex gap-1">
        {#each [1, 2, 3, 4, 5] as r}
          <button
            onclick={() => {
              store.updateAttributes(mobileSheetImage!.relativePath, { rating: r });
              mobileSheetVisible = false;
            }}
            class="text-lg {r <= (mobileSheetImage.rating ?? 0) ? 'text-amber-400' : 'text-zinc-600'}"
          >★</button>
        {/each}
      </div>
    </div>

    <!-- Color -->
    <div class="flex items-center gap-3 w-full px-1 py-3 text-sm text-zinc-200 border-b border-zinc-700/50">
      <span class="text-zinc-500 text-xs w-5 text-center">●</span>
      <div class="flex gap-2">
        {#each [["red", "bg-red-500"], ["yellow", "bg-yellow-500"], ["green", "bg-green-500"], ["blue", "bg-blue-500"], ["purple", "bg-purple-500"]] as [key, cls]}
          <button
            onclick={() => {
              store.updateAttributes(mobileSheetImage!.relativePath, { colorLabel: mobileSheetImage.colorLabel === key ? null : key });
              mobileSheetVisible = false;
            }}
            class="w-6 h-6 rounded-full {cls} {mobileSheetImage.colorLabel === key ? 'ring-2 ring-white' : ''}"
          ></button>
        {/each}
      </div>
    </div>

    <!-- Flag -->
    <div class="flex items-center gap-3 w-full px-1 py-3 text-sm text-zinc-200 border-b border-zinc-700/50">
      <span class="text-zinc-500 text-xs w-5 text-center">⚑</span>
      <div class="flex gap-2">
        <button
          onclick={() => {
            store.updateAttributes(mobileSheetImage!.relativePath, { flag: "pick" });
            mobileSheetVisible = false;
          }}
          class="px-3 py-1 rounded text-xs {mobileSheetImage.flag === 'pick' ? 'bg-green-500/20 text-green-400' : 'text-zinc-400 border border-zinc-700'}">Pick</button>
        <button
          onclick={() => {
            store.updateAttributes(mobileSheetImage!.relativePath, { flag: "reject" });
            mobileSheetVisible = false;
          }}
          class="px-3 py-1 rounded text-xs {mobileSheetImage.flag === 'reject' ? 'bg-red-500/20 text-red-400' : 'text-zinc-400 border border-zinc-700'}">Reject</button>
      </div>
    </div>

    <!-- Copy -->
    <button
      onclick={() => {
        navigator.clipboard.writeText(new URL(getImageUrl(mobileSheetImage!), window.location.origin).toString());
        mobileSheetVisible = false;
        showToast("链接已复制", "success");
      }}
      class="flex items-center gap-3 w-full px-1 py-3 text-sm text-zinc-200 border-b border-zinc-700/50"
    >
      <svg class="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
      复制链接
    </button>

    <!-- Download -->
    <button
      onclick={() => {
        handleDownload(mobileSheetImage!.relativePath);
        mobileSheetVisible = false;
      }}
      class="flex items-center gap-3 w-full px-1 py-3 text-sm text-zinc-200 border-b border-zinc-700/50"
    >
      <svg class="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      下载
    </button>

    <!-- Delete -->
    <button
      onclick={() => {
        mobileSheetVisible = false;
        handleDeleteSingle(mobileSheetImage!);
      }}
      class="flex items-center gap-3 w-full px-1 py-3 text-sm text-red-400"
    >
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      删除
    </button>
  {:else}
    <!-- Multi-select actions -->
    <div class="px-1 py-3 text-sm text-zinc-500">{store.selectedPaths.size} 张已选</div>
    <!-- Rate, color, flag batch actions -->
    <!-- Download and delete for batch -->
    <button
      onclick={() => {
        mobileSheetVisible = false;
        deleteConfirm = { paths: [...store.selectedPaths], message: `删除 ${store.selectedPaths.size} 张图片？` };
      }}
      class="flex items-center gap-3 w-full px-1 py-3 text-sm text-red-400"
    >
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      删除 ({store.selectedPaths.size})
    </button>
  {/if}
</MobileActionSheet>
```

- [ ] **Step 5: Pass Lightbox download callback**

```svelte
<Lightbox
  images={...}
  currentIndex={lightboxIndex}
  onclose={() => (lightboxOpen = false)}
  onnavigate={(i) => { lightboxIndex = i; }}
  ondownload={handleLightboxDownload}
/>
```

- [ ] **Step 6: Commit**

```bash
git add src/routes/generations/+page.svelte src/lib/components/gallery/LibraryView.svelte
git commit -m "feat: wire mobile action sheet, downloads, and filter toggle in gallery page"
```

---

## Verification

After implementing all tasks:
1. Resize browser to mobile width (375px) and verify: sidebar overlay works, grid shows 2 columns, toolbar stacks in two rows, long-press triggers bottom sheet
2. On actual phone: navigate to gallery, long-press an image, tap Download — verify file saves
3. In lightbox: swipe to navigate, pinch to zoom, tap download button
4. Desktop: verify no regressions — right-click menu, keyboard shortcuts all still work
