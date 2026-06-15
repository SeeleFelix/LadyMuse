# Mobile Gallery Long-Press Duplicate Menu Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the desktop-style `ContextMenu` popover from opening alongside `MobileActionSheet` when a thumbnail is long-pressed on a touch device.

**Architecture:** Track "long-press just fired" as a single boolean inside `ThumbnailCard.svelte`. The component's internal `contextmenu` handler consumes that flag to suppress the event before it reaches the parent's `oncontextmenu` callback. Pure local change — no API change, no other files touched.

**Tech Stack:** Svelte 5 (runes: `$state`, `$props`), TypeScript, Vite, svelte-check. Vitest runs in `environment: "node"` only and the project has no Svelte component test harness, so verification is manual per the spec.

**Reference spec:** `docs/superpowers/specs/2026-06-15-mobile-gallery-duplicate-menu-design.md`

---

## File Structure

Only one file is modified:

- **Modify:** `src/lib/components/gallery/ThumbnailCard.svelte` — add `longPressTriggered` flag, update `handleTouchStart` to manage it, add `handleContextMenu` function, rewire the `<button>`'s `oncontextmenu` to use it.

No new files. No API changes (the `oncontextmenu` and `onlongpress` props keep their existing signatures).

---

### Task 1: Add the `longPressTriggered` flag and wire it into `handleTouchStart`

**Files:**
- Modify: `src/lib/components/gallery/ThumbnailCard.svelte:32-50`

This is the "set" side: declare the flag, reset it on every fresh touch, and set it the moment the 500 ms long-press timer actually fires.

- [ ] **Step 1: Add the flag declaration next to the other component-local state**

In `src/lib/components/gallery/ThumbnailCard.svelte`, find this block (currently lines 32-33):

```ts
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let touchStartPos = { x: 0, y: 0 };
```

Replace with:

```ts
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let touchStartPos = { x: 0, y: 0 };
  // True between the moment the long-press timer fires and the resulting
  // native contextmenu event being suppressed. One-shot: consumed by the
  // internal contextmenu handler so subsequent mouse right-clicks (e.g. on
  // hybrid touch+laptop devices) still work.
  let longPressTriggered = false;
```

- [ ] **Step 2: Update `handleTouchStart` to reset the flag at entry and set it inside the timer callback**

In the same file, find `handleTouchStart` (currently lines 43-50):

```ts
  function handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    longPressTimer = setTimeout(() => {
      onlongpress?.(image.relativePath);
    }, 500);
  }
```

Replace with:

```ts
  function handleTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    longPressTriggered = false;
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    longPressTimer = setTimeout(() => {
      longPressTriggered = true;
      onlongpress?.(image.relativePath);
    }, 500);
  }
```

Two changes from the original:
1. Reset `longPressTriggered = false` immediately after the early-return guard — guarantees each touch session starts clean even if a previous flag wasn't consumed.
2. Set `longPressTriggered = true` inside the `setTimeout` callback **before** invoking `onlongpress`, so the flag is in place by the time the follow-up native `contextmenu` event arrives.

---

### Task 2: Add `handleContextMenu` and rewire the `<button>`

**Files:**
- Modify: `src/lib/components/gallery/ThumbnailCard.svelte` (new function near `handleDownload`; the `<button>`'s `oncontextmenu` attribute around line 82)

This is the "consume" side: intercept `contextmenu` at the component boundary, suppress it when a long-press just fired, otherwise delegate to the parent's `oncontextmenu` prop exactly as before.

- [ ] **Step 1: Add the `handleContextMenu` function**

In `src/lib/components/gallery/ThumbnailCard.svelte`, find `handleDownload` (currently lines 72-76):

```ts
  function handleDownload(e: Event) {
    e.stopPropagation();
    e.preventDefault();
    ondownload?.(image.relativePath);
  }
```

Immediately after it (i.e., after the closing brace of `handleDownload`, before the closing `</script>` tag), add:

```ts

  function handleContextMenu(e: MouseEvent) {
    if (longPressTriggered) {
      longPressTriggered = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    oncontextmenu(image.relativePath, e);
  }
```

Why each line matters:
- `longPressTriggered = false;` — one-shot consumption. Without this, a hybrid device (touch laptop) that fires long-press → contextmenu → later a mouse-driven contextmenu would see the flag still `true` and incorrectly suppress the legitimate right-click.
- `e.preventDefault();` — load-bearing. The parent's `handleContextMenu` is no longer reached on a long-press (we don't forward the event), so without this the browser's own long-press menu ("save image", "copy", etc.) would leak through.
- `e.stopPropagation();` — defensive; prevents any ancestor listener from re-triggering.
- `return;` — must NOT fall through to the `oncontextmenu(...)` call below.
- The `else` path is the unchanged desktop behavior.

- [ ] **Step 2: Rewire the `<button>`'s `oncontextmenu` to use the new function**

In the same file, find the `<button>` opening tag (currently lines 79-86):

