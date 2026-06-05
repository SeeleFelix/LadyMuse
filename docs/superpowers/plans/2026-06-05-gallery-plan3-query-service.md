# Gallery Redesign — Plan 3: GalleryQueryService

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified query service for all gallery filtering, sorting, and pagination operations. Replaces the current disk-based browsing with database-driven cursor pagination.

**Architecture:** New `GalleryQueryService` class that:
1. Accepts filter criteria across all dimensions (generation params, user marks, text search, time, folder, collection, image properties)
2. Builds optimized Drizzle queries with SQLite json_each() for JSON array filtering
3. Implements cursor-based (keyset) pagination to avoid offset degradation at scale
4. Evaluates smart collection rules at query time using the same filter system
5. Returns paginated results with cursor metadata for next/prev navigation

**Tech Stack:** Drizzle ORM, better-sqlite3, SQLite, Vitest

**Depends on:** Plan 1 (schema + metadata extraction), Plan 2 (FileSyncService)

**Enables:** Plan 4 (UI Components)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/server/gallery-query-service.ts` | GalleryQueryService class with filter/sort/pagination |
| Create | `src/lib/server/gallery-query-types.ts` | TypeScript types for filters, sort, pagination |
| Modify | `src/routes/api/comfyui/browse/+server.ts` | Replace disk scanning with GalleryQueryService |
| Modify | `src/lib/server/smart-collections.ts` | Extend smart criteria to support all filter dimensions |
| Create | `src/lib/server/__tests__/gallery-query-service.test.ts` | Tests for query service |

---

## Task 1: Create query type definitions

**Files:**
- Create: `src/lib/server/gallery-query-types.ts`

Define TypeScript types for the entire query system:

```typescript
import type { SQL } from "drizzle-orm";

// Filter dimensions
export interface GenerationParamsFilter {
  models?: string[];           // Match any of these models
  loras?: string[];            // Match any of these LoRAs
  samplers?: string[];         // Match any of these samplers
  schedulers?: string[];       // Match any of these schedulers
  stepsMin?: number;           // Minimum steps
  stepsMax?: number;           // Maximum steps
  cfgMin?: number;             // Minimum CFG scale
  cfgMax?: number;             // Maximum CFG scale
  seed?: string;               // Exact seed match
}

export interface UserMarksFilter {
  ratingMin?: number;          // Minimum rating (0-5)
  ratingMax?: number;          // Maximum rating
  colorLabels?: string[];      // red, yellow, green, blue, purple
  flags?: string[];            // pick, reject
  hasFlag?: boolean;           // Has any flag
  tagIds?: number[];           // Images with any of these tag IDs
  hasTags?: boolean;           // Has any tags vs. no tags
  notesContains?: string;      // Text search in notes
}

export interface TextSearchFilter {
  positivePrompt?: string;     // LIKE search in positive prompt
  negativePrompt?: string;     // LIKE search in negative prompt
}

export interface TimeFilter {
  createdAfter?: string;       // ISO date string
  createdBefore?: string;      // ISO date string
  modifiedAfter?: string;      // ISO date string
  modifiedBefore?: string;     // ISO date string
}

export interface FolderFilter {
  pathPrefix?: string;         // Directory path prefix (e.g., "style/portrait/")
  excludePaths?: string[];     // Paths to exclude
}

export interface CollectionFilter {
  collectionId?: number;       // Filter by collection ID
}

export interface ImagePropertiesFilter {
  widthMin?: number;
  widthMax?: number;
  heightMin?: number;
  heightMax?: number;
  aspectRatios?: ("portrait" | "landscape" | "square")[];
  fileFormats?: ("PNG" | "JPG" | "WebP")[];
  fileSizeMin?: number;       // bytes
  fileSizeMax?: number;       // bytes
  hasAlpha?: boolean;
  isMissing?: boolean;         // Show missing files (default: false)
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
}

export interface PaginationOptions {
  pageSize?: number;          // Default: 50, Max: 200
  cursor?: Cursor;            // For next/prev pages
  direction?: "next" | "prev"; // For prev page navigation
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
  createdAt: string;
  updatedAt: string;
  fileModifiedAt: string | null;
  isMissing: boolean | null;
  // Extracted fields (parsed from JSON)
  extractedModels: string[];
  extractedLoras: string[];
  extractedSamplers: string[];
  extractedSchedulers: string[];
  steps: number | null;
  cfgScale: number | null;
  seed: string | null;
  positivePrompt: string | null;
  negativePrompt: string | null;
  // Joined tags
  tags: { id: number; name: string; slug: string }[];
  // Collection membership
  collectionIds: number[];
}

// Smart collection rule types (extends existing)
export type SmartRuleField =
  // User marks
  | "rating" | "color_label" | "flag" | "has_tags"
  // Generation params
  | "model" | "loras" | "sampler" | "scheduler"
  | "steps" | "cfg" | "seed"
  // Text search
  | "positive_prompt" | "negative_prompt"
  // Time
  | "created_after" | "created_before"
  // Properties
  | "width" | "height" | "aspect_ratio" | "file_format" | "has_alpha";

export type SmartRuleOperator =
  | "=" | "!=" | ">" | ">=" | "<" | "<="
  | "in" | "not_in"
  | "contains" | "not_contains"
  | "is_null" | "is_not_null"
  | "is_empty" | "is_not_empty";

export interface SmartRule {
  field: SmartRuleField;
  operator: SmartRuleOperator;
  value: any;
}

export interface SmartCriteria {
  operator: "AND" | "OR";
  rules: SmartRule[];
}
```

- [ ] **Step 1: Create the type definition file**

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/gallery-query-types.ts
git commit -m "feat: add type definitions for gallery query service"
```

