# Gallery Redesign — Plan 4: UI Components

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the gallery UI with three view modes (Library, Inspect, Compare), virtual scrolling for 1K-10K image scale, keyboard shortcuts, batch operations, and SSE real-time updates. Replace the current `/generations` page with a SvelteKit 5 runes-based gallery store and modular components.

**Architecture:**
1. **GalleryStore** (`src/lib/stores/gallery-store.ts`): Central state using SvelteKit 5 runes (`$state`, `$derived`)
2. **API Integration** (`src/lib/services/gallery-api.ts`): Client-side service wrapping the query SSE APIs
3. **View Components**: Library mode, Inspect mode, Compare mode
4. **Shared Components**: Thumbnail grid with virtual scrolling, detail panel, filter panel
5. **Keyboard Shortcuts**: Global keyboard handler
6. **SSE Client**: Real-time updates from FileSyncService

**Tech Stack:** SvelteKit 5 (runes), TailwindCSS, TypeScript, IntersectionObserver (virtual scrolling), SSE

**Depends on:** Plan 1 (schema + metadata extraction), Plan 2 (FileSyncService), Plan 3 (GalleryQueryService)

**Enables:** Full Lightroom-style gallery experience

---

## Layer 3: Gallery Store

First, implement the central state management layer using SvelteKit 5 runes. This store will be the single source of truth for all gallery state.

### Task 1: Create GalleryStore with runes

**Files:**
- Create: `src/lib/stores/gallery-store.ts`

The GalleryStore uses SvelteKit 5 runes for reactive state management. It must:

1. **State fields** (using `$state`):
   - `images: ImageResult[]` — Currently visible images (paged query result)
   - `selectedPaths: Set<string>` — Selected image paths
   - `activeImage: ImageResult | null` — Currently focused image
   - `filters: FilterCriteria` — Current filter state
   - `sortOrder: SortOption` — Current sort
   - `pagination: PaginationState` — `{ cursor, pageSize, total, hasMore, hasLess }`
   - `viewMode: ViewMode` — `'library' | 'inspect' | 'compare'`
   - `sidebarOpen: boolean` — Left sidebar visibility
   - `loading: boolean` — Loading state
   - `error: string | null` — Error message

2. **Derived state** (using `$derived`):
   - `selectedCount` — Number of selected images
   - `hasSelection` — Whether any images are selected
   - `activeImageUrl` — URL for active image

3. **Actions**:
   - `setFilters(filters: FilterCriteria)` — Update filters and reset pagination
   - `setSort(sort: SortOption)` — Update sort and re-query
   - `select(path: string, multi: boolean, range: boolean, startIndex: number)` — Selection logic
   - `selectAll()` — Select all visible images
   - `deselectAll()` — Clear selection
   - `invertSelection()` — Invert selection
   - `setViewMode(mode: ViewMode)` — Switch view mode
   - `loadPage(direction?: 'next' | 'prev')` — Load next/prev page
   - `refresh()` — Reload current page
   - `handleSSEEvent(event: FileEvent)` — Process SSE add/delete/modify events
   - `updateAttributes(path: string, updates: Partial<AttributeUpdates>)` — Optimistic attribute updates

**Types:** Reuse from `gallery-query-types.ts`:
```typescript
import type {
  FilterCriteria,
  SortOption,
  ImageResult,
  Cursor
} from "$lib/server/gallery-query-types";

export interface PaginationState {
  cursor: Cursor | null;
  pageSize: number;
  total: number;
  hasMore: boolean;
  hasLess: boolean;
}

export type ViewMode = "library" | "inspect" | "compare";

export interface AttributeUpdates {
  rating?: number;
  colorLabel?: string | null;
  flag?: string | null;
  notes?: string;
}
```

**Store pattern:**
```typescript
import { untrack } from "svelte";

export function createGalleryStore() {
  let images = $state<ImageResult[]>([]);
  let selectedPaths = $state<Set<string>>(new Set());
  let activeImage = $state<ImageResult | null>(null);
  // ... other state

  // Actions
  function setFilters(filters: FilterCriteria) {
    // Use untrack to avoid reactive loops
    untrack(() => {
      _filters = filters;
      _pagination = { cursor: null, pageSize: 50, total: 0, hasMore: false, hasLess: false };
    });
    loadPage();
  }

  return {
    get images() { return images; },
    get selectedPaths() { return selectedPaths; },
    // ... expose state and actions
  };
}
```

