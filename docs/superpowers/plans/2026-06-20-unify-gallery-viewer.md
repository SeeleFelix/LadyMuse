# Unify Gallery Viewer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace InspectView with Lightbox as the single image viewer, clean up device detection mess, unify PC/mobile interaction.

**Architecture:** Delete InspectView, remove "inspect" from ViewMode, use Lightbox everywhere. PC double-click / mobile single tap opens Lightbox with store.select(). Lightbox uses CSS `md:` breakpoints for responsive layout.

**Tech Stack:** Svelte 5 (runes), Tailwind CSS

---

### Task 1: Clean up Lightbox.svelte — restore CSS breakpoints

**Files:** `src/lib/components/gallery/Lightbox.svelte`

- [ ] **Step 1: Remove isMobile/isDesktop/STATIC TEST, restore md: classes**

Remove lines 5-6 (the function definitions):
```ts
const isMobile = () => /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const isDesktop = () => !isMobile();
```

Remove the STATIC TEST banner (currently around line 371).

Restore `md:` breakpoints:

Replace `class:hidden={isMobile()}` with `hidden md:block` on the "1:1" button and nav arrows.

Replace `{#if showInfo && currentImage && isDesktop()}` with `{#if showInfo && currentImage}` + `hidden md:block` on the desktop sidebar div.

Replace `{#if showInfo && currentImage && isMobile()}` wrapper — remove the `isMobile()` check, keep `showInfo && currentImage`:
```svelte
{#if showInfo && currentImage}
  <MobileImageSheet ... />
{/if}
```

Replace `{#if showFilmstrip && images.length > 1 && isDesktop()}` with `{#if showFilmstrip && images.length > 1}` + `hidden md:flex` on the filmstrip div.

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/Lightbox.svelte
git commit -m "fix: remove device detection, restore CSS md: breakpoints in Lightbox"
```

---

### Task 2: Clean up MobileImageSheet.svelte

**Files:** `src/lib/components/gallery/MobileImageSheet.svelte`

- [ ] **Step 1: Restore md:hidden classes**

Add `md:hidden` back to the collapsed bar:
```svelte
<button class="md:hidden flex items-center justify-between w-full px-4 py-2.5 bg-zinc-900/90 backdrop-blur border-t border-zinc-700/50">
```

Add `md:hidden` back to the expanded overlay backdrop and panel.

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/MobileImageSheet.svelte
git commit -m "fix: restore md:hidden classes on MobileImageSheet"
```

---

### Task 3: Remove "inspect" from ViewMode type

**Files:** `src/lib/stores/gallery-store.svelte.ts`

- [ ] **Step 1: Update ViewMode**

```ts
export type ViewMode = "library" | "compare";
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/stores/gallery-store.svelte.ts
git commit -m "refactor: remove inspect from ViewMode"
```

---

### Task 4: Remove Inspect button from GalleryToolbar

**Files:** `src/lib/components/gallery/GalleryToolbar.svelte`

- [ ] **Step 1: Remove Inspect from viewModes array**

Delete the `{ key: "inspect", label: "Inspect", shortcut: "E" }` entry from the `viewModes` array (line 50).

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/GalleryToolbar.svelte
git commit -m "refactor: remove Inspect button from GalleryToolbar"
```

---

### Task 5: Update generations/+page.svelte

**Files:** `src/routes/generations/+page.svelte`

This is the main integration task.

- [ ] **Step 1: Remove InspectView import and rendering**

Remove the import:
```svelte
// DELETE: import InspectView from "$lib/components/gallery/InspectView.svelte";
```

Remove the InspectView rendering branch in the template (the `{:else if store.viewMode === "inspect"}` block). Keep only library and compare.

- [ ] **Step 2: Update Lightbox navigation to call store.select()**

In `handleLightboxNavigate`, add `store.select()` after updating the index:
```ts
function handleLightboxNavigate(index: number) {
  lightboxIndex = index;
  if (store.images[index]) {
    store.select(store.images[index].relativePath, false, false);
  }
}
```

- [ ] **Step 3: Update click handler — single tap on mobile opens Lightbox**

Replace the existing `onselect` handler in `LibraryView` usage. The gallery page currently passes `handleCardClick`-like logic. Update the select handler:

The current flow: `onselect` → calls function that selects the image. We need to distinguish mobile vs desktop. The simplest approach: detect touch device in gallery page:
```ts
const hasTouch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
```

Wait — this doesn't work for double-click vs single click. For PC double-click, we need the ThumbnailCard's `ondblclick` handler. Let me check the current ThumbnailCard interface.

ThumbnailCard already has `ondblclick` prop. We need:
- Gallery: `ondblclick` → open Lightbox (PC double-click)
- Gallery: `onselect` → if mobile, open Lightbox; if desktop, just select

Actually, we can't easily differentiate PC vs mobile in `onselect`. The simpler approach: use `ondblclick` for Lightbox on all devices, and on mobile, make the single click also open Lightbox. But without device detection...

Simplest implementable approach:
- PC: `ondblclick` → `openLightboxForImage` (Lightbox on double-click)
- Mobile: `onselect` → `openLightboxForImage` (Lightbox on tap)
- Both also call `store.select()` first

For distinguishing, check `'ontouchstart' in window`:
```ts
const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;
```

Then in the LibraryView props:
```svelte
onselect={(path) => {
  const img = store.images.find((i) => i.relativePath === path);
  if (!img) return;
  store.select(path, false, false);
  if (isTouchDevice && img) openLightboxForImage(img);
}}
ondblclick={(path) => {
  const img = store.images.find((i) => i.relativePath === path);
  if (!img) return;
  store.select(path, false, false);
  if (!isTouchDevice && img) openLightboxForImage(img);
}}
```

- [ ] **Step 4: Simplify handleLongPress to only handle multi-select**

The single-image branch (opens Lightbox) is now redundant since single-tap does the same. Keep only the multi-select batch action path:
```ts
function handleLongPress(path: string) {
  const image = store.images.find((img) => img.relativePath === path);
  if (!image) return;
  if (store.selectedPaths.size > 1 && store.selectedPaths.has(path)) {
    mobileSheetImage = null;
    mobileSheetVisible = true;
  }
}
```

Keep `mobileSheetVisible` and `mobileSheetImage` — they're still used for multi-select batch operations.

- [ ] **Step 5: Commit**

```bash
git add src/routes/generations/+page.svelte
git commit -m "feat: replace InspectView with Lightbox, unify click-to-view behavior"
```

---

### Task 6: Delete InspectView.svelte

**Files:** `src/lib/components/gallery/InspectView.svelte`

- [ ] **Step 1: Delete the file**

```bash
git rm src/lib/components/gallery/InspectView.svelte
git commit -m "refactor: remove InspectView, replaced by Lightbox"
```

---

### Task 7: Verify

- [ ] **Step 1: Build check**

```bash
rm -rf .svelte-kit build && npm run build 2>&1 | tail -10
```

Expected: build succeeds, no errors.

- [ ] **Step 2: Verify no references to deleted code**

```bash
grep -rn "InspectView\|inspect\|isMobile\|isDesktop\|STATIC TEST" src/ --include="*.ts" --include="*.svelte" | grep -v node_modules
```

Expected: no matches (all cleaned up).