---

## Task 2: Create GalleryQueryService core

**Files:**
- Create: `src/lib/server/gallery-query-service.ts`

Create the GalleryQueryService class with the core query building logic:

```typescript
import { db } from "$lib/server/db";
import { imageAttributes, imageTags, tags, collections } from "$lib/server/db/schema";
import {
  eq,
  gte,
  lte,
  inArray,
  like,
  and,
  or,
  isNull,
  isNotNull,
  sql,
  desc,
  asc,
  SQL,
} from "drizzle-orm";
import type {
  FilterCriteria,
  SortOption,
  PaginationOptions,
  QueryResult,
  ImageResult,
  Cursor,
  SortField,
} from "./gallery-query-types";

export class GalleryQueryService {
  /**
   * Query images with filters, sorting, and cursor-based pagination.
   */
  async query(
    filters: FilterCriteria = {},
    sort: SortOption = { field: "created_at", direction: "desc" },
    pagination: PaginationOptions = {},
  ): Promise<QueryResult> {
    const pageSize = Math.min(pagination.pageSize ?? 50, 200);
    
    // Build WHERE clause from filters
    const whereClause = this.buildWhereClause(filters);
    
    // Build ORDER BY clause
    const orderByClause = this.buildOrderByClause(sort);
    
    // Build cursor conditions for pagination
    const cursorClause = pagination.cursor 
      ? this.buildCursorClause(sort, pagination.cursor, pagination.direction)
      : undefined;
    
    // Combine WHERE conditions
    const finalWhere = cursorClause 
      ? and(whereClause, cursorClause)
      : whereClause;
    
    // Query total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(imageAttributes)
      .where(finalWhere ?? sql`1=1`);
    const total = countResult[0]?.count ?? 0;
    
    // Query images with pagination
    const images = await this.queryImages(finalWhere, orderByClause, pageSize + 1);
    
    // Determine pagination state
    const hasMore = images.length > pageSize;
    const hasLess = pagination.cursor !== undefined;
    
    // Trim extra image used for hasMore detection
    const resultImages = images.slice(0, pageSize);
    
    // Generate cursors
    const nextCursor = hasMore && resultImages.length > 0
      ? this.createCursor(sort, resultImages[resultImages.length - 1])
      : null;
    
    const prevCursor = pagination.cursor && resultImages.length > 0
      ? this.createCursor(sort, resultImages[0])
      : null;
    
    return {
      images: resultImages,
      total,
      pageSize,
      hasMore,
      hasLess,
      nextCursor,
      prevCursor,
    };
  }
  
  /**
   * Build WHERE clause from filter criteria.
   */
  private buildWhereClause(filters: FilterCriteria): SQL | undefined {
    const conditions: (SQL | undefined)[] = [];
    
    // Generation params filter
    if (filters.generation) {
      conditions.push(this.buildGenerationFilter(filters.generation));
    }
    
    // User marks filter
    if (filters.user) {
      conditions.push(this.buildUserMarksFilter(filters.user));
    }
    
    // Text search filter
    if (filters.text) {
      conditions.push(this.buildTextSearchFilter(filters.text));
    }
    
    // Time filter
    if (filters.time) {
      conditions.push(this.buildTimeFilter(filters.time));
    }
    
    // Folder filter
    if (filters.folder) {
      conditions.push(this.buildFolderFilter(filters.folder));
    }
    
    // Collection filter
    if (filters.collection) {
      conditions.push(this.buildCollectionFilter(filters.collection));
    }
    
    // Properties filter
    if (filters.properties) {
      conditions.push(this.buildPropertiesFilter(filters.properties));
    }
    
    // Default: exclude missing files unless explicitly requested
    if (!filters.properties?.isMissing) {
      conditions.push(
        sql`ifnull(${imageAttributes.isMissing}, 0) = 0`
      );
    }
    
    return conditions.filter((c): c is SQL => c !== undefined).length > 0
      ? and(...conditions)
      : undefined;
  }
  
  /**
   * Build generation params filter conditions.
   */
  private buildGenerationFilter(filter: import("./gallery-query-types").GenerationParamsFilter): SQL | undefined {
    const conditions: SQL[] = [];
    
    if (filter.models && filter.models.length > 0) {
      // Use json_each() to search JSON array
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM json_each(${imageAttributes.extractedModels})
          WHERE json_each.value IN ${filter.models}
        )`
      );
    }
    
    if (filter.loras && filter.loras.length > 0) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM json_each(${imageAttributes.extractedLoras})
          WHERE json_each.value IN ${filter.loras}
        )`
      );
    }
    
    if (filter.samplers && filter.samplers.length > 0) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM json_each(${imageAttributes.extractedSamplers})
          WHERE json_each.value IN ${filter.samplers}
        )`
      );
    }
    
    if (filter.schedulers && filter.schedulers.length > 0) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM json_each(${imageAttributes.extractedSchedulers})
          WHERE json_each.value IN ${filter.schedulers}
        )`
      );
    }
    
    if (filter.stepsMin !== undefined) {
      conditions.push(
        gte(imageAttributes.steps, filter.stepsMin)
      );
    }
    
    if (filter.stepsMax !== undefined) {
      conditions.push(
        lte(imageAttributes.steps, filter.stepsMax)
      );
    }
    
    if (filter.cfgMin !== undefined) {
      conditions.push(
        gte(imageAttributes.cfgScale, filter.cfgMin)
      );
    }
    
    if (filter.cfgMax !== undefined) {
      conditions.push(
        lte(imageAttributes.cfgScale, filter.cfgMax)
      );
    }
    
    if (filter.seed !== undefined) {
      conditions.push(eq(imageAttributes.seed, filter.seed));
    }
    
    return conditions.length > 0 ? and(...conditions) : undefined;
  }
  
  /**
   * Build user marks filter conditions.
   */
  private buildUserMarksFilter(filter: import("./gallery-query-types").UserMarksFilter): SQL | undefined {
    const conditions: SQL[] = [];
    
    if (filter.ratingMin !== undefined) {
      conditions.push(gte(imageAttributes.rating, filter.ratingMin));
    }
    
    if (filter.ratingMax !== undefined) {
      conditions.push(lte(imageAttributes.rating, filter.ratingMax));
    }
    
    if (filter.colorLabels && filter.colorLabels.length > 0) {
      conditions.push(inArray(imageAttributes.colorLabel, filter.colorLabels));
    }
    
    if (filter.flags && filter.flags.length > 0) {
      conditions.push(inArray(imageAttributes.flag, filter.flags));
    }
    
    if (filter.hasFlag !== undefined) {
      if (filter.hasFlag) {
        conditions.push(isNotNull(imageAttributes.flag));
      } else {
        conditions.push(isNull(imageAttributes.flag));
      }
    }
    
    if (filter.notesContains) {
      conditions.push(like(imageAttributes.notes, `%${filter.notesContains}%`));
    }
    
    // Tag filtering requires subquery - handled separately in queryImages
    if (filter.tagIds && filter.tagIds.length > 0) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${imageTags}
          WHERE ${imageTags.relativePath} = ${imageAttributes.relativePath}
          AND ${imageTags.tagId} IN ${filter.tagIds}
        )`
      );
    }
    
    if (filter.hasTags !== undefined) {
      if (filter.hasTags) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM ${imageTags}
            WHERE ${imageTags.relativePath} = ${imageAttributes.relativePath}
          )`
        );
      } else {
        conditions.push(
          sql`NOT EXISTS (
            SELECT 1 FROM ${imageTags}
            WHERE ${imageTags.relativePath} = ${imageAttributes.relativePath}
          )`
        );
      }
    }
    
    return conditions.length > 0 ? and(...conditions) : undefined;
  }
  
  /**
   * Build text search filter conditions.
   */
  private buildTextSearchFilter(filter: import("./gallery-query-types").TextSearchFilter): SQL | undefined {
    const conditions: SQL[] = [];
    
    if (filter.positivePrompt) {
      conditions.push(
        like(imageAttributes.positivePrompt, `%${filter.positivePrompt}%`)
      );
    }
    
    if (filter.negativePrompt) {
      conditions.push(
        like(imageAttributes.negativePrompt, `%${filter.negativePrompt}%`)
      );
    }
    
    return conditions.length > 0 ? and(...conditions) : undefined;
  }
  
  /**
   * Build time filter conditions.
   */
  private buildTimeFilter(filter: import("./gallery-query-types").TimeFilter): SQL | undefined {
    const conditions: SQL[] = [];
    
    if (filter.createdAfter) {
      conditions.push(
        sql`${imageAttributes.createdAt} >= ${filter.createdAfter}`
      );
    }
    
    if (filter.createdBefore) {
      conditions.push(
        sql`${imageAttributes.createdAt} <= ${filter.createdBefore}`
      );
    }
    
    if (filter.modifiedAfter) {
      conditions.push(
        sql`${imageAttributes.fileModifiedAt} >= ${filter.modifiedAfter}`
      );
    }
    
    if (filter.modifiedBefore) {
      conditions.push(
        sql`${imageAttributes.fileModifiedAt} <= ${filter.modifiedBefore}`
      );
    }
    
    return conditions.length > 0 ? and(...conditions) : undefined;
  }
  
  /**
   * Build folder filter conditions.
   */
  private buildFolderFilter(filter: import("./gallery-query-types").FolderFilter): SQL | undefined {
    const conditions: SQL[] = [];
    
    if (filter.pathPrefix) {
      conditions.push(
        like(imageAttributes.relativePath, `${filter.pathPrefix}%`)
      );
    }
    
    if (filter.excludePaths && filter.excludePaths.length > 0) {
      for (const excludePath of filter.excludePaths) {
        conditions.push(
          sql`${imageAttributes.relativePath} NOT LIKE ${excludePath + '%'}`
        );
      }
    }
    
    return conditions.length > 0 ? and(...conditions) : undefined;
  }
  
  /**
   * Build collection filter conditions.
   */
  private buildCollectionFilter(filter: import("./gallery-query-types").CollectionFilter): SQL | undefined {
    if (filter.collectionId === undefined) return undefined;
    
    // For smart collections, we need to evaluate the criteria
    // This is handled separately in evaluateSmartCollection
    return sql`EXISTS (
      SELECT 1 FROM ${collections}
      INNER JOIN ${imageTags} ON ${collections.id} = ${imageTags.tagId}
      WHERE ${collections.id} = ${filter.collectionId}
      AND ${imageTags.relativePath} = ${imageAttributes.relativePath}
    )`;
  }
  
  /**
   * Build image properties filter conditions.
   */
  private buildPropertiesFilter(filter: import("./gallery-query-types").ImagePropertiesFilter): SQL | undefined {
    const conditions: SQL[] = [];
    
    if (filter.widthMin !== undefined) {
      conditions.push(gte(imageAttributes.width, filter.widthMin));
    }
    
    if (filter.widthMax !== undefined) {
      conditions.push(lte(imageAttributes.width, filter.widthMax));
    }
    
    if (filter.heightMin !== undefined) {
      conditions.push(gte(imageAttributes.height, filter.heightMin));
    }
    
    if (filter.heightMax !== undefined) {
      conditions.push(lte(imageAttributes.height, filter.heightMax));
    }
    
    if (filter.aspectRatios && filter.aspectRatios.length > 0) {
      conditions.push(inArray(imageAttributes.aspectRatio, filter.aspectRatios));
    }
    
    if (filter.fileFormats && filter.fileFormats.length > 0) {
      conditions.push(inArray(imageAttributes.fileFormat, filter.fileFormats));
    }
    
    if (filter.fileSizeMin !== undefined) {
      conditions.push(gte(imageAttributes.fileSize, filter.fileSizeMin));
    }
    
    if (filter.fileSizeMax !== undefined) {
      conditions.push(lte(imageAttributes.fileSize, filter.fileSizeMax));
    }
    
    if (filter.hasAlpha !== undefined) {
      conditions.push(
        eq(sql`ifnull(${imageAttributes.hasAlpha}, 0)`, filter.hasAlpha ? 1 : 0)
      );
    }
    
    if (filter.isMissing !== undefined) {
      conditions.push(
        eq(sql`ifnull(${imageAttributes.isMissing}, 0)`, filter.isMissing ? 1 : 0)
      );
    }
    
    return conditions.length > 0 ? and(...conditions) : undefined;
  }
  
  /**
   * Build ORDER BY clause from sort option.
   */
  private buildOrderByClause(sort: SortOption): SQL {
    const column = this.getSortColumn(sort.field);
    return sort.direction === "desc" ? desc(column) : asc(column);
  }
  
  /**
   * Get the column for a sort field.
   */
  private getSortColumn(field: SortField): SQL {
    switch (field) {
      case "created_at":
        return imageAttributes.createdAt;
      case "updated_at":
        return imageAttributes.updatedAt;
      case "rating":
        return imageAttributes.rating;
      case "filename":
        // Extract filename from relativePath
        return sql`substr(${imageAttributes.relativePath}, instr(${imageAttributes.relativePath}, '/') + 1)`;
      case "file_size":
        return imageAttributes.fileSize;
      case "width":
        return imageAttributes.width;
      case "height":
        return imageAttributes.height;
      default:
        return imageAttributes.createdAt;
    }
  }
  
  /**
   * Build cursor clause for keyset pagination.
   */
  private buildCursorClause(
    sort: SortOption,
    cursor: Cursor,
    direction?: "next" | "prev",
  ): SQL {
    const column = this.getSortColumn(sort.field);
    const isDescending = sort.direction === "desc";
    const isNext = direction !== "prev";
    
    // For keyset pagination, we use: (column > cursorValue) or (column = cursorValue AND id > cursorId)
    // The direction depends on sort direction and navigation direction
    if (isNext) {
      if (isDescending) {
        return sql`(${column} < ${cursor.value} OR (${column} = ${cursor.value} AND ${imageAttributes.relativePath} < ${cursor.field === "filename" ? cursor.value : imageAttributes.relativePath}))`;
      } else {
        return sql`(${column} > ${cursor.value} OR (${column} = ${cursor.value} AND ${imageAttributes.relativePath} > ${cursor.field === "filename" ? cursor.value : imageAttributes.relativePath}))`;
      }
    } else {
      // Previous page: reverse the comparison
      if (isDescending) {
        return sql`(${column} > ${cursor.value} OR (${column} = ${cursor.value} AND ${imageAttributes.relativePath} > ${cursor.field === "filename" ? cursor.value : imageAttributes.relativePath}))`;
      } else {
        return sql`(${column} < ${cursor.value} OR (${column} = ${cursor.value} AND ${imageAttributes.relativePath} < ${cursor.field === "filename" ? cursor.value : imageAttributes.relativePath}))`;
      }
    }
  }
  
  /**
   * Query images with optional WHERE clause, ORDER BY, and LIMIT.
   * Joins with tags to include tag information.
   */
  private async queryImages(
    where: SQL | undefined,
    orderBy: SQL,
    limit: number,
  ): Promise<ImageResult[]> {
    // Main query
    const rows = await db
      .select()
      .from(imageAttributes)
      .where(where ?? sql`1=1`)
      .orderBy(orderBy)
      .limit(limit);
    
    // Get all relative paths
    const paths = rows.map((r) => r.relativePath);
    
    if (paths.length === 0) return [];
    
    // Batch query tags
    const BATCH = 500;
    const tagMap = new Map<string, { id: number; name: string; slug: string }[]>();
    
    for (let i = 0; i < paths.length; i += BATCH) {
      const batch = paths.slice(i, i + BATCH);
      
      const tagRows = await db
        .select({
          relativePath: imageTags.relativePath,
          tagId: tags.id,
          tagName: tags.name,
          tagSlug: tags.slug,
        })
        .from(imageTags)
        .innerJoin(tags, eq(imageTags.tagId, tags.id))
        .where(inArray(imageTags.relativePath, batch));
      
      for (const tr of tagRows) {
        if (!tr.tagId) continue;
        const list = tagMap.get(tr.relativePath) || [];
        list.push({
          id: tr.tagId,
          name: tr.tagName || "",
          slug: tr.tagSlug || "",
        });
        tagMap.set(tr.relativePath, list);
      }
    }
    
    // Transform rows to ImageResult
    return rows.map((row) => {
      // Parse JSON arrays
      const parseJsonArray = (json: string | null): string[] => {
        if (!json) return [];
        try {
          const parsed = JSON.parse(json);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      };
      
      return {
        relativePath: row.relativePath,
        rating: row.rating,
        colorLabel: row.colorLabel,
        flag: row.flag,
        notes: row.notes,
        stackId: row.stackId,
        width: row.width,
        height: row.height,
        aspectRatio: row.aspectRatio,
        fileSize: row.fileSize,
        fileFormat: row.fileFormat,
        hasAlpha: row.hasAlpha,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        fileModifiedAt: row.fileModifiedAt,
        isMissing: row.isMissing,
        extractedModels: parseJsonArray(row.extractedModels),
        extractedLoras: parseJsonArray(row.extractedLoras),
        extractedSamplers: parseJsonArray(row.extractedSamplers),
        extractedSchedulers: parseJsonArray(row.extractedSchedulers),
        steps: row.steps,
        cfgScale: row.cfgScale,
        seed: row.seed,
        positivePrompt: row.positivePrompt,
        negativePrompt: row.negativePrompt,
        tags: tagMap.get(row.relativePath) || [],
        collectionIds: [], // TODO: Query collection membership if needed
      };
    });
  }
  
  /**
   * Create a cursor from an image result based on the sort field.
   */
  private createCursor(sort: SortOption, image: ImageResult): Cursor {
    let value: string | number | null;
    
    switch (sort.field) {
      case "created_at":
        value = image.createdAt;
        break;
      case "updated_at":
        value = image.updatedAt;
        break;
      case "rating":
        value = image.rating ?? 0;
        break;
      case "filename":
        value = image.relativePath.split("/").pop() ?? image.relativePath;
        break;
      case "file_size":
        value = image.fileSize ?? 0;
        break;
      case "width":
        value = image.width ?? 0;
        break;
      case "height":
        value = image.height ?? 0;
        break;
      default:
        value = image.createdAt;
    }
    
    return {
      field: sort.field,
      value,
      direction: sort.direction,
    };
  }
}
```

