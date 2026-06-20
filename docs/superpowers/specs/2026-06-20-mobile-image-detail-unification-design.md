# Mobile Image Detail Unification

## Goal

Unify the mobile image detail experience between gallery (generations) and share pages, using a single `MobileImageSheet` component that replaces the current split between Lightbox's draggable bottom sheet and MobileActionSheet's single-image actions.

## Current State

- **Gallery mobile**: Lightbox shows only the image. Ratings/flags/actions live in `MobileActionSheet`, triggered by long-press on a thumbnail — separate from the lightbox.
- **Share mobile**: Lightbox with `showInfo=true` shows a draggable bottom sheet (ImageInfo), read-only.

Same Lightbox component, two different mobile experiences. The gallery path is awkward: you view the image in one place but do all actions in another.

## Design

### Component: `MobileImageSheet`

A unified mobile detail component used inside Lightbox. Two layers:

**Collapsed bar** (always visible, fixed at image area bottom):
- Semi-transparent background
- Compact row: filename + dimensions (e.g. `1024×768`) + star rating
- Expand indicator on the right

**Expanded panel** (toggles on bar tap):
- Slides up from bottom as a fixed overlay (no drag interaction)
- Dismissed by tapping overlay backdrop or close button
- Content:
  - Top: `ImageInfo` — file info + generation params, always shown, always read-only
  - Bottom: action area — only rendered when `showActions=true`, with optional callbacks

### Props

```
MobileImageSheet
  // Image data (required)
  filename, fileSize, width, height, fileFormat
  // Metadata (from ImageInfo)
  rating, extractedModels, extractedLoras, extractedSamplers,
  extractedSchedulers, steps, cfgScale, seed,
  positivePrompt, negativePrompt
  // Control
  showActions: boolean (default false)
  // Action callbacks (optional, only used when showActions=true)
  onrate, oncolor, onflag, ondownload, ondelete, oncopylink
```

### Behavior

- **Gallery**: Lightbox passes `showActions=true` with action callbacks. The collapsed bar shows rating. Expanded panel shows info + action buttons (rate, color, flag, copy link, download, delete).
- **Share**: Lightbox passes `showActions=false` (default). The collapsed bar shows rating when present. Expanded panel shows info only.

## Files Changed

1. **New**: `src/lib/components/gallery/MobileImageSheet.svelte`
2. **Modified**: `src/lib/components/gallery/Lightbox.svelte` — replace inline draggable bottom sheet with `MobileImageSheet`
3. **Modified**: `src/routes/generations/+page.svelte` — pass action props to Lightbox; remove single-image action content from `MobileActionSheet`
4. **Modified**: `src/routes/share/+page.svelte` — explicit `showActions=false` (same behavior, cleaner code)

## Backward Compatibility

- Lightbox's `showInfo` prop keeps its semantics — when true, MobileImageSheet renders
- Share page behavior unchanged
- `MobileActionSheet` retains multi-select actions, loses single-image action duplication

## Non-Goals

- Changing desktop sidebar behavior
- Adding edit capabilities to share page
- Removing the drag-to-dismiss gesture from MobileActionSheet (it still serves batch operations and other use cases)
