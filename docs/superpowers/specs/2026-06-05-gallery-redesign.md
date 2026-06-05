# Gallery Redesign Spec

## Problem Statement

The current gallery management in LadyMuse has fundamental issues across all layers:

- **File sync**: Only detects new files; deletions, renames, and modifications are invisible to the UI
- **UI/UX**: No virtual scrolling, inconsistent state management, missing keyboard shortcuts
- **Management features**: Basic rating/tagging exists but the workflow is clunky
- **Viewing**: Metadata display is incomplete; ComfyUI workflow data is not fully utilized
- **Metadata extraction**: Only ComfyUI workflow/prompt JSON is extracted; EXIF, XMP, other PNG text chunks are ignored
- **Query capability**: Generation parameters stored as opaque JSON string, cannot be filtered by model/LoRA/sampler

The user wants a **Lightroom-style** experience supporting both rapid browsing and deep inspection of AI-generated images (1K-10K scale).

## Strategy

Bottom-up layered rebuild: fix the foundation first, then build UI on top.

1. Data sync engine (ground truth between disk and database)
2. Data query layer (multi-dimensional filtering with cursor pagination)
3. State management (unified gallery store)
4. UI components (Library / Inspect / Compare modes)

## Layer 1: FileSyncService

Replaces the current `comfyui-watcher.ts` which only listens for new files.

### Real-time Monitoring

- Use **chokidar** to watch the ComfyUI output directory (recursive)
- Listen for `add`, `unlink`, `change` events
- Filter to supported formats: PNG, JPG, JPEG, WebP
- 500ms debounce to batch rapid events (avoid intermediate states during ComfyUI writes)

### Startup Reconciliation

- Scan all image files on disk, compare against `image_attributes` table
- New files on disk: extract metadata and insert into database
- Database records with no corresponding file: mark as `missing` (shown dimmed in UI, excluded from queries by default, auto-deleted after 7 days)
- Files on disk not in database: extract metadata and insert

### Periodic Validation (Fallback)

- Configurable interval (default 5 minutes)
- Incremental check: only verify recently modified files, not full scan
- Reconcile any drift between disk and database

### SSE Broadcast

- Extend event types: `{ type: "add", path }`, `{ type: "delete", path }`, `{ type: "modify", path }`
- All connected clients receive updates in real-time
- User-triggered deletions broadcast through the same channel

## Layer 1b: Metadata Extraction

### What Gets Extracted

From every image file, extract **all available metadata**:

| Source | Data |
|--------|------|
| ComfyUI workflow JSON | Full node graph (preserved intact for "Send to ComfyUI") |
| ComfyUI prompt JSON | Positive/negative prompts |
| PNG text chunks | All text chunks, not limited to ComfyUI keys |
| EXIF | Dimensions, color space, bit depth, software tag |
| XMP / IPTC | If present (from external tool processing) |
| File system | File size, modification time, format |

### Extracted Index Fields

From the ComfyUI workflow, extract searchable fields into dedicated columns (JSON arrays to handle multiple values):

| Column | Type | Content |
|--------|------|---------|
| `extractedModels` | JSON array | All checkpoint model names |
| `extractedLoras` | JSON array | All LoRA model names |
| `extractedSamplers` | JSON array | All sampler names |
| `extractedSchedulers` | JSON array | All scheduler names |
| `positivePrompt` | TEXT | Positive prompt text |
| `negativePrompt` | TEXT | Negative prompt text |
| `steps` | INTEGER | Steps value (0 if not extractable) |
| `cfgScale` | REAL | CFG scale value (0 if not extractable) |
| `seed` | TEXT | Seed value (text to preserve full precision) |

### Image Physical Properties

Stored as dedicated columns for efficient range queries:

| Column | Type | Content |
|--------|------|---------|
| `width` | INTEGER | Image width in pixels |
| `height` | INTEGER | Image height in pixels |
| `aspectRatio` | TEXT | portrait / landscape / square |
| `fileSize` | INTEGER | File size in bytes |
| `fileFormat` | TEXT | PNG / JPG / WebP |
| `colorSpace` | TEXT | sRGB, Adobe RGB, etc. (if extractable) |
| `hasAlpha` | BOOLEAN | Whether image has transparency |

### Change Detection

- When `change` event fires, compare file mtime against last known mtime
- If changed: re-extract all metadata and update database
- Raw `metadataJson` is always the complete original data (never modified by LadyMuse)

## Layer 2: GalleryQueryService

Unified query entry point for all filtering, sorting, and pagination.

### Filter Dimensions

| Category | Filters |
|----------|---------|
| Generation params | Model name, LoRA name, sampler name, steps range, CFG range, seed |
| User marks | Rating range, color label, Pick/Reject flag, tags |
| Text search | Positive prompt (LIKE), negative prompt (LIKE) |
| Time | Date range |
| Folder | Directory path prefix |
| Collection | Collection ID (manual or smart) |
| Image properties | Resolution range, aspect ratio, file format, file size range, has alpha |

### Sorting Options