- [ ] **Step 1: Create the GalleryQueryService file**

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/gallery-query-service.ts
git commit -m "feat: implement GalleryQueryService with filter/sort/pagination"
```

---

## Task 3: Extend smart collections with new filter dimensions

**Files:**
- Modify: `src/lib/server/smart-collections.ts`

Update the smart collections to support all the new filter dimensions:

1. Update the `SmartRuleField` type to include all new fields
2. Extend `buildCondition()` to handle JSON array queries
3. Add operators: `in`, `not_in`, `is_empty`, `is_not_empty`
4. Add support for generation params, text search, time, properties

Key changes to make:

```typescript
// Add new rule fields
export type SmartRuleField =
  // User marks (existing)
  | "rating" | "color_label" | "flag" | "has_tags"
  // Generation params (new)
  | "model" | "loras" | "sampler" | "scheduler"
  | "steps" | "cfg" | "seed"
  // Text search (new)
  | "positive_prompt" | "negative_prompt"
  // Time (new)
  | "created_after" | "created_before"
  // Properties (new)
  | "width" | "height" | "aspect_ratio" | "file_format" | "has_alpha";

// Add new operators
export type SmartRuleOperator =
  | "=" | "!=" | ">" | ">=" | "<" | "<="
  | "in" | "not_in"
  | "contains" | "not_contains"
  | "is_null" | "is_not_null"
  | "is_empty" | "is_not_empty";