```svelte
<button
  onclick={(e) => onselect(image.relativePath, e)}
  {ondblclick}
  oncontextmenu={(e) => oncontextmenu(image.relativePath, e)}
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  tabindex="0"
```

Replace the `oncontextmenu` line — change only that one line, leave the rest untouched:

```svelte
<button
  onclick={(e) => onselect(image.relativePath, e)}
  {ondblclick}
  oncontextmenu={handleContextMenu}
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  tabindex="0"
```

---

### Task 3: Type-check and manual verification

**Files:** none modified.

No automated component tests exist in this project (vitest is `environment: "node"` only, no Svelte testing library installed). The spec explicitly classified automated tests as optional / non-blocking. Verification is via `svelte-check` plus the manual matrix below.

- [ ] **Step 1: Run `svelte-check` to confirm no type errors**

Run:

```bash
npm run check
```

Expected: `0 errors, 0 warnings, 0 hints` (or whatever the baseline is for this repo — re-run before the change if unsure and confirm the count doesn't increase).

If a type error appears related to `handleContextMenu` or the `longPressTriggered` declaration, fix it before continuing. The signature `MouseEvent` matches what Svelte's `oncontextmenu` handler provides, and `e.preventDefault()` / `e.stopPropagation()` are both defined on `MouseEvent`, so this should pass cleanly.

- [ ] **Step 2: Start the dev server**

Run:

```bash
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`). Navigate to the gallery management page (`/generations`).

- [ ] **Step 3: Mobile long-press verification — only `MobileActionSheet` should appear**

Open browser DevTools → Toggle device toolbar (Ctrl+Shift+M / Cmd+Shift+M) → pick any phone preset (e.g., iPhone 12 Pro).

Find a thumbnail in the grid. Press and hold (long-click) on it for ~1 second.

**Expected:**
- ✅ The bottom sheet (`MobileActionSheet`) slides up with actions like 查看大图 / 评分 / 颜色标记 / 标记 / 加入收藏集 / 删除.
- ❌ The desktop-style popover (`ContextMenu`) does **NOT** appear at the touch coordinates.
- ❌ The browser's native context menu (save image / copy / etc.) does **NOT** appear either.

If both menus appear: the fix didn't take. Re-check that `oncontextmenu={handleContextMenu}` is correctly bound and that `longPressTriggered = true` is being set inside the timer callback.

Close the sheet (tap the backdrop) before the next step.

- [ ] **Step 4: Desktop right-click verification — `ContextMenu` should appear, unchanged**

Without changing tabs, switch DevTools back to desktop viewport (toggle the device toolbar off). Reload the page.

Right-click on any thumbnail.

**Expected:**
- ✅ The desktop-style popover (`ContextMenu`) appears at the cursor with 查看大图 / 评分 / 颜色标记 / 标记 / 加入收藏集 / 复制提示词 / 复制图片链接 / 删除.
- ❌ The bottom sheet (`MobileActionSheet`) does **NOT** appear.
- ❌ The browser's native context menu does **NOT** appear (parent's `e.preventDefault()` handles that path; we never reach it from desktop).

If `ContextMenu` no longer appears on desktop right-click: the flag is being left set or the `else` branch isn't forwarding. Re-verify that `longPressTriggered` starts as `false` and only goes `true` inside the timer.

- [ ] **Step 5: Hybrid-mode sanity check (optional but recommended)**

With DevTools still in device mode, long-press once (sheet appears, `ContextMenu` suppressed). Close the sheet. Now toggle device mode off and right-click the same thumbnail.

**Expected:** `ContextMenu` appears normally. This verifies the flag was consumed by the earlier suppression and didn't leak into a later unrelated right-click.

---

### Task 4: Commit

**Files:** `src/lib/components/gallery/ThumbnailCard.svelte`

- [ ] **Step 1: Stage the modified file**

```bash
git add src/lib/components/gallery/ThumbnailCard.svelte
```

- [ ] **Step 2: Commit with a clean message (no author trailers)**

```bash
git commit -m "fix: suppress desktop contextmenu on mobile thumbnail long-press"
```

The commit subject follows the repo's existing `fix:` convention (see `git log --oneline` — recent entries like `fix: adapt gallery page layout for mobile single-column`).

Per project / global instructions, do not add `Co-Authored-By`, `Signed-off-by`, or any `Generated by ...` trailer.

- [ ] **Step 3: Verify the commit landed cleanly**

```bash
git log --oneline -3
git status
```

Expected: the new commit is at HEAD; `git status` shows a clean working tree.

---

## Out of Scope (do not do during this plan)

- Do not modify `InspectView.svelte`, `Lightbox.svelte`, `LibraryView.svelte`, or any other file. Their mobile menu UX is a separate concern (see spec § "Out of Scope").
- Do not add Svelte component test infrastructure. The spec classified this as optional.
- Do not refactor the long-press detection (e.g., switching to a native `contextmenu` listener). The 500 ms timer exists deliberately because iOS Safari's long-press → `contextmenu` is unreliable.