- Date (newest / oldest)
- Rating (highest / lowest)
- Filename (A-Z / Z-A)
- File size (largest / smallest)

### Pagination

- **Cursor-based** (keyset pagination) to avoid offset performance degradation at depth
- Default page size: 50 images, adjustable
- Returns total count for status bar display

### JSON Array Queries

Use SQLite `json_each()` for array column filtering:

```sql
SELECT * FROM image_attributes
WHERE EXISTS (
  SELECT 1 FROM json_each(extractedLoras)
  WHERE value = 'detail_enhancer.safetensors'
)
```

### Smart Collections

Smart collections store criteria as a JSON rules object. The query service evaluates rules at query time using the same filter system.

## Layer 3: Gallery Store

Single state tree using SvelteKit 5 runes.

### State Structure

| Field | Type | Purpose |
|-------|------|---------|
| `images` | Image[] | Currently visible images (paged query result) |
| `selectedPaths` | Set\<string\> | Selected image paths |
| `activeImage` | Image \| null | Focused image (shown in detail panel) |
| `filters` | FilterCriteria | Current filter state |
| `sortOrder` | SortOption | Current sort |
| `pagination` | { cursor, pageSize, total } | Pagination state |
| `viewMode` | 'library' \| 'inspect' \| 'compare' | Current view mode |
| `sidebarOpen` | boolean | Left sidebar visibility |

### Interaction Rules

- Filter change → reset pagination → re-query → update `images`
- SSE event → update `images` in-place (add/remove/replace)
- Mode switch → preserve filters and selection
- Selection: single-click (focus), Ctrl+click (multi-select), Shift+click (range), Ctrl+A (select all)

### Optimistic Updates

Rating, color label, flag, and tag changes update local state immediately. If server returns error, rollback and show notification.

## Layer 4: UI Components

### Three View Modes

Switched via top toolbar tabs (Library / Inspect / Compare) or keyboard shortcuts.

#### Library Mode

Three-column layout:

| Left Sidebar (200px) | Center Grid (flex) | Right Detail Panel (260px) |
|----------------------|--------------------|-----------------------------|
| Navigation tree: | Toolbar: | Thumbnail preview |
| - Folder browser | - Mode tabs | Filename + file info |
| - Smart collections | - Filter button | Rating (1-5 stars) |
| - Manual collections | - Search input | Color label picker |
| (+ button to add) | - Zoom slider | Pick/Reject buttons |
| | - Sort dropdown | Tag editor |
| | | Generation params |
| Grid: | | Prompt text |
| - Virtual scrolling | Status bar: | Tags |
| - Thumbnail with | - Total count | |
|   star/color/pick | - Selection count | "Send to ComfyUI" button |
|   overlays | | |

#### Inspect Mode

Large preview + filmstrip + detail panel:

| Main Area | Right Detail Panel (260px) |
|-----------|---------------------------|
| Large image preview (zoom: fit / 100%) | Same detail panel as Library |
| with zoom controls | |
| | |
| Filmstrip (56px height): | |
| Horizontal scrollable thumbnails | |
| Current image highlighted | |

#### Compare Mode

Adaptive layout based on image count:

**2 images**: Left detail | Image A | Image B | Right detail
- Each image gets its own detail panel
- Parameter differences highlighted in color

**3-4 images**: Center grid | Right detail panel
- Images arranged in grid layout
- Click an image to show its details in the right panel
- Selected image highlighted

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `G` | Switch to Library mode |
| `E` | Switch to Inspect mode |
| `C` | Switch to Compare mode |
| `←` `→` | Previous / next image |
| `Home` `End` | First / last image |
| `1`-`5` | Set rating |
| `0` | Clear rating |
| `P` | Mark as Pick |
| `X` | Mark as Reject |
| `U` | Clear flag |
| `Ctrl+A` | Select all |
| `Ctrl+Shift+A` | Deselect all |
| `Ctrl+I` | Invert selection |
| `Delete` | Delete selected |
| `F` | Toggle fullscreen |
| `+` `-` | Zoom in / out (grid thumbnails) |

### Batch Operations (Lightroom-style)

- Select multiple images → batch set rating, color label, flag, tags
- Filter by flag (e.g., show only Pick) → select all → add to collection
- Right-click context menu on selection with batch operations
- Bulk delete with confirmation dialog

### Virtual Scrolling

- Use IntersectionObserver-based approach for the grid
- Only render thumbnails currently in viewport + buffer
- Supports 1K-10K images without performance degradation
- Infinite scroll: auto-load next page when nearing bottom

## What We're Not Building

- Import/export functionality
- Image editing (that's ComfyUI's job)
- Multi-user / permission system
- External cloud storage sync

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| File watching | chokidar | Cross-platform reliable, all event types |
| Virtual scrolling | Custom IntersectionObserver | No mature Svelte library; medium scale doesn't need heavy solution |
| State management | SvelteKit 5 runes + custom store | Project already uses SvelteKit 5 |
| Param indexing | JSON columns + json_each() | Handles variable ComfyUI workflow structure without rigid schema |
| Pagination | Cursor-based | Avoids offset degradation at 10K scale |