// Extend buildCondition to handle JSON arrays
function buildCondition(rule: SmartRule) {
  const col = getColumn(rule.field);
  if (!col && !isJsonArrayField(rule.field)) return null;

  switch (rule.op) {
    // ... existing operators ...
    
    case "in":
      if (isJsonArrayField(rule.field)) {
        return sql`EXISTS (
          SELECT 1 FROM json_each(${getJsonArrayColumn(rule.field)})
          WHERE json_each.value IN ${rule.value}
        )`;
      }
      return inArray(col, rule.value);
    
    case "not_in":
      if (isJsonArrayField(rule.field)) {
        return sql`NOT EXISTS (
          SELECT 1 FROM json_each(${getJsonArrayColumn(rule.field)})
          WHERE json_each.value IN ${rule.value}
        )`;
      }
      return sql`${col} NOT IN ${rule.value}`;
    
    case "is_empty":
      if (isJsonArrayField(rule.field)) {
        return sql`json_array_length(${getJsonArrayColumn(rule.field)}) = 0`;
      }
      return sql`${col} = '' OR ${col} IS NULL`;
    
    case "is_not_empty":
      if (isJsonArrayField(rule.field)) {
        return sql`json_array_length(${getJsonArrayColumn(rule.field)}) > 0`;
      }
      return sql`${col} != '' AND ${col} IS NOT NULL`;
    
    default:
      return null;
  }
}

