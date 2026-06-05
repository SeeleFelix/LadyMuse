import { untrack } from "svelte";
import { SvelteSet } from "svelte/reactivity";

// Client-side types (mirroring server types for gallery queries)
// These are duplicated from $lib/server/gallery-query-types.ts
// because SvelteKit does not allow importing from server modules in client code.

export interface ImageResult {
  relativePath: string;
  rating: number | null;
  colorLabel: string | null;
  flag: string | null;
  notes: string | null;
  stackId: number | null;
  width: number | null;
  height: number | null;
  aspectRatio: string | null;
  fileSize: number | null;
  fileFormat: string | null;
  hasAlpha: boolean | null;
  createdAt: string;
  updatedAt: string;
  fileModifiedAt: string | null;
  isMissing: boolean | null;
  extractedModels: string[];
  extractedLoras: string[];
  extractedSamplers: string[];
  extractedSchedulers: string[];
  steps: number | null;
  cfgScale: number | null;
  seed: string | null;
  positivePrompt: string | null;
  negativePrompt: string | null;
  tags: { id: number; name: string; slug: string }[];
  collectionIds: number[];
}

export type ViewMode = "library" | "inspect" | "compare";

export type SortField =
  | "created_at"
  | "modified_at"
  | "rating"
  | "filename"
  | "file_size"
  | "width"
  | "height";
export type SortDirection = "asc" | "desc";

export interface SortOption {
  field: SortField;
  direction: SortDirection;
}

export interface Cursor {
  field: SortField;
  value: string | number | null;
  direction: SortDirection;
  path: string;
}

export interface PaginationState {
  nextCursor: Cursor | null;
  prevCursor: Cursor | null;
  pageSize: number;
  total: number;
  hasMore: boolean;
  hasLess: boolean;
}

// Filter types matching server-side FilterCriteria
export interface GenerationParamsFilter {
  models?: string[];
  loras?: string[];
  samplers?: string[];
  schedulers?: string[];
  stepsMin?: number;
  stepsMax?: number;
  cfgMin?: number;
  cfgMax?: number;
  seed?: string;
}

export interface UserMarksFilter {
  ratingMin?: number;
  ratingMax?: number;
  colorLabels?: string[];
  flags?: string[];
  hasFlag?: boolean;
  tagIds?: number[];
  hasTags?: boolean;
  notesContains?: string;
}

export interface TextSearchFilter {
  positivePrompt?: string;
  negativePrompt?: string;
}

export interface TimeFilter {
  createdAfter?: string;
  createdBefore?: string;
  modifiedAfter?: string;
  modifiedBefore?: string;
}

export interface FolderFilter {
  pathPrefix?: string;
  excludePaths?: string[];
}

export interface CollectionFilter {
  collectionId?: number;
}

export interface ImagePropertiesFilter {
  widthMin?: number;
  widthMax?: number;
  heightMin?: number;
  heightMax?: number;
  aspectRatios?: ("portrait" | "landscape" | "square")[];
  fileFormats?: ("PNG" | "JPG" | "WebP")[];
  fileSizeMin?: number;
  fileSizeMax?: number;
  hasAlpha?: boolean;
  isMissing?: boolean;
}

export interface FilterCriteria {
  generation?: GenerationParamsFilter;
  user?: UserMarksFilter;
  text?: TextSearchFilter;
  time?: TimeFilter;
  folder?: FolderFilter;
  collection?: CollectionFilter;
  properties?: ImagePropertiesFilter;
}

export interface FileEvent {
  type: "add" | "delete" | "modify";
  path: string;
}

// API response type for queries
export interface QueryResult {
  images: ImageResult[];
  total: number;
  pageSize: number;
  hasMore: boolean;
  hasLess: boolean;
  nextCursor: Cursor | null;
  prevCursor: Cursor | null;
}

// Selection anchor state for range selections
interface SelectionState {
  anchorPath: string | null;
  anchorIndex: number;
}

