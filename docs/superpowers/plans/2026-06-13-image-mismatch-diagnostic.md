# Image-Mismatch Diagnostic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add minimal, unified-prefix logging at four points in the selection→render data flow so the user can reproduce the image-mismatch bug once and capture a trace that pinpoints the failing stage.

**Architecture:** Pure additive `console` calls behind the `[img-debug]` prefix. No behavior change, no new deps. Logs are temporary and removed once the root cause is fixed.

**Tech Stack:** Svelte 5 runes (`$state`, `$derived`), SvelteKit.

**Spec:** `docs/superpowers/specs/2026-06-13-gallery-trash-and-deletion-protection-design.md` §4.

---

## File Structure

- **Modify** `src/lib/stores/gallery-store.svelte.ts` — log at `select()` entry, `activeImage` assignment, and inside `handleSSEEvent`.
- **Modify** `src/lib/components/gallery/DetailPanel.svelte` — log the `image` prop and constructed URL via a `$effect`.

---

### Task 1: Log points in the gallery store

**Files:**
- Modify: `src/lib/stores/gallery-store.svelte.ts` — `select()` (lines ~300-342) and `handleSSEEvent` (lines ~410-426).

- [ ] **Step 1: Add logging to `select()`**

In `src/lib/stores/gallery-store.svelte.ts`, find the `select` function (starts ~line 300). It begins with:

```typescript
  function select(path: string, multi = false, range = false) {
    const currentIndex = images.findIndex((img) => img.relativePath === path);
```

Add a log line immediately after the `currentIndex` line:

```typescript
  function select(path: string, multi = false, range = false) {
    const currentIndex = images.findIndex((img) => img.relativePath === path);
    console.log("[img-debug] select()", {
      path,
      imagesLen: images.length,
      index: currentIndex,
      activeBefore: activeImage?.relativePath ?? null,
    });
```

- [ ] **Step 2: Log the `activeImage` assignment**

At the end of `select()` (the line `activeImage = images.find((img) => img.relativePath === path) ?? null;`, ~line 341), replace it with a logged version:

```typescript
    const found = images.find((img) => img.relativePath === path) ?? null;
    console.log("[img-debug] activeImage assigned", {
      requested: path,
      foundPath: found?.relativePath ?? null,
      activeAfter: found?.relativePath ?? null,
    });
    activeImage = found;
  }
```

- [ ] **Step 3: Log SSE-driven mutations**

In `handleSSEEvent` (starts ~line 410), add logging at the top of the function and inside the `delete` branch. Replace:

```typescript
  function handleSSEEvent(event: FileEvent) {
    if (event.type === "delete") {
      images = images.filter((img) => img.relativePath !== event.path);
      _removeSelection(event.path);
      if (activeImage?.relativePath === event.path) {
        activeImage = images[0] ?? null;
      }
      pagination.total = Math.max(0, pagination.total - 1);
    } else {
```

with:

```typescript
  function handleSSEEvent(event: FileEvent) {
    console.log("[img-debug] sse", {
      type: event.type,
      path: event.path,
      activeBefore: activeImage?.relativePath ?? null,
      imagesLen: images.length,
    });
    if (event.type === "delete") {
      images = images.filter((img) => img.relativePath !== event.path);
      _removeSelection(event.path);
      if (activeImage?.relativePath === event.path) {
        activeImage = images[0] ?? null;
        console.log("[img-debug] activeImage replaced by SSE delete", {
          newPath: activeImage?.relativePath ?? null,
        });
      }
      pagination.total = Math.max(0, pagination.total - 1);
    } else {
```

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/gallery-store.svelte.ts
git commit -m "chore: add img-debug logging to gallery store select and SSE handler"
```

---

### Task 2: Log point in DetailPanel

**Files:**
- Modify: `src/lib/components/gallery/DetailPanel.svelte` — add a `$effect` reacting to the `image` prop and the `getImageUrl` helper (lines ~61-64).

- [ ] **Step 1: Add a diagnostic `$effect`**

In `src/lib/components/gallery/DetailPanel.svelte`, immediately after the `getImageUrl` function definition (~line 64), add:

```typescript
  $effect(() => {
    console.log("[img-debug] DetailPanel render", {
      propPath: image?.relativePath ?? null,
      url: image ? getImageUrl() : null,
    });
  });
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 3: Manual verification**

Run `npm run dev`. Open the gallery, click several thumbnails in sequence, open and close the lightbox, and let some SSE events fire (e.g. generate a new image in ComfyUI). Confirm the `[img-debug]` lines appear in the browser console at each transition.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/gallery/DetailPanel.svelte
git commit -m "chore: add img-debug logging to DetailPanel render"
```

---

### Task 3: Capture the trace (no code change)

- [ ] **Step 1: Reproduce the bug**

With the dev server running, perform whatever sequence triggers the mismatch (the reported symptom is "detail panel / preview shows the wrong image"). The moment you notice the wrong image displayed, **do not click anything else** — switch to the browser console and copy every `[img-debug]` line from the session.

- [ ] **Step 2: Paste the trace into a follow-up**

Report the captured `[img-debug]` trace back. The sequence of `select()` → `activeImage assigned` → `DetailPanel render` lines (and any intervening `sse` lines) will show exactly where the path diverges — e.g. `select` called with the right path but `foundPath: null`, or an SSE delete silently replacing `activeImage`.

The actual fix is a separate task scoped to whatever the trace reveals. Once the fix lands, remove all `[img-debug]` lines (grep and delete) in a single cleanup commit.