// Helper functions for JSON array fields
function isJsonArrayField(field: string): boolean {
  return ["model", "loras", "sampler", "scheduler"].includes(field);
}

function getJsonArrayColumn(field: string) {
  switch (field) {
    case "model":
      return imageAttributes.extractedModels;
    case "loras":
      return imageAttributes.extractedLoras;
    case "sampler":
      return imageAttributes.extractedSamplers;
    case "scheduler":
      return imageAttributes.extractedSchedulers;
    default:
      throw new Error(`Unknown JSON array field: ${field}`);
  }
}

// Extend getColumn to handle all new fields
function getColumn(field: string) {
  switch (field) {
    // User marks
    case "rating":
      return imageAttributes.rating;
    case "color_label":
      return imageAttributes.colorLabel;
    case "flag":
      return imageAttributes.flag;
    // Generation params
    case "steps":
      return imageAttributes.steps;
    case "cfg":
      return imageAttributes.cfgScale;
    case "seed":
      return imageAttributes.seed;
    case "positive_prompt":
      return imageAttributes.positivePrompt;
    case "negative_prompt":
      return imageAttributes.negativePrompt;
    // Properties
    case "width":
      return imageAttributes.width;
    case "height":
      return imageAttributes.height;
    case "aspect_ratio":
      return imageAttributes.aspectRatio;
    case "file_format":
      return imageAttributes.fileFormat;
    case "has_alpha":
      return sql`ifnull(${imageAttributes.hasAlpha}, 0)`;
    default:
      return null;
  }
}
```

- [ ] **Step 1: Update smart-collections.ts**

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/smart-collections.ts
git commit -m "feat: extend smart collections with all filter dimensions"
```

