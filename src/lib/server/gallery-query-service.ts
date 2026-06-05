import { db } from "$lib/server/db";
import {
  imageAttributes,
  imageTags,
  tags,
  collectionImages,
} from "$lib/server/db/schema";
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
  type SQL,
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

/**
 * Service for querying images with flexible filters, sorting, and pagination
 */
export class GalleryQueryService {
  /**
   * Build SQL condition for generation parameter filters
   */
  private buildGenerationFilter(
    filter: FilterCriteria["generation"],
  ): SQL | undefined {
    if (!filter) return undefined;

    const conditions: (SQL | undefined)[] = [];

    // Models filter - JSON array contains
    if (filter.models && filter.models.length > 0) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM json_each(${imageAttributes.extractedModels})
          WHERE json_each.value IN (${sql.join(
            filter.models.map((v) => sql`${v}`),
            sql`, `,
          )})
        )`,
      );
    }

    // Loras filter - JSON array contains
    if (filter.loras && filter.loras.length > 0) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM json_each(${imageAttributes.extractedLoras})
          WHERE json_each.value IN (${sql.join(
            filter.loras.map((v) => sql`${v}`),
            sql`, `,
          )})
        )`,
      );
    }

    // Samplers filter - JSON array contains
    if (filter.samplers && filter.samplers.length > 0) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM json_each(${imageAttributes.extractedSamplers})
          WHERE json_each.value IN (${sql.join(
            filter.samplers.map((v) => sql`${v}`),
            sql`, `,
          )})
        )`,
      );
    }

    // Schedulers filter - JSON array contains
    if (filter.schedulers && filter.schedulers.length > 0) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM json_each(${imageAttributes.extractedSchedulers})
          WHERE json_each.value IN (${sql.join(
            filter.schedulers.map((v) => sql`${v}`),
            sql`, `,
          )})
        )`,
      );
    }

    // Steps range
    if (filter.stepsMin !== undefined) {
      conditions.push(gte(imageAttributes.steps, filter.stepsMin));
    }
    if (filter.stepsMax !== undefined) {
      conditions.push(lte(imageAttributes.steps, filter.stepsMax));
    }

    // CFG scale range
    if (filter.cfgMin !== undefined) {
      conditions.push(gte(imageAttributes.cfgScale, filter.cfgMin));
    }
    if (filter.cfgMax !== undefined) {
      conditions.push(lte(imageAttributes.cfgScale, filter.cfgMax));
    }

    // Seed exact match
    if (filter.seed !== undefined) {
      conditions.push(eq(imageAttributes.seed, filter.seed));
    }

    return and(...conditions);
  }

  /**
   * Build SQL condition for user marks filters (rating, color labels, flags, tags, notes)
   */
  private buildUserMarksFilter(
    filter: FilterCriteria["user"],
  ): SQL | undefined {
    if (!filter) return undefined;

    const conditions: (SQL | undefined)[] = [];

    // Rating range
    if (filter.ratingMin !== undefined) {
      conditions.push(gte(imageAttributes.rating, filter.ratingMin));
    }
    if (filter.ratingMax !== undefined) {
      conditions.push(lte(imageAttributes.rating, filter.ratingMax));
    }

    // Color labels - array contains
    if (filter.colorLabels && filter.colorLabels.length > 0) {
      conditions.push(
        sql`${imageAttributes.colorLabel} IN (${sql.join(
          filter.colorLabels.map((v) => sql`${v}`),
          sql`, `,
        )})`,
      );
    }

    // Flags - array contains
    if (filter.flags && filter.flags.length > 0) {
      conditions.push(
        sql`${imageAttributes.flag} IN (${sql.join(
          filter.flags.map((v) => sql`${v}`),
          sql`, `,
        )})`,
      );
    }

    // Has flag or no flag
    if (filter.hasFlag === true) {
      conditions.push(isNotNull(imageAttributes.flag));
    } else if (filter.hasFlag === false) {
      conditions.push(isNull(imageAttributes.flag));
    }

    // Tag IDs - requires join
    if (filter.tagIds && filter.tagIds.length > 0) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${imageTags}
          WHERE ${imageTags.relativePath} = ${imageAttributes.relativePath}
          AND ${imageTags.tagId} IN (${sql.join(
            filter.tagIds.map((v) => sql`${v}`),
            sql`, `,
          )})
        )`,
      );
    }

    // Has tags or no tags
    if (filter.hasTags === true) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${imageTags}
          WHERE ${imageTags.relativePath} = ${imageAttributes.relativePath}
        )`,
      );
    } else if (filter.hasTags === false) {
      conditions.push(
        sql`NOT EXISTS (
          SELECT 1 FROM ${imageTags}
          WHERE ${imageTags.relativePath} = ${imageAttributes.relativePath}
        )`,
      );
    }

    // Notes contains text
    if (filter.notesContains !== undefined) {
      conditions.push(like(imageAttributes.notes, `%${filter.notesContains}%`));
    }

    return and(...conditions);
  }

  /**
   * Build SQL condition for text search in prompts
   */
  private buildTextFilter(filter: FilterCriteria["text"]): SQL | undefined {
    if (!filter) return undefined;

    const conditions: (SQL | undefined)[] = [];

    if (filter.positivePrompt !== undefined) {
      conditions.push(
        like(imageAttributes.positivePrompt, `%${filter.positivePrompt}%`),
      );
    }

    if (filter.negativePrompt !== undefined) {
      conditions.push(
        like(imageAttributes.negativePrompt, `%${filter.negativePrompt}%`),
      );
    }

    return and(...conditions);
  }

  /**
   * Build SQL condition for time-based filters
   */
  private buildTimeFilter(filter: FilterCriteria["time"]): SQL | undefined {
    if (!filter) return undefined;

    const conditions: (SQL | undefined)[] = [];

    if (filter.createdAfter !== undefined) {
      conditions.push(gte(imageAttributes.createdAt, filter.createdAfter));
    }
    if (filter.createdBefore !== undefined) {
      conditions.push(lte(imageAttributes.createdAt, filter.createdBefore));
    }

    if (filter.modifiedAfter !== undefined) {
      conditions.push(gte(imageAttributes.updatedAt, filter.modifiedAfter));
    }
    if (filter.modifiedBefore !== undefined) {
      conditions.push(lte(imageAttributes.updatedAt, filter.modifiedBefore));
    }

    return and(...conditions);
  }

  /**
   * Build SQL condition for folder path filters
   */
  private buildFolderFilter(filter: FilterCriteria["folder"]): SQL | undefined {
    if (!filter) return undefined;

    const conditions: (SQL | undefined)[] = [];

    // Path prefix filter
    if (filter.pathPrefix !== undefined) {
      conditions.push(
        like(imageAttributes.relativePath, `${filter.pathPrefix}%`),
      );
    }

    // Exclude specific paths
    if (filter.excludePaths && filter.excludePaths.length > 0) {
      conditions.push(
        sql`(${imageAttributes.relativePath} NOT IN (${sql.join(
          filter.excludePaths.map((v) => sql`${v}`),
          sql`, `,
        )}))`,
      );
    }

    return and(...conditions);
  }

  /**
   * Build SQL condition for collection filter
   */
  private buildCollectionFilter(
    filter: FilterCriteria["collection"],
  ): SQL | undefined {
    if (!filter || filter.collectionId === undefined) return undefined;

    return sql`EXISTS (
      SELECT 1 FROM ${collectionImages}
      WHERE ${collectionImages.collectionId} = ${filter.collectionId}
      AND ${collectionImages.relativePath} = ${imageAttributes.relativePath}
    )`;
  }

  /**
   * Build SQL condition for image properties filters
   */
  private buildPropertiesFilter(
    filter: FilterCriteria["properties"],
    isMissingExplicitlySet: boolean,
  ): SQL | undefined {
    if (!filter) return undefined;

    const conditions: (SQL | undefined)[] = [];

    // Width range
    if (filter.widthMin !== undefined) {
      conditions.push(gte(imageAttributes.width, filter.widthMin));
    }
    if (filter.widthMax !== undefined) {
      conditions.push(lte(imageAttributes.width, filter.widthMax));
    }

    // Height range
    if (filter.heightMin !== undefined) {
      conditions.push(gte(imageAttributes.height, filter.heightMin));
    }
    if (filter.heightMax !== undefined) {
      conditions.push(lte(imageAttributes.height, filter.heightMax));
    }

    // Aspect ratios
    if (filter.aspectRatios && filter.aspectRatios.length > 0) {
      const ratioConditions: SQL[] = [];
      for (const ratio of filter.aspectRatios) {
        if (ratio === "portrait") {
          ratioConditions.push(
            sql`${imageAttributes.aspectRatio} LIKE '%:%' AND CAST(substr(${imageAttributes.aspectRatio}, 1, instr(${imageAttributes.aspectRatio}, ':') - 1) AS INTEGER) < CAST(substr(${imageAttributes.aspectRatio}, instr(${imageAttributes.aspectRatio}, ':') + 1) AS INTEGER)`,
          );
        } else if (ratio === "landscape") {
          ratioConditions.push(
            sql`${imageAttributes.aspectRatio} LIKE '%:%' AND CAST(substr(${imageAttributes.aspectRatio}, 1, instr(${imageAttributes.aspectRatio}, ':') - 1) AS INTEGER) > CAST(substr(${imageAttributes.aspectRatio}, instr(${imageAttributes.aspectRatio}, ':') + 1) AS INTEGER)`,
          );
        } else if (ratio === "square") {
          ratioConditions.push(sql`${imageAttributes.aspectRatio} = '1:1'`);
        }
      }
      if (ratioConditions.length > 0) {
        conditions.push(or(...ratioConditions));
      }
    }

    // File formats
    if (filter.fileFormats && filter.fileFormats.length > 0) {
      conditions.push(
        sql`${imageAttributes.fileFormat} IN (${sql.join(
          filter.fileFormats.map((v) => sql`${v}`),
          sql`, `,
        )})`,
      );
    }

    // File size range
    if (filter.fileSizeMin !== undefined) {
      conditions.push(gte(imageAttributes.fileSize, filter.fileSizeMin));
    }
    if (filter.fileSizeMax !== undefined) {
      conditions.push(lte(imageAttributes.fileSize, filter.fileSizeMax));
    }

    // Has alpha channel
    if (filter.hasAlpha === true) {
      conditions.push(eq(imageAttributes.hasAlpha, true));
    } else if (filter.hasAlpha === false) {
      conditions.push(
        sql`(${imageAttributes.hasAlpha} = 0 OR ${imageAttributes.hasAlpha} IS NULL)`,
      );
    }

    // Is missing - only apply if explicitly set
    if (isMissingExplicitlySet) {
      if (filter.isMissing === true) {
        conditions.push(eq(imageAttributes.isMissing, true));
      } else if (filter.isMissing === false) {
        conditions.push(
          sql`(${imageAttributes.isMissing} = 0 OR ${imageAttributes.isMissing} IS NULL)`,
        );
      }
    }

    return and(...conditions);
  }

  /**
   * Get the SQL column for a sort field
   */
  private getSortColumn(field: SortField) {
    switch (field) {
      case "created_at":
        return imageAttributes.createdAt;
      case "updated_at":
        return imageAttributes.updatedAt;
      case "rating":
        return imageAttributes.rating;
      case "file_size":
        return imageAttributes.fileSize;
      case "width":
        return imageAttributes.width;
      case "height":
        return imageAttributes.height;
      case "filename":
        // Extract filename from relativePath (last component after /)
        return sql`substr(${imageAttributes.relativePath}, instr(${imageAttributes.relativePath}, '/') + 1)`;
      default:
        return imageAttributes.createdAt;
    }
  }

  /**
   * Build cursor condition for pagination
   */
  private buildCursorCondition(
    sort: SortOption,
    pagination: PaginationOptions,
  ): SQL | undefined {
    const { cursor, direction = "next" } = pagination;
    if (!cursor) return undefined;

    const sortColumn = this.getSortColumn(sort.field);
    const pathColumn = imageAttributes.relativePath;

    // For descending sort
    if (sort.direction === "desc") {
      if (direction === "next") {
        // Get rows with sort value < cursor OR same value and path < cursor path
        return sql`(${sortColumn} < ${cursor.value} OR (${sortColumn} = ${cursor.value} AND ${pathColumn} > ${cursor.path}))`;
      } else {
        // Previous page: reverse condition
        return sql`(${sortColumn} > ${cursor.value} OR (${sortColumn} = ${cursor.value} AND ${pathColumn} < ${cursor.path}))`;
      }
    } else {
      // For ascending sort
      if (direction === "next") {
        return sql`(${sortColumn} > ${cursor.value} OR (${sortColumn} = ${cursor.value} AND ${pathColumn} > ${cursor.path}))`;
      } else {
        return sql`(${sortColumn} < ${cursor.value} OR (${sortColumn} = ${cursor.value} AND ${pathColumn} < ${cursor.path}))`;
      }
    }
  }

  /**
   * Parse JSON string array
   */
  private parseJsonArray(value: string | null): string[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Batch fetch tags for all given image paths
   */
  private async fetchTagsForPaths(
    relativePaths: string[],
  ): Promise<Map<string, Array<{ id: number; name: string; slug: string }>>> {
    if (relativePaths.length === 0) return new Map();

    const tagRows = await db
      .select({
        relativePath: imageTags.relativePath,
        id: tags.id,
        name: tags.name,
        slug: tags.slug,
      })
      .from(imageTags)
      .innerJoin(tags, eq(imageTags.tagId, tags.id))
      .where(inArray(imageTags.relativePath, relativePaths));

    const result = new Map<
      string,
      Array<{ id: number; name: string; slug: string }>
    >();

    for (const row of tagRows) {
      if (!result.has(row.relativePath)) {
        result.set(row.relativePath, []);
      }
      result.get(row.relativePath)!.push({
        id: row.id,
        name: row.name,
        slug: row.slug,
      });
    }

    return result;
  }

  /**
   * Batch fetch collection IDs for all given image paths
   */
  private async fetchCollectionIdsForPaths(
    relativePaths: string[],
  ): Promise<Map<string, number[]>> {
    if (relativePaths.length === 0) return new Map();

    const collectionRows = await db
      .select({
        relativePath: collectionImages.relativePath,
        collectionId: collectionImages.collectionId,
      })
      .from(collectionImages)
      .where(inArray(collectionImages.relativePath, relativePaths));

    const result = new Map<string, number[]>();

    for (const row of collectionRows) {
      if (!result.has(row.relativePath)) {
        result.set(row.relativePath, []);
      }
      result.get(row.relativePath)!.push(row.collectionId);
    }

    return result;
  }

  /**
   * Build the complete WHERE clause from all filters
   */
  private buildWhereClause(
    filters: FilterCriteria,
    sort: SortOption,
    pagination: PaginationOptions,
  ): SQL | undefined {
    const conditions: (SQL | undefined)[] = [];

    // Build each filter dimension
    conditions.push(this.buildGenerationFilter(filters.generation));
    conditions.push(this.buildUserMarksFilter(filters.user));
    conditions.push(this.buildTextFilter(filters.text));
    conditions.push(this.buildTimeFilter(filters.time));
    conditions.push(this.buildFolderFilter(filters.folder));
    conditions.push(this.buildCollectionFilter(filters.collection));

    // Check if isMissing is explicitly set
    const isMissingExplicitlySet = filters.properties?.isMissing !== undefined;
    conditions.push(
      this.buildPropertiesFilter(filters.properties, isMissingExplicitlySet),
    );

    // Default: exclude missing files unless explicitly requested
    if (!isMissingExplicitlySet) {
      conditions.push(
        sql`(${imageAttributes.isMissing} = 0 OR ${imageAttributes.isMissing} IS NULL)`,
      );
    }

    // Add cursor condition
    conditions.push(this.buildCursorCondition(sort, pagination));

    return and(...conditions);
  }

  /**
   * Main query method
   */
  async query(
    filters: FilterCriteria = {},
    sort: SortOption = { field: "created_at", direction: "desc" },
    pagination: PaginationOptions = {},
  ): Promise<QueryResult> {
    const pageSize = pagination.pageSize ?? 50;
    const direction = pagination.direction ?? "next";

    // Build WHERE clause
    const where = this.buildWhereClause(filters, sort, pagination);

    // Determine sort order
    // For prev page, we reverse the order to get the previous items
    const isReversed = direction === "prev";
    const orderDir = isReversed
      ? sort.direction === "asc"
        ? desc
        : asc
      : sort.direction === "asc"
        ? asc
        : desc;

    const sortColumn = this.getSortColumn(sort.field);

    // Query one extra row to detect if there are more results
    const rows = await db
      .select({
        relativePath: imageAttributes.relativePath,
        rating: imageAttributes.rating,
        colorLabel: imageAttributes.colorLabel,
        flag: imageAttributes.flag,
        notes: imageAttributes.notes,
        stackId: imageAttributes.stackId,
        width: imageAttributes.width,
        height: imageAttributes.height,
        aspectRatio: imageAttributes.aspectRatio,
        fileSize: imageAttributes.fileSize,
        fileFormat: imageAttributes.fileFormat,
        hasAlpha: imageAttributes.hasAlpha,
        createdAt: imageAttributes.createdAt,
        updatedAt: imageAttributes.updatedAt,
        fileModifiedAt: imageAttributes.fileModifiedAt,
        isMissing: imageAttributes.isMissing,
        extractedModels: imageAttributes.extractedModels,
        extractedLoras: imageAttributes.extractedLoras,
        extractedSamplers: imageAttributes.extractedSamplers,
        extractedSchedulers: imageAttributes.extractedSchedulers,
        steps: imageAttributes.steps,
        cfgScale: imageAttributes.cfgScale,
        seed: imageAttributes.seed,
        positivePrompt: imageAttributes.positivePrompt,
        negativePrompt: imageAttributes.negativePrompt,
      })
      .from(imageAttributes)
      .where(where)
      .orderBy(orderDir(sortColumn), orderDir(imageAttributes.relativePath))
      .limit(pageSize + 1);

    // Detect if there are more results
    const hasMore = rows.length > pageSize;
    const hasLess = pagination.cursor !== undefined;

    // Trim to exact page size
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;

    // If going backwards, reverse the results to get correct order
    const orderedRows = isReversed ? pageRows.reverse() : pageRows;

    // Get paths for batch fetching tags and collection IDs
    const paths = orderedRows.map((r) => r.relativePath);
    const [tagsMap, collectionsMap] = await Promise.all([
      this.fetchTagsForPaths(paths),
      this.fetchCollectionIdsForPaths(paths),
    ]);

    // Transform to ImageResult
    const images: ImageResult[] = orderedRows.map((row) => ({
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
      extractedModels: this.parseJsonArray(row.extractedModels),
      extractedLoras: this.parseJsonArray(row.extractedLoras),
      extractedSamplers: this.parseJsonArray(row.extractedSamplers),
      extractedSchedulers: this.parseJsonArray(row.extractedSchedulers),
      steps: row.steps,
      cfgScale: row.cfgScale,
      seed: row.seed,
      positivePrompt: row.positivePrompt,
      negativePrompt: row.negativePrompt,
      tags: tagsMap.get(row.relativePath) ?? [],
      collectionIds: collectionsMap.get(row.relativePath) ?? [],
    }));

    // Build cursors
    const firstImage = images[0];
    const lastImage = images[images.length - 1];

    const nextCursor: Cursor | null =
      hasMore && lastImage
        ? {
            field: sort.field,
            value:
              sort.field === "rating"
                ? lastImage.rating
                : sort.field === "file_size"
                  ? lastImage.fileSize
                  : sort.field === "width"
                    ? lastImage.width
                    : sort.field === "height"
                      ? lastImage.height
                      : lastImage.createdAt,
            direction: sort.direction,
            path: lastImage.relativePath,
          }
        : null;

    const prevCursor: Cursor | null =
      hasLess && firstImage
        ? {
            field: sort.field,
            value:
              sort.field === "rating"
                ? firstImage.rating
                : sort.field === "file_size"
                  ? firstImage.fileSize
                  : sort.field === "width"
                    ? firstImage.width
                    : sort.field === "height"
                      ? firstImage.height
                      : firstImage.createdAt,
            direction: sort.direction,
            path: firstImage.relativePath,
          }
        : null;

    // Get total count (expensive operation, only if needed)
    // For now, return -1 to indicate not calculated
    // Could be optimized with COUNT query in a separate method
    const total = -1;

    return {
      images,
      total,
      pageSize,
      hasMore,
      hasLess,
      nextCursor,
      prevCursor,
    };
  }
}

// Singleton instance
export const galleryQueryService = new GalleryQueryService();
