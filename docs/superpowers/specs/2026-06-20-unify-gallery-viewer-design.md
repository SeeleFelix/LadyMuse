# Unify Gallery Image Viewing with Lightbox

## Goal

Replace InspectView with Lightbox as the single image viewer in the gallery page, unifying the mobile/desktop experience and eliminating duplicated zoom/pan/navigation code.

## Current State (the real problem)

Gallery has **two** full-screen image viewers:
- **Lightbox** — full-screen overlay, zoom/pan/touch gestures, MobileImageSheet, desktop sidebar, filmstrip. Used by share page and gallery long-press.
- **InspectView** — embedded full-screen view, zoom/pan (no touch), its own filmstrip. Used by gallery "inspect" mode only.

Both implement zoom, pan, keyboard nav, and filmstrip independently.

## Design

### Remove InspectView, use Lightbox everywhere

- Delete `InspectView.svelte`
- Remove `"inspect"` from `ViewMode` type
- Gallery toolbar: Remove "Inspect" button — Lightbox opens via thumbnail click only
- Both library and compare views trigger Lightbox for full-screen viewing

### Lightbox data source

Lightbox currently accepts a static `images` array. Gallery needs it to stay reactive to `store.images`. Two approaches:
- **A:** Lightbox accepts a `GalleryStore` object optionally, uses `store.images` when provided
- **B:** Gallery page keeps deriving `lightboxImages` from `store.images` via `$derived`

**Recommend B** — Lightbox stays data-source agnostic, gallery page derives the array reactively. No need to couple Lightbox to the store.

### Filmstrip in Lightbox

Current Lightbox filmstrip uses the `images` prop (static snapshot). After switching to `$derived` that re-computes when `store.images` changes, the filmstrip stays in sync. In Lightbox, `onnavigate` updates the index → gallery page's handler calls `store.select()` on the new image.

### Gesture: PC vs mobile

- **Gallery PC**: double-click thumbnail → `store.select()` + open Lightbox
- **Gallery Mobile**: single tap thumbnail → `store.select()` + open Lightbox
- **Share** (unchanged): single click → open Lightbox

Detection: check `navigator.maxTouchPoints > 0` or use `pointer: coarse` CSS media query. The ThumbnailCard already has touch vs click distinction.

### Navigation in Lightbox

When user navigates in Lightbox (arrows, swipe, filmstrip click), gallery's `onnavigate` handler:
1. Updates `lightboxIndex`
2. Calls `store.select(images[index].relativePath, false, false)` to sync `activeImage`

This keeps DetailPanel (desktop sidebar) in sync with the current Lightbox image.

### MobileImageSheet

Already implemented. Gallery passes `showActions={true}` with callbacks; share passes `showActions={false}`.

## Files Changed

1. **Delete**: `src/lib/components/gallery/InspectView.svelte`
2. **Modify**: `src/lib/stores/gallery-store.svelte.ts` — remove `"inspect"` from ViewMode
3. **Modify**: `src/routes/generations/+page.svelte` — remove InspectView import/usage, update thumbnail click handlers, update Lightbox navigation to call store.select()
4. **Modify**: `src/lib/components/gallery/Lightbox.svelte` — clean up device detection mess, use CSS `md:` breakpoints
5. **Modify**: `src/lib/components/gallery/MobileImageSheet.svelte` — add back `md:hidden` CSS classes
6. **Modify**: `src/lib/components/gallery/GalleryToolbar.svelte` — remove/rename Inspect button

## Non-Goals

- Share page behavior remains unchanged
- CompareView stays as-is
- No server-side device detection