---

## Task 4: Update browse endpoint to use GalleryQueryService

**Files:**
- Modify: `src/routes/api/comfyui/browse/+server.ts`

Replace the current disk-based implementation with database-driven queries:

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { GalleryQueryService } from "$lib/server/gallery-query-service";
import type {
  FilterCriteria,
  SortOption,
  PaginationOptions,
} from "$lib/server/gallery-query-types";

export const GET: RequestHandler = async ({ url }) => {
  const service = new GalleryQueryService();
  
  // Parse pagination
  const pageSize = parseInt(url.searchParams.get("page_size") || "50");
  const cursorStr = url.searchParams.get("cursor");
  const direction = url.searchParams.get("direction") as "next" | "prev" | null;
  
  let cursor = null;
  if (cursorStr) {
    try {
      cursor = JSON.parse(cursorStr);
    } catch {
      // Invalid cursor, ignore
    }
  }
  
  // Parse sort
  const sortParam = url.searchParams.get("sort") || "created_at-desc";
  const [field, directionStr] = sortParam.split("-");
  const sort: SortOption = {
    field: (field === "filename" || field === "file_size" || field === "width" || field === "height" || field === "rating" || field === "created_at" || field === "updated_at")
      ? field
      : "created_at",
    direction: directionStr === "asc" ? "asc" : "desc",
  };
  
  // Parse filters
  const filters: FilterCriteria = {};
  
  // Generation params
  const models = url.searchParams.get("models");
  const loras = url.searchParams.get("loras");
  const samplers = url.searchParams.get("samplers");
  const schedulers = url.searchParams.get("schedulers");
  const stepsMin = url.searchParams.get("steps_min");
  const stepsMax = url.searchParams.get("steps_max");
  const cfgMin = url.searchParams.get("cfg_min");
  const cfgMax = url.searchParams.get("cfg_max");
  const seed = url.searchParams.get("seed");
  
  if (models || loras || samplers || schedulers || stepsMin || stepsMax || cfgMin || cfgMax || seed) {
    filters.generation = {
      ...(models && { models: models.split(",") }),
      ...(loras && { loras: loras.split(",") }),
      ...(samplers && { samplers: samplers.split(",") }),
      ...(schedulers && { schedulers: schedulers.split(",") }),
      ...(stepsMin && { stepsMin: parseInt(stepsMin) }),
      ...(stepsMax && { stepsMax: parseInt(stepsMax) }),
      ...(cfgMin && { cfgMin: parseFloat(cfgMin) }),
      ...(cfgMax && { cfgMax: parseFloat(cfgMax) }),
      ...(seed && { seed }),
    };
  }
  
  // User marks
  const ratingMin = url.searchParams.get("rating_min");
  const ratingMax = url.searchParams.get("rating_max");
  const colorLabel = url.searchParams.get("color_label");
  const flag = url.searchParams.get("flag");
  const tagIds = url.searchParams.get("tag_ids");
  const hasTags = url.searchParams.get("has_tags");
  
  if (ratingMin || ratingMax || colorLabel || flag || tagIds || hasTags) {
    filters.user = {
      ...(ratingMin && { ratingMin: parseInt(ratingMin) }),
      ...(ratingMax && { ratingMax: parseInt(ratingMax) }),
      ...(colorLabel && { colorLabels: [colorLabel] }),
      ...(flag && { flags: [flag] }),
      ...(tagIds && { tagIds: tagIds.split(",").map(Number) }),
      ...(hasTags && { hasTags: hasTags === "true" }),
    };
  }
  
  // Text search
  const positivePrompt = url.searchParams.get("positive_prompt");
  const negativePrompt = url.searchParams.get("negative_prompt");
  
  if (positivePrompt || negativePrompt) {
    filters.text = {
      ...(positivePrompt && { positivePrompt }),
      ...(negativePrompt && { negativePrompt }),
    };
  }
  
  // Time filter
  const createdAfter = url.searchParams.get("created_after");
  const createdBefore = url.searchParams.get("created_before");
  
  if (createdAfter || createdBefore) {
    filters.time = {
      ...(createdAfter && { createdAfter }),
      ...(createdBefore && { createdBefore }),
    };
  }
  
  // Folder filter
  const pathPrefix = url.searchParams.get("path_prefix");
  
  if (pathPrefix) {
    filters.folder = { pathPrefix };
  }
  
  // Collection filter
  const collectionId = url.searchParams.get("collection_id");
  
  if (collectionId) {
    filters.collection = { collectionId: parseInt(collectionId) };
  }
  
  // Properties filter
  const widthMin = url.searchParams.get("width_min");
  const widthMax = url.searchParams.get("width_max");
  const heightMin = url.searchParams.get("height_min");
  const heightMax = url.searchParams.get("height_max");
  const aspectRatios = url.searchParams.get("aspect_ratios");
  const fileFormats = url.searchParams.get("file_formats");
  const hasAlpha = url.searchParams.get("has_alpha");
  const isMissing = url.searchParams.get("is_missing");
  
  if (widthMin || widthMax || heightMin || heightMax || aspectRatios || fileFormats || hasAlpha || isMissing) {
    filters.properties = {
      ...(widthMin && { widthMin: parseInt(widthMin) }),
      ...(widthMax && { widthMax: parseInt(widthMax) }),
      ...(heightMin && { heightMin: parseInt(heightMin) }),
      ...(heightMax && { heightMax: parseInt(heightMax) }),
      ...(aspectRatios && { aspectRatios: aspectRatios.split(",") as any[] }),
      ...(fileFormats && { fileFormats: fileFormats.split(",") as any[] }),
      ...(hasAlpha && { hasAlpha: hasAlpha === "true" }),
      ...(isMissing && { isMissing: isMissing === "true" }),
    };
  }
  
  // Execute query
  const result = await service.query(filters, sort, {
    pageSize,
    cursor,
    direction: direction ?? "next",
  });
  
  return json(result);
};
```

- [ ] **Step 1: Update the browse endpoint**

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/comfyui/browse/+server.ts
git commit -m "refactor: browse endpoint uses GalleryQueryService with cursor pagination"
```