export function createGalleryStore(api: {
  query: (
    filters: FilterCriteria,
    sort: SortOption,
    pagination: {
      pageSize: number;
      cursor?: Cursor | null;
      direction?: "next" | "prev";
    },
  ) => Promise<QueryResult>;
  updateAttributes: (
    path: string,
    updates: Record<string, unknown>,
  ) => Promise<void>;
}) {
  // Core reactive state
  let images = $state<ImageResult[]>([]);
  let selectedPaths = $state<Set<string>>(new SvelteSet());
  let activeImage = $state<ImageResult | null>(null);
  let filters = $state<FilterCriteria>({});
  let sortOrder = $state<SortOption>({
    field: "modified_at",
    direction: "desc",
  });
  let pagination = $state<PaginationState>({
    nextCursor: null,
    prevCursor: null,
    pageSize: 50,
    total: 0,
    hasMore: false,
    hasLess: false,
  });
  let viewMode = $state<ViewMode>("library");
  let sidebarOpen = $state(true);
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Selection anchor state (non-reactive)
  let selectionState: SelectionState = { anchorPath: null, anchorIndex: -1 };

  // Derived state
  let selectedCount = $derived(selectedPaths.size);
  let hasSelection = $derived(selectedPaths.size > 0);
  let activeImageUrl = $derived(
    activeImage
      ? `/api/comfyui/images/${encodeURIComponent(activeImage.relativePath)}`
      : null,
  );

  /**
   * Load a page of images with optional pagination direction
   */
  async function loadPage(direction?: "next" | "prev") {
    loading = true;
    error = null;
    try {
      let cursor: Cursor | null = null;
      if (direction === "next") {
        cursor = pagination.nextCursor;
      } else if (direction === "prev") {
        cursor = pagination.prevCursor;
      }

      const result = await api.query(filters, sortOrder, {
        pageSize: pagination.pageSize,
        cursor,
        direction,
      });

      // Append for infinite scroll, prepend for going back, replace for first load
      if (direction === "next") {
        images = [...images, ...result.images];
      } else if (direction === "prev") {
        images = [...result.images, ...images];
      } else {
        images = result.images;
      }

      pagination = {
        nextCursor: result.nextCursor,
        prevCursor: result.prevCursor,
        pageSize: result.pageSize,
        total: result.total,
        hasMore: result.hasMore,
        hasLess: result.hasLess,
      };
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  /**
   * Update filter criteria and reload the first page
   */
  function setFilters(newFilters: FilterCriteria) {
    filters = newFilters;
    pagination = {
      nextCursor: null,
      prevCursor: null,
      pageSize: pagination.pageSize,
      total: 0,
      hasMore: false,
      hasLess: false,
    };
    selectedPaths.clear();
    activeImage = null;
    selectionState = { anchorPath: null, anchorIndex: -1 };
    loadPage();
  }

  /**
   * Update sort order and reload the first page
   */
  function setSort(sort: SortOption) {
    sortOrder = sort;
    pagination = {
      nextCursor: null,
      prevCursor: null,
      pageSize: pagination.pageSize,
      total: 0,
      hasMore: false,
      hasLess: false,
    };
    loadPage();
  }

  /**
   * Select an image with support for multi-select and range selection
   */
  function select(path: string, multi = false, range = false) {
    const currentIndex = images.findIndex((img) => img.relativePath === path);

    if (
      range &&
      multi &&
      selectionState.anchorIndex >= 0 &&
      currentIndex >= 0
    ) {
      // Range selection: select all images between anchor and current
      const start = Math.min(selectionState.anchorIndex, currentIndex);
      const end = Math.max(selectionState.anchorIndex, currentIndex);
      selectedPaths.clear();
      for (let i = start; i <= end; i++) {
        selectedPaths.add(images[i].relativePath);
      }
    } else if (multi) {
      // Toggle selection for multi-select without modifier
      if (selectedPaths.has(path)) {
        selectedPaths.delete(path);
        if (selectionState.anchorPath === path) {
          selectionState.anchorPath = null;
          selectionState.anchorIndex = -1;
        }
      } else {
        selectedPaths.add(path);
        selectionState.anchorPath = path;
        selectionState.anchorIndex = currentIndex;
      }
    } else {
      // Single selection
      selectedPaths.clear();
      selectedPaths.add(path);
      selectionState.anchorPath = path;
      selectionState.anchorIndex = currentIndex >= 0 ? currentIndex : -1;
    }

    // Update active image
    activeImage = images.find((img) => img.relativePath === path) ?? null;
  }

  /**
   * Select all images in the current page
   */
  function selectAll() {
    for (const img of images) {
      selectedPaths.add(img.relativePath);
    }
    if (images.length > 0) {
      selectionState.anchorPath = images[0].relativePath;
      selectionState.anchorIndex = 0;
    }
  }

  /**
   * Clear all selections
   */
  function deselectAll() {
    selectedPaths.clear();
    activeImage = null;
    selectionState = { anchorPath: null, anchorIndex: -1 };
  }

  /**
   * Invert the current selection
   */
  function invertSelection() {
    const newSet = new Set<string>();
    let firstSelectedPath: string | null = null;
    let firstSelectedIndex = -1;

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (!selectedPaths.has(img.relativePath)) {
        newSet.add(img.relativePath);
        if (firstSelectedPath === null) {
          firstSelectedPath = img.relativePath;
          firstSelectedIndex = i;
        }
      }
    }

    selectedPaths = newSet;
    selectionState.anchorPath = firstSelectedPath;
    selectionState.anchorIndex = firstSelectedIndex;
  }

  /**
   * Change the current view mode
   */
  function setViewMode(mode: ViewMode) {
    viewMode = mode;
  }

  /**
   * Refresh the current page
   */
  function refresh() {
    loadPage();
  }

  /**
   * Handle server-sent events for file changes
   */
  function handleSSEEvent(event: FileEvent) {
    if (event.type === "add") {
      // Reload to include new image
      untrack(() => loadPage());
    } else if (event.type === "delete") {
      images = images.filter((img) => img.relativePath !== event.path);
      selectedPaths.delete(event.path);
      if (activeImage?.relativePath === event.path) {
        activeImage = images[0] ?? null;
      }
      pagination.total = Math.max(0, pagination.total - 1);
    } else if (event.type === "modify") {
      const idx = images.findIndex((img) => img.relativePath === event.path);
      if (idx >= 0) {
        // Refresh to get updated metadata
        untrack(() => loadPage());
      }
    }
  }

  /**
   * Update image attributes with optimistic update
   */
  async function updateAttributes(
    path: string,
    updates: Record<string, unknown>,
  ) {
    // Optimistic update
    const idx = images.findIndex((img) => img.relativePath === path);
    if (idx >= 0) {
      const img = images[idx];
      images[idx] = { ...img, ...updates } as ImageResult;
    }
    if (activeImage?.relativePath === path) {
      activeImage = { ...activeImage, ...updates } as ImageResult;
    }
    try {
      await api.updateAttributes(path, updates);
    } catch {
      // Rollback on error
      untrack(() => loadPage());
    }
  }

  return {
    // State getters
    get images() {
      return images;
    },
    get selectedPaths() {
      return selectedPaths;
    },
    get activeImage() {
      return activeImage;
    },
    get filters() {
      return filters;
    },
    get sortOrder() {
      return sortOrder;
    },
    get pagination() {
      return pagination;
    },
    get viewMode() {
      return viewMode;
    },
    get sidebarOpen() {
      return sidebarOpen;
    },
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },
    get selectedCount() {
      return selectedCount;
    },
    get hasSelection() {
      return hasSelection;
    },
    get activeImageUrl() {
      return activeImageUrl;
    },

    // State setters
    set sidebarOpen(value: boolean) {
      sidebarOpen = value;
    },

    // Actions
    setFilters,
    setSort,
    select,
    selectAll,
    deselectAll,
    invertSelection,
    setViewMode,
    loadPage,
    refresh,
    handleSSEEvent,
    updateAttributes,
  };
}

// Type export for the store instance
export type GalleryStore = ReturnType<typeof createGalleryStore>;