- [ ] **Step 1: Create the gallery store**

- [ ] **Step 2: Commit**

```bash
git add src/lib/stores/gallery-store.ts
git commit -m "feat: create GalleryStore with SvelteKit 5 runes"
```

---

### Task 2: Create GalleryAPI service

**Files:**
- Create: `src/lib/services/gallery-api.ts`

Client-side service that wraps the gallery API endpoints:

1. **query(filters, sort, pagination)** — POST to `/api/comfyui/query`, returns QueryResult
2. **updateAttributes(path, updates)** — PUT to `/api/comfyui/attributes`
3. **addTags(path, tagNames)** — POST to `/api/comfyui/tags`
4. **removeTags(path, tagIds)** — DELETE to `/api/comfyui/tags`
5. **deleteImages(paths)** — POST to `/api/comfyui/delete`
6. **getCollections()** — GET `/api/comfyui/collections`
7. **addToCollection(collectionId, paths)** — POST to `/api/comfyui/collections/{id}/images`
8. **subscribeSSE(callback)** — SSE subscription to `/api/comfyui/watch`

**Error handling:**
- Wrap fetch calls in try/catch
- Return typed results with error field
- Handle network errors gracefully

**Implementation:**
```typescript
import type { FilterCriteria, SortOption, PaginationOptions, QueryResult, ImageResult } from "$lib/server/gallery-query-types";

interface ApiResult<T> {
  data: T | null;
  error: string | null;
}

export class GalleryAPI {
  private baseUrl = '/api/comfyui';

  async query(
    filters: FilterCriteria,
    sort: SortOption,
    pagination: PaginationOptions
  ): Promise<ApiResult<QueryResult>> {
    try {
      const res = await fetch(`${this.baseUrl}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters, sort, pagination })
      });
      if (!res.ok) {
        return { data: null, error: await res.text() };
      }
      const data = await res.json();
      return { data, error: null };
    } catch (e) {
      return { data: null, error: (e as Error).message };
    }
  }

  // ... other methods
}

