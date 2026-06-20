# ImageDetail — Unified Image Detail Component

## Goal

Replace DetailPanel, MobileImageSheet, ImageInfo, and Lightbox's inline sidebar with a single `ImageDetail.svelte` component that handles all image detail display across desktop and mobile, gallery and share.

## Props

```
ImageDetail
  image: ImageResult
  readonly = false           // true = share page (no editing)
  showThumbnail = false      // thumbnail preview at top
  showDelete = false         // delete button
  closeable = false          // close/x button
  onclose?: () => void
  onrate?: (rating: number) => void
  oncolor?: (color: string | null) => void
  onflag?: (flag: string | null) => void
  ondownload?: () => void
  ondelete?: () => void
  oncopylink?: () => void
```

## Content sections (top to bottom)

1. Thumbnail (if showThumbnail)
2. Rating (★ stars — readonly or editable)
3. Color label (colored dots — readonly or editable)
4. Flag (Pick/Reject — readonly or editable)
5. Tags (readonly or editable via TagEditor)
6. File info (filename, size, dimensions, format — always readonly)
7. Generation params (prompts, models, samplers — always readonly)
8. Actions row (download, copy link — only if callbacks provided)
9. Delete button (if showDelete)

## Responsive behavior

- **Desktop (md+)**: sidebar panel, `w-80`, scrollable, border-left
- **Mobile (<md)**: collapsed info bar at bottom (`md:hidden`), tap to expand into fixed overlay

## Usage per scenario

| Scenario | readonly | showThumbnail | showDelete | closeable |
|----------|----------|---------------|------------|-----------|
| Gallery DetailPanel | false | true | true | true |
| Gallery Lightbox desktop | false | false | true | false |
| Gallery Lightbox mobile | false | false | true | false |
| Share Lightbox desktop | true | false | false | false |
| Share Lightbox mobile | true | false | false | false |

## Files affected

- **Create**: `src/lib/components/gallery/ImageDetail.svelte`
- **Delete**: `src/lib/components/gallery/MobileImageSheet.svelte`, `src/lib/components/gallery/ImageInfo.svelte`
- **Modify**: `src/lib/components/gallery/DetailPanel.svelte` → replace internals with ImageDetail
- **Modify**: `src/lib/components/gallery/Lightbox.svelte` → desktop sidebar + mobile section both use ImageDetail
- **Modify**: `src/lib/components/gallery/CompareView.svelte` → replace GalleryDetail usage with ImageDetail
- **Modify**: `src/lib/components/gallery/GalleryDetail.svelte` → delete or replace internals
- **Modify**: `src/routes/generations/+page.svelte` → simplify DetailPanel props
- **Modify**: `src/routes/share/+page.svelte` → unchanged (Lightbox just works)

## Non-Goals

- Changing existing data flow (store, API calls)
- Merging DetailPanel and Lightbox sidebar into one instance (they're different components in different places)