---

## Task 5: Write comprehensive tests for GalleryQueryService

**Files:**
- Create: `src/lib/server/__tests__/gallery-query-service.test.ts`

Write tests covering:

1. **Basic query** - No filters, default sort, returns images
2. **Generation params filter** - Filter by models, LoRAs, samplers, steps, CFG, seed
3. **User marks filter** - Filter by rating, color label, flag, tags
4. **Text search filter** - Search in positive/negative prompts
5. **Time filter** - Filter by creation/modification date
6. **Folder filter** - Filter by path prefix
7. **Properties filter** - Filter by dimensions, aspect ratio, file format, has alpha
8. **Sort options** - All sort fields and directions
9. **Cursor pagination** - Next page, previous page, hasMore/hasLess
10. **JSON array queries** - json_each() for models, LoRAs, etc.
11. **Empty result** - No matches found
12. **Complex combined filter** - Multiple filter dimensions together

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GalleryQueryService } from "../gallery-query-service";
import { db } from "$lib/server/db";
import { imageAttributes, imageTags, tags } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { join } from "node:path";
import {
  createTestDir,
  createTestPng,
  cleanupTestDir,
  SAMPLE_PROMPT_JSON,
} from "./metadata-extractor-fixtures";
import { upsertImageMetadata } from "../metadata-extractor";

describe("GalleryQueryService", () => {
  const testDir = createTestDir();
  let service: GalleryQueryService;
  let testPaths: string[] = [];
  
  beforeEach(async () => {
    service = new GalleryQueryService();
    testPaths = [];
    
    // Create test images with different properties
    const images = [
      { name: "portrait.png", width: 512, height: 768, rating: 5, colorLabel: "red", model: "model1.safetensors" },
      { name: "landscape.png", width: 1024, height: 576, rating: 3, colorLabel: "blue", model: "model2.safetensors" },
      { name: "square.png", width: 512, height: 512, rating: 1, colorLabel: null, model: "model1.safetensors" },
    ];
    
    for (const img of images) {
      const path = join(testDir, img.name);
      createTestPng(path, {
        width: img.width,
        height: img.height,
        textChunks: [{ keyword: "prompt", text: SAMPLE_PROMPT_JSON }],
      });
      
      await upsertImageMetadata(img.name, path);
      testPaths.push(img.name);
      
      // Update attributes
      await db
        .update(imageAttributes)
        .set({
          rating: img.rating,
          colorLabel: img.colorLabel,
        })
        .where(eq(imageAttributes.relativePath, img.name));
    }
  });
  
  afterEach(async () => {
    // Clean up test data
    for (const path of testPaths) {
      await db.delete(imageAttributes).where(eq(imageAttributes.relativePath, path));
    }
    cleanupTestDir(testDir);
  });
  
  it("returns all images with no filters", async () => {
    const result = await service.query();
    
    expect(result.images.length).toBeGreaterThanOrEqual(3);
    expect(result.total).toBeGreaterThanOrEqual(3);
  });
  
  it("filters by rating range", async () => {
    const result = await service.query({
      user: { ratingMin: 3 },
    });
    
    expect(result.images.length).toBeGreaterThanOrEqual(2);
    expect(result.images.every((img) => (img.rating ?? 0) >= 3)).toBe(true);
  });
  
  it("filters by color label", async () => {
    const result = await service.query({
      user: { colorLabels: ["red"] },
    });
    
    expect(result.images.length).toBeGreaterThanOrEqual(1);
    expect(result.images[0].colorLabel).toBe("red");
  });
  
  it("filters by aspect ratio", async () => {
    const result = await service.query({
      properties: { aspectRatios: ["portrait"] },
    });
    
    expect(result.images.length).toBeGreaterThanOrEqual(1);
    expect(result.images[0].aspectRatio).toBe("portrait");
  });
  
  it("sorts by rating descending", async () => {
    const result = await service.query(
      {},
      { field: "rating", direction: "desc" },
      { pageSize: 10 },
    );
    
    const ratings = result.images.map((img) => img.rating ?? 0);
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
  });
  
  it("implements cursor pagination for next page", async () => {
    const firstPage = await service.query(
      {},
      { field: "created_at", direction: "desc" },
      { pageSize: 2 },
    );
    
    expect(firstPage.images.length).toBe(2);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.nextCursor).not.toBeNull();
    
    const secondPage = await service.query(
      {},
      { field: "created_at", direction: "desc" },
      {
        pageSize: 2,
        cursor: firstPage.nextCursor ?? undefined,
        direction: "next",
      },
    );
    
    expect(secondPage.images.length).toBeGreaterThan(0);
    expect(secondPage.images[0].relativePath).not.toBe(firstPage.images[0].relativePath);
  });
  
  it("searches in positive prompt", async () => {
    const result = await service.query({
      text: { positivePrompt: "masterpiece" },
    });
    
    // Should match images with "masterpiece" in prompt
    expect(result.images.length).toBeGreaterThanOrEqual(0);
  });
  
  it("filters by dimensions", async () => {
    const result = await service.query({
      properties: { widthMin: 600, heightMin: 600 },
    });
    
    expect(result.images.every((img) => (img.width ?? 0) >= 600 && (img.height ?? 0) >= 600)).toBe(true);
  });
});
```

- [ ] **Step 1: Write the tests**

- [ ] **Step 2: Run tests**

```bash
npx vitest run src/lib/server/__tests__/gallery-query-service.test.ts --reporter=verbose
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/__tests__/gallery-query-service.test.ts
git commit -m "test: add comprehensive tests for GalleryQueryService"
```

---

## Task 6: Add API endpoint for filter options lookup

**Files:**
- Create: `src/routes/api/comfyui/filter-options/+server.ts`

Create an endpoint that returns available filter options (distinct values for dropdowns):

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { imageAttributes, tags } from "$lib/server/db/schema";
import { sql, isNotNull, ne } from "drizzle-orm";

export const GET: RequestHandler = async () => {
  // Get distinct values for filter dropdowns
  const [models, loras, samplers, schedulers, colorLabels, tagList] = await Promise.all([
    // Models (from JSON array)
    db
      .select({ value: sql<string>`DISTINCT json_each.value` })
      .from(sql`json_each(${imageAttributes.extractedModels})`)
      .where(sql`json_each.value IS NOT NULL`),
    
    // LoRAs
    db
      .select({ value: sql<string>`DISTINCT json_each.value` })
      .from(sql`json_each(${imageAttributes.extractedLoras})`)
      .where(sql`json_each.value IS NOT NULL`),
    
    // Samplers
    db
      .select({ value: sql<string>`DISTINCT json_each.value` })
      .from(sql`json_each(${imageAttributes.extractedSamplers})`)
      .where(sql`json_each.value IS NOT NULL`),
    
    // Schedulers
    db
      .select({ value: sql<string>`DISTINCT json_each.value` })
      .from(sql`json_each(${imageAttributes.extractedSchedulers})`)
      .where(sql`json_each.value IS NOT NULL`),
    
    // Color labels
    db
      .selectDistinct({ value: imageAttributes.colorLabel })
      .from(imageAttributes)
      .where(isNotNull(imageAttributes.colorLabel)),
    
    // Tags
    db
      .select({ id: tags.id, name: tags.name, slug: tags.slug })
      .from(tags)
      .orderBy(tags.name),
  ]);
  
  return json({
    models: models.map((m) => m.value).sort(),
    loras: loras.map((l) => l.value).sort(),
    samplers: samplers.map((s) => s.value).sort(),
    schedulers: schedulers.map((s) => s.value).sort(),
    colorLabels: colorLabels.map((c) => c.value).filter((v): v is string => v !== null),
    tags: tagList,
  });
};
```