export const galleryAPI = new GalleryAPI();
```

- [ ] **Step 1: Create the API service**

- [ ] **Step 2: Create query endpoint**

Create: `src/routes/api/comfyui/query/+server.ts`
```typescript
import { galleryQueryService } from "$lib/server/gallery-query-service";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  const { filters, sort, pagination } = await request.json();
  const result = await galleryQueryService.query(filters, sort, pagination);
  return json(result);
};
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/gallery-api.ts src/routes/api/comfyui/query/+server.ts
git commit -m "feat: create GalleryAPI service and query endpoint"
```

---

## Layer 4: UI Components

### Task 3: Create shared components

#### Task 3.1: ThumbnailCard component

**Files:**
- Create: `src/lib/components/gallery/ThumbnailCard.svelte`

Individual thumbnail component with overlays for:
- Selection checkbox
- Star rating
- Color label indicator
- Pick/Reject flag
- Missing file indicator

**Props:**
```typescript
interface Props {
  image: ImageResult;
  selected: boolean;
  active: boolean;
  onSelect: (path: string, e: MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (path: string, e: MouseEvent) => void;
}
```

**Features:**
- Lazy-loaded image with placeholder
- Responsive aspect ratio
- Keyboard focusable
- Accessible labels

- [ ] **Step 1: Create ThumbnailCard component**

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/ThumbnailCard.svelte
git commit -m "feat: create ThumbnailCard component"
```

---

#### Task 3.2: VirtualGrid component

**Files:**
- Create: `src/lib/components/gallery/VirtualGrid.svelte`

Grid with IntersectionObserver-based virtual scrolling for 1K-10K images.

**Props:**
```typescript
interface Props {
  images: ImageResult[];
  selectedPaths: Set<string>;
  activePath: string | null;
  onSelect: (path: string, e: MouseEvent) => void;
  onDoubleClick: (path: string) => void;
  onContextMenu: (path: string, e: MouseEvent) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  loadingMore: boolean;
}
```

**Implementation:**
- Render all images in grid (let browser handle DOM)
- Use IntersectionObserver on sentinel at bottom
- Trigger `onLoadMore` when sentinel approaches viewport
- Show loading indicator at bottom

**Why full DOM rather than true virtual scrolling:**
- At 1K-10K scale, modern browsers handle ~10K DOM nodes fine
- Simpler implementation
- Better accessibility (screen readers see all items)
- Still get performance from lazy-loaded images

- [ ] **Step 1: Create VirtualGrid component**

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/VirtualGrid.svelte
git commit -m "feat: create VirtualGrid with IntersectionObserver"
```

---

#### Task 3.3: GalleryToolbar component

**Files:**
- Create: `src/lib/components/gallery/GalleryToolbar.svelte`

Top toolbar with:
- View mode tabs (Library / Inspect / Compare)
- Search input
- Filter toggle button
- Sort dropdown
- Zoom slider (thumbnail size)
- Refresh button

**Props:**
```typescript
interface Props {
  viewMode: ViewMode;
  searchQuery: string;
  sortOption: SortOption;
  totalImages: number;
  onViewModeChange: (mode: ViewMode) => void;
  onSearchChange: (query: string) => void;
  onSortChange: (sort: SortOption) => void;
  onRefresh: () => void;
  onToggleFilters: () => void;
}
```

- [ ] **Step 1: Create GalleryToolbar component**

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/GalleryToolbar.svelte
git commit -m "feat: create GalleryToolbar component"
```

---

#### Task 3.4: FilterPanel component

**Files:**
- Create: `src/lib/components/gallery/FilterPanel.svelte`

Left sidebar panel with all filter dimensions:
- Generation params (model, LoRA, sampler, steps, CFG, seed)
- User marks (rating, color labels, flags, tags)
- Text search (positive/negative prompt)
- Time range (created/modified dates)
- Folder path
- Collection
- Image properties (resolution, aspect ratio, format, file size, alpha)

**Props:**
```typescript
interface Props {
  filters: FilterCriteria;
  open: boolean;
  onFiltersChange: (filters: FilterCriteria) => void;
  onClose: () => void;
}
```

**Features:**
- Collapsible sections for each filter dimension
- Multi-select for arrays (models, LoRAs, tags)
- Range sliders for numeric values (steps, CFG, dimensions)
- Date pickers for time ranges
- Clear all filters button
- Filter count badge

**Note:** For MVP, can start with simplified filters and expand incrementally.

- [ ] **Step 1: Create FilterPanel component**

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/FilterPanel.svelte
git commit -m "feat: create FilterPanel component"
```

---

#### Task 3.5: DetailPanel component

**Files:**
- Create: `src/lib/components/gallery/DetailPanel.svelte`

Right panel showing image details (refactor existing GalleryDetail.svelte):
- Thumbnail preview with zoom
- File info (name, size, dimensions, format, modified date)
- Rating (1-5 stars)
- Color label picker
- Pick/Reject buttons
- Tag editor
- Generation params (model, LoRA, sampler, steps, CFG, seed)
- Prompt text (positive/negative)
- "Send to ComfyUI" button

**Props:**
```typescript
interface Props {
  image: ImageResult | null;
  onRate: (rating: number) => void;
  onColor: (color: string | null) => void;
  onFlag: (flag: string | null) => void;
  onAddTag: (tagName: string) => void;
  onRemoveTag: (tagId: number) => void;
  onClose: () => void;
}
```

**Note:** Reuse existing components (StarRating, ColorLabel, FlagButtons, TagEditor, MetadataViewer).

- [ ] **Step 1: Create/refactor DetailPanel component**

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/DetailPanel.svelte
git commit -m "feat: create DetailPanel component"
```

---

#### Task 3.6: StatusBar component

**Files:**
- Create: `src/lib/components/gallery/StatusBar.svelte`

Bottom status bar showing:
- Total image count
- Selected count
- Current filter summary (if filtered)
- View mode indicator

**Props:**
```typescript
interface Props {
  totalImages: number;
  selectedCount: number;
  filteredCount: number;
  viewMode: ViewMode;
}
```

- [ ] **Step 1: Create StatusBar component**

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/StatusBar.svelte
git commit -m "feat: create StatusBar component"
```

---

### Task 4: Create View Mode Components

#### Task 4.1: LibraryView component

**Files:**
- Create: `src/lib/components/gallery/LibraryView.svelte`

Three-column layout:
- Left: FilterPanel (200px, collapsible)
- Center: VirtualGrid (flex)
- Right: DetailPanel (260px, collapsible when no selection)

**Props:**
```typescript
interface Props {
  store: ReturnType<typeof createGalleryStore>;
}
```

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                              Toolbar                                  │
├──────────┬───────────────────────────────────────────────┬──────────┤
│          │                                               │          │
│  Filter  │              VirtualGrid                      │  Detail   │
│  Panel   │                                               │  Panel   │
│          │                                               │          │
└──────────┴───────────────────────────────────────────────┴──────────┘
│                              Status                                  │
└─────────────────────────────────────────────────────────────────────┘
```

- [ ] **Step 1: Create LibraryView component**

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/LibraryView.svelte
git commit -m "feat: create LibraryView component with three-column layout"
```

---

#### Task 4.2: InspectView component

**Files:**
- Create: `src/lib/components/gallery/InspectView.svelte`

Large preview + filmstrip + detail panel:
- Main area: Large image preview with zoom controls (fit/100%)
- Bottom: Filmstrip (56px height) with horizontal scrollable thumbnails
- Right: Same detail panel as Library mode

**Props:**
```typescript
interface Props {
  store: ReturnType<typeof createGalleryStore>;
}
```

**Features:**
- Zoom controls (fit to screen, 100%, zoom in/out)
- Pan on drag when zoomed
- Keyboard navigation (left/right arrows)
- Filmstrip shows all images with current image highlighted
- Click filmstrip thumbnail to jump to that image

**Layout:**
```
┌─────────────────────────────────────────┬──────────┐
│                                         │          │
│                                         │          │
│          Large Preview                  │  Detail  │
│          (zoom/pan)                     │  Panel   │
│                                         │          │
│                                         │          │
├─────────────────────────────────────────┴──────────┤
│              Filmstrip (56px)                         │
└─────────────────────────────────────────────────────┘
```

- [ ] **Step 1: Create InspectView component**

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/InspectView.svelte
git commit -m "feat: create InspectView with large preview and filmstrip"
```

---

#### Task 4.3: CompareView component

**Files:**
- Create: `src/lib/components/gallery/CompareView.svelte` (refactor existing)

Adaptive layout based on selection count:

**2 images:**
```
┌──────┬─────────┬─────────┬──────┐
│ DetA │  ImageA │  ImageB │ DetB │
│      │         │         │      │
└──────┴─────────┴─────────┴──────┘
```
- Each image gets its own detail panel
- Parameter differences highlighted

**3-4 images:**
```
┌─────────────────┬──────────┐
│   Grid (2x2)    │  Detail  │
│                 │  Panel   │
└─────────────────┴──────────┘
```
- Images in center grid
- Click to show details in right panel

**Props:**
```typescript
interface Props {
  store: ReturnType<typeof createGalleryStore>;
  onClose: () => void;
}
```

**Features:**
- Adaptive layout based on image count
- Side-by-side parameter comparison
- Highlight differences in color
- Synchronized zoom (when zoomed)

- [ ] **Step 1: Refactor CompareView component**

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/CompareView.svelte
git commit -m "feat: refactor CompareView with adaptive layout"
```

---

### Task 5: Create Keyboard Shortcuts

**Files:**
- Create: `src/lib/components/gallery/KeyboardShortcuts.svelte`

Global keyboard handler using `<svelte:window>`:

**Shortcuts:**
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
| `Escape` | Close modal / deselect |

**Props:**
```typescript
interface Props {
  store: ReturnType<typeof createGalleryStore>;
  disabled?: boolean; // Disable when in input fields
}
```

**Implementation:**
```svelte
<script>
  let { store, disabled = false }: Props = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (disabled) return;
    // Ignore when typing in inputs
    if ((e.target as HTMLElement).tagName === 'INPUT' || 
        (e.target as HTMLElement).tagName === 'TEXTAREA') {
      if (e.key !== 'Escape') return;
    }

