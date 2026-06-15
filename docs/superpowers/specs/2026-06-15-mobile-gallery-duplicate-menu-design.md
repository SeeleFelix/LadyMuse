# Mobile Gallery Long-Press Duplicate Menu Fix

**Date:** 2026-06-15
**Scope:** `src/lib/components/gallery/ThumbnailCard.svelte`
**Type:** Bug fix

## Problem

On mobile devices, long-pressing a thumbnail in the gallery management page (`/generations`, `LibraryView`) opens two overlapping menus with duplicated functionality:

1. `MobileActionSheet` — the bottom-sheet menu, opened by the custom 500 ms `touchstart` timer via the `onlongpress` prop
2. `ContextMenu` — the desktop-style popover, opened by the browser's native `contextmenu` event (mobile browsers map long-press to `contextmenu`) via the `oncontextmenu` prop

Both menus expose essentially the same actions (rate, color, flag, delete, view large, etc.), so the user sees two redundant menus appear together.

### Why `e.preventDefault()` in the page-level handler doesn't help

`handleContextMenu` in `src/routes/generations/+page.svelte` already calls `e.preventDefault()`, which suppresses the browser's *native* context menu — but it cannot prevent the Svelte handler itself from running. The custom `ContextMenu` popover still renders.

## Approach

Track "did a long-press just fire" as a single boolean inside `ThumbnailCard`. Use it to short-circuit the native `contextmenu` event **before** it reaches the parent's `oncontextmenu` callback, so the desktop popover never opens on a touch-originated interaction.

This is a surgical, localized fix:
- One file modified
- Zero changes to the public component API (`oncontextmenu` / `onlongpress` props unchanged)
- Zero impact on `InspectView`, `Lightbox`, or any other caller that doesn't wire up `onlongpress`

## Design

### File: `src/lib/components/gallery/ThumbnailCard.svelte`

**1. New internal state**

```ts
let longPressTriggered = false;
```

**2. `handleTouchStart` adjustments**

- Reset `longPressTriggered = false` at the very start of `handleTouchStart` (each new touch session begins clean)
- Inside the existing `setTimeout` callback, set `longPressTriggered = true` **before** invoking `onlongpress?.(...)`

**3. New internal `handleContextMenu(e: MouseEvent)`**

```ts
function handleContextMenu(e: MouseEvent) {
  if (longPressTriggered) {
    longPressTriggered = false;        // consume the flag (one-shot)
    e.preventDefault();                // suppress native browser menu
    e.stopPropagation();               // defensive: no bubbling
    return;                            // do NOT call oncontextmenu prop
  }
  oncontextmenu(image.relativePath, e);
}
```

**4. Wire it to the `<button>`**

Replace the existing inline arrow:

```svelte
oncontextmenu={(e) => oncontextmenu(image.relativePath, e)}
```

with:

```svelte
oncontextmenu={handleContextMenu}
```

### Invariants

- `longPressTriggered` is set to `true` **only** when the 500 ms timer actually fires (i.e., a real long-press was detected)
- The flag is consumed (reset to `false`) the moment a `contextmenu` event sees it, so subsequent mouse right-clicks on hybrid (touch + mouse) devices are unaffected
- `touchstart` unconditionally resets the flag at the entry of each touch session
- On pure-desktop environments, `touchstart` never fires, so `longPressTriggered` is permanently `false` and the existing right-click flow is untouched

### Event-timing verification

| Scenario | Event sequence | Result |
|---|---|---|
| Mobile long-press | `touchstart` (flag = false, timer armed) → 500 ms: timer fires (flag = true, MobileActionSheet opens) → `touchend` → ~50 ms later: native `contextmenu` fires (flag consumed, suppressed) | Only `MobileActionSheet` appears |
| Desktop right-click | No `touchstart`; flag stays `false` | `ContextMenu` opens normally |
| Hybrid: long-press then later mouse right-click | Long-press consumes flag → mouse `contextmenu` sees flag = `false` | Both interactions work independently |
| User releases early or moves finger > 10 px | `touchmove` / `touchend` already clears timer; flag remains `false` | No spurious suppression |

### Error handling

The `preventDefault` call inside the suppression branch is **load-bearing**. The page-level `handleContextMenu` is no longer reached on a long-press (because we don't forward the event), so if we don't call `preventDefault` ourselves, the browser's native long-press menu (save image / copy / etc.) will leak through.

## Testing Strategy

### Manual (required)

- **Mobile / DevTools touch emulation:** long-press a thumbnail → only `MobileActionSheet` (bottom sheet) appears; `ContextMenu` (popover) does **not**
- **Desktop:** right-click a thumbnail → only `ContextMenu` appears; behavior unchanged
- **DevTools toggle (mobile → desktop → mobile):** repeatedly long-press and right-click → no stale state, no leaked suppression across mode switches

### Automated (optional)

The change is small (~5 lines of logic). A `vitest` component test for `ThumbnailCard` could verify the flag transitions: dispatch `touchstart`, advance the timer, dispatch `contextmenu`, and assert that the `oncontextmenu` prop callback is not invoked while the `onlongpress` callback is. Not blocking for this fix.

## Out of Scope

- `InspectView` on mobile: long-press currently opens the desktop `ContextMenu` popover (no `onlongpress` is wired). This is a separate UX concern, not a duplicate-menu bug, and is left unchanged.
- `Lightbox` on mobile: same — no duplicate menu, separate UX concern.
- Any refactor of the long-press detection itself (e.g., switching to native `contextmenu` listener). Explicitly avoided because iOS Safari's `contextmenu`-on-long-press support is unreliable, which is the reason the manual 500 ms timer exists today.