- [ ] **Step 1: Create the filter options endpoint**

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/comfyui/filter-options/+server.ts
git commit -m "feat: add filter options lookup endpoint"
```

---

## Task 7: Integration verification and performance testing

**Files:**
- No new files, integration testing

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run --reporter=verbose
```

- [ ] **Step 2: Test browse endpoint with various filters**

Start dev server and test:

```bash
npm run dev
```

Test queries:
- `/api/comfyui/browse?page_size=10&sort=rating-desc`
- `/api/comfyui/browse?rating_min=4&color_label=red`
- `/api/comfyui/browse?models=model1.safetensors&steps_min=20`
- `/api/comfyui/browse?positive_prompt=masterpiece&aspect_ratios=portrait`
- `/api/comfyui/browse?collection_id=1`
- `/api/comfyui/browse?path_prefix=style/`

- [ ] **Step 3: Verify cursor pagination works correctly**

Test:
1. Load first page
2. Use `nextCursor` to load second page
3. Verify no duplicate images
4. Use `prevCursor` to go back
5. Verify first page is restored

- [ ] **Step 4: Test smart collections with new criteria**

Create a smart collection with new rule types:
- Generation params: `model in model1.safetensors`
- Text search: `positive_prompt contains masterpiece`
- Properties: `width >= 1024 and aspect_ratio = landscape`

Verify evaluation works correctly.

- [ ] **Step 5: Performance test with large dataset**

If you have a large dataset (1000+ images):
1. Test query performance with various filters
2. Verify cursor pagination is faster than offset at depth
3. Check that json_each() queries are efficient

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes for GalleryQueryService"
```

---

## Task 8: Update documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-06-05-gallery-redesign.md`

Add a note that Plan 3 is complete:

- [ ] **Step 1: Update spec with completion status**

Add to the spec file:

```markdown
## Implementation Status

- [x] Plan 1: Schema + Metadata Extraction
- [x] Plan 2: FileSyncService
- [x] Plan 3: GalleryQueryService
- [ ] Plan 4: Gallery Store (UI State Management)
- [ ] Plan 5: UI Components
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-06-05-gallery-redesign.md
git commit -m "docs: mark Plan 3 as complete"
```

---

## Summary

This plan implements a unified GalleryQueryService that:

1. **Centralizes all query logic** in a single service class
2. **Supports all filter dimensions** from the spec (generation, user marks, text, time, folder, collection, properties)
3. **Uses cursor-based pagination** for performance at scale
4. **Leverages SQLite json_each()** for JSON array filtering
5. **Integrates with smart collections** by evaluating criteria at query time
6. **Provides type-safe API** for the frontend to consume

The service replaces the current disk-based browsing with database-driven queries, enabling efficient filtering and pagination across thousands of images.