    switch (e.key) {
      case 'g':
      case 'G':
        store.setViewMode('library');
        break;
      // ... more shortcuts
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />
```

- [ ] **Step 1: Create KeyboardShortcuts component**

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/KeyboardShortcuts.svelte
git commit -m "feat: create KeyboardShortcuts component"
```

---

### Task 6: Create Batch Operations

**Files:**
- Create: `src/lib/components/gallery/BatchActionsBar.svelte`

Floating bar that appears when multiple images are selected:
- Rating buttons (1-5 stars)
- Color label buttons
- Pick/Reject buttons
- Add to collection dropdown
- Delete button
- Deselect button

**Props:**
```typescript
interface Props {
  selectedCount: number;
  onRate: (rating: number) => void;
  onColor: (color: string) => void;
  onFlag: (flag: string) => void;
  onAddToCollection: (collectionId: number) => void;
  onDelete: () => void;
  onDeselect: () => void;
  collections: Collection[];
}
```

**Features:**
- Only shows when `selectedCount > 1`
- Optimistic updates (show success immediately, rollback on error)
- Confirmation dialog for delete

- [ ] **Step 1: Create BatchActionsBar component**

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/BatchActionsBar.svelte
git commit -m "feat: create BatchActionsBar component"
```

---

### Task 7: Create SSE Client

**Files:**
- Create: `src/lib/services/sse-client.ts`

Client-side SSE handler for real-time updates:

```typescript
import type { FileEvent } from "$lib/server/file-sync-service";

export type SSECallback = (event: FileEvent) => void;

export function createSSEClient(callback: SSECallback) {
  let eventSource: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    eventSource = new EventSource('/api/comfyui/watch');

    eventSource.onmessage = (e) => {
      try {
        const event: FileEvent = JSON.parse(e.data);
        callback(event);
      } catch (err) {
        console.error('[SSE] Parse error:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource?.close();
      reconnectTimer = setTimeout(connect, 5000);
    };
  }

  function disconnect() {
    eventSource?.close();
    if (reconnectTimer) clearTimeout(reconnectTimer);
  }

  connect();

  return { disconnect };
}
```

- [ ] **Step 1: Create SSE client**

- [ ] **Step 2: Commit**

```bash
git add src/lib/services/sse-client.ts
git commit -m "feat: create SSE client for real-time updates"
```

---

### Task 8: Create Main Gallery Page

**Files:**
- Modify: `src/routes/generations/+page.svelte`

Main page that orchestrates all components:

**Structure:**
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { createGalleryStore } from '$lib/stores/gallery-store';
  import { createSSEClient } from '$lib/services/sse-client';
  import LibraryView from '$lib/components/gallery/LibraryView.svelte';
  import InspectView from '$lib/components/gallery/InspectView.svelte';
  import CompareView from '$lib/components/gallery/CompareView.svelte';
  import KeyboardShortcuts from '$lib/components/gallery/KeyboardShortcuts.svelte';

  const store = createGalleryStore();

  onMount(() => {
    // Initial load
    store.refresh();

    // SSE for real-time updates
    const { disconnect } = createSSEClient((event) => {
      store.handleSSEEvent(event);
    });

    return () => disconnect();
  });
</script>

{#if store.viewMode === 'library'}
  <LibraryView {store} />
{:else if store.viewMode === 'inspect'}
  <InspectView {store} />
{:else if store.viewMode === 'compare'}
  <CompareView {store} />
{/if}

<KeyboardShortcuts {store} />
```

- [ ] **Step 1: Update main gallery page**

- [ ] **Step 2: Test in browser**

```bash
npm run dev
# Navigate to /generations
# Verify:
# - Images load
# - View mode switching works
# - Keyboard shortcuts work
# - Real-time updates work (add new image via ComfyUI)
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/generations/+page.svelte
git commit -m "feat: update main gallery page with new components"
```

---

## Task 9: Create Confirmation Dialogs

**Files:**
- Create: `src/lib/components/gallery/ConfirmDialog.svelte` (or refactor existing)

Generic confirmation dialog for destructive actions:
- Delete images
- Overwrite existing data
- Cancel pending operations

**Props:**
```typescript
interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}
```

- [ ] **Step 1: Create/refactor ConfirmDialog component**

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/ConfirmDialog.svelte
git commit -m "feat: create ConfirmDialog component"
```

---

## Task 10: Create Context Menu

**Files:**
- Create: `src/lib/components/gallery/ContextMenu.svelte` (refactor existing)

Right-click context menu on images:
- Open in lightbox
- Set rating (1-5)
- Set color label
- Set flag (Pick/Reject/Clear)
- Add to collection
- Copy prompt
- Copy image URL
- Compare
- Delete

**Props:**
```typescript
interface Props {
  open: boolean;
  x: number;
  y: number;
  image: ImageResult | null;
  selectedCount: number;
  onClose: () => void;
  actions: {
    onOpenLightbox: () => void;
    onRate: (rating: number) => void;
    onColor: (color: string) => void;
    onFlag: (flag: string) => void;
    onAddToCollection: (collectionId: number) => void;
    onCopyPrompt: () => void;
    onCopyImageUrl: () => void;
    onCompare: () => void;
    onDelete: () => void;
  };
  collections: Collection[];
}
```

- [ ] **Step 1: Refactor ContextMenu component**

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/ContextMenu.svelte
git commit -m "feat: refactor ContextMenu component"
```

---

## Task 11: Optimize Performance

### Task 11.1: Image lazy loading

**Files:**
- Modify: `src/lib/components/gallery/ThumbnailCard.svelte`

Add native lazy loading with fallback:
```svelte
<img
  src={imageUrl}
  loading="lazy"
  decoding="async"
  alt=""
  class="thumbnail"
  onerror={(e) => {
    // Show placeholder on error
    (e.target as HTMLImageElement).src = '/placeholder.png';
  }}
/>
```

- [ ] **Step 1: Add lazy loading to thumbnails**

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/gallery/ThumbnailCard.svelte
git commit -m "perf: add lazy loading to thumbnail images"
```

---

### Task 11.2: Optimize re-renders

**Files:**
- Multiple component files

Review all components for unnecessary re-renders:
- Use `$derived` for computed values
- Use `$effect` instead of `$:` for fine-grained reactivity
- Avoid creating new functions in render loops

- [ ] **Step 1: Review and optimize reactivity**

- [ ] **Step 2: Commit**

```bash
git add -A src/lib/components/gallery/
git commit -m "perf: optimize component reactivity"
```

---

## Task 12: Add Tests

**Files:**
- Create: `src/lib/stores/__tests__/gallery-store.test.ts`
- Create: `src/lib/services/__tests__/gallery-api.test.ts`

Test critical paths:
- Store state updates
- Filter/sort changes trigger re-query
- Selection logic (single, multi, range)
- SSE event handling
- API error handling

- [ ] **Step 1: Write store tests**

- [ ] **Step 2: Write API service tests**

- [ ] **Step 3: Run tests**

```bash
npx vitest run --reporter=verbose
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/stores/__tests__/ src/lib/services/__tests__/
git commit -m "test: add gallery store and API tests"
```

---

## Task 13: Final Integration

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run --reporter=verbose
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
npm run preview
```

- [ ] **Step 3: Manual testing checklist**

Test all functionality:
- [ ] Library mode loads images
- [ ] Inspect mode shows large preview
- [ ] Compare mode works with 2-4 images
- [ ] View mode switching preserves state
- [ ] Filters apply correctly
- [ ] Sort options work
- [ ] Pagination loads next/prev pages
- [ ] Selection (click, ctrl+click, shift+click) works
- [ ] Batch operations update multiple images
- [ ] Keyboard shortcuts work
- [ ] Context menu appears and works
- [ ] Real-time SSE updates work
- [ ] Delete removes images and updates UI
- [ ] Tagging adds/removes tags
- [ ] Collections filter correctly
- [ ] Status bar shows correct counts
- [ ] Missing files show dimmed
- [ ] Error states show messages

- [ ] **Step 4: Fix any issues**

```bash
git add -A
git commit -m "fix: integration fixes for gallery UI"
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Plan 4 gallery UI components"
```

---

## Summary

This plan implements the UI layer for the gallery redesign:

1. **GalleryStore** — Central state with SvelteKit 5 runes
2. **GalleryAPI** — Client-side API service
3. **Shared components** — ThumbnailCard, VirtualGrid, Toolbar, FilterPanel, DetailPanel, StatusBar
4. **View modes** — Library, Inspect, Compare
5. **Interactions** — Keyboard shortcuts, batch operations, context menu
6. **Real-time** — SSE client for live updates
7. **Performance** — Lazy loading, optimized reactivity

Each task produces working UI that can be verified incrementally.
