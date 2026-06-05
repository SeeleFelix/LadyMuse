// Filter dimensions
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

// Combined filter criteria
export interface FilterCriteria {
  generation?: GenerationParamsFilter;
  user?: UserMarksFilter;
  text?: TextSearchFilter;
  time?: TimeFilter;
  folder?: FolderFilter;
  collection?: CollectionFilter;
  properties?: ImagePropertiesFilter;
}

// Sort options
export type SortField =
  | "created_at"
  | "updated_at"
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

// Cursor-based pagination
export interface Cursor {
  field: SortField;
  value: string | number | null;
  direction: SortDirection;
  path: string;
}

export interface PaginationOptions {
  pageSize?: number;
  cursor?: Cursor;
  direction?: "next" | "prev";
}

// Query result
export interface QueryResult {
  images: ImageResult[];
  total: number;
  pageSize: number;
  hasMore: boolean;
  hasLess: boolean;
  nextCursor: Cursor | null;
  prevCursor: Cursor | null;
}

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
  createdAt: string | null;
  updatedAt: string | null;
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
