# Gallery Mobile Adaptation Design

## Goal

Make `/generations` gallery page usable on mobile browsers so users can browse, view, and download images from their phone on the same LAN.

## Scope

- `/generations` page and all child components (library grid, lightbox, toolbar, context menu, batch actions, trash view)
- NOT: other pages (builder, chat, knowledge, etc.)

## Design

### 1. Layout & Navigation

On narrow viewports (below `md` breakpoint = 768px):
- Sidebar defaults to hidden
- Hamburger button in top-left corner reveals sidebar as a sliding overlay (left edge)
- Tapping the dark overlay dismisses the sidebar
- Main content area occupies full width

### 2. Gallery Grid

- `grid-cols-2` on small screens, `md:grid-cols-3`, `lg:grid-cols-4`, `xl:grid-cols-5`, `2xl:grid-cols-6`
- Each card has a small download icon button in the corner (clear of selection area)
- Grid spacing reduced on mobile: `gap-2` on small screens, `gap-3` on larger

### 3. Mobile Context Menu

- Long-press on an image card triggers a bottom sheet (action sheet) instead of the desktop right-click context menu
- Actions: open lightbox, rate (star row), color label, flag (pick/reject), add to collection, copy prompt, copy image URL, download, delete
- Single and multi-select menus follow the same structure as the existing ContextMenu

### 4. Lightbox

Touch interactions:
- Swipe left/right: navigate between images
- Double-tap: toggle zoom (fit ↔ 3x)
- Pinch-to-zoom: scale between min/max
- Drag to pan when zoomed in

Toolbar additions:
- Download button: triggers browser download of the original image
- Copy link button: copies the image URL to clipboard

### 5. Toolbar

Mobile layout:
- Search input: full width, top row
- Sort, filter, and view mode toggles: icon-only buttons, tap opens bottom sheet with options
- Refresh and trash buttons: icon-only, kept visible

### 6. Download

- Card-level: small icon button on each thumbnail (corner, 24px tap target minimum)
- Lightbox-level: toolbar button
- Download handled via `fetch` + `Blob` + object URL, preserving original filename
- Uses `<a download>` pattern for broad mobile browser compatibility

## Non-Goals

- QR code generation (user decided against it)
- Dedicated share/send page (existing gallery serves as the mobile page)
- Responsive layout for non-gallery pages
- PWA / service worker / offline support
