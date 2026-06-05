import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { galleryQueryService } from "$lib/server/gallery-query-service";
import { db } from "$lib/server/db";
import { tags } from "$lib/server/db/schema";
import { eq, like } from "drizzle-orm";
import type {
  FilterCriteria,
  SortOption,
  PaginationOptions,
  Cursor,
} from "$lib/server/gallery-query-types";

/**
 * Map old sort values to new SortOption format
 */
function mapSortParam(sort: string | null): SortOption {
  if (!sort) return { field: "modified_at", direction: "desc" };

  // New format: "field-direction"
  const newFormatMatch = sort.match(
    /^(created_at|modified_at|rating|filename|file_size)-(asc|desc)$/,
  );
  if (newFormatMatch) {
    return {
      field: newFormatMatch[1] as
        | "created_at"
        | "modified_at"
        | "rating"
        | "filename"
        | "file_size",
      direction: newFormatMatch[2] as "asc" | "desc",
    };
  }

  // Old format compatibility
  switch (sort) {
    case "date-desc":
      return { field: "modified_at", direction: "desc" };
    case "date-asc":
      return { field: "modified_at", direction: "asc" };
    case "name":
      return { field: "filename", direction: "asc" };
    default:
      return { field: "modified_at", direction: "desc" };
  }
}

/**
 * Parse cursor from JSON string
 */
function parseCursor(cursorStr: string | null): Cursor | undefined {
  if (!cursorStr) return undefined;
  try {
    return JSON.parse(cursorStr) as Cursor;
  } catch {
    return undefined;
  }
}

/**
 * Look up tag by name and return its ID
 */
async function lookupTagIdByName(tagName: string): Promise<number | null> {
  const tagRows = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.name, tagName))
    .limit(1);
  return tagRows[0]?.id ?? null;
}

/**
 * Map ImageResult to the format expected by the frontend
 * (compatible with the old BrowseImage format)
 */
function mapToFrontendFormat(image: any) {
  return {
    // Core fields (BrowseImage compatible)
    filename: image.relativePath.split("/").pop() || image.relativePath,
    relativePath: image.relativePath,

    // Renamed for compatibility
    size: image.fileSize,
    modifiedAt: image.fileModifiedAt,
    width: image.width,
    height: image.height,
    metadata:
      image.positivePrompt || image.negativePrompt
        ? {
            positivePrompts: image.positivePrompt ? [image.positivePrompt] : [],
            negativePrompts: image.negativePrompt ? [image.negativePrompt] : [],
            models: image.extractedModels,
            loras: image.extractedLoras,
            width: image.width,
            height: image.height,
            samplers: image.extractedSamplers.map((s: string) => ({
              id: "",
              classType: "KSampler",
              seed: image.seed,
              steps: image.steps,
              cfg: image.cfgScale,
              samplerName: s,
              scheduler: image.extractedSchedulers?.[0] ?? null,
              denoise: null,
            })),
            rawPromptJson: null,
          }
        : null,

    // User attributes
    attributes: {
      rating: image.rating ?? 0,
      colorLabel: image.colorLabel,
      flag: image.flag,
      notes: image.notes,
      stackId: image.stackId,
    },

    // Tags
    tags: image.tags,

    // Additional fields from ImageResult
    aspectRatio: image.aspectRatio,
    fileFormat: image.fileFormat,
    hasAlpha: image.hasAlpha,
    createdAt: image.createdAt,
    updatedAt: image.updatedAt,
    isMissing: image.isMissing,
    extractedModels: image.extractedModels,
    extractedLoras: image.extractedLoras,
    extractedSamplers: image.extractedSamplers,
    extractedSchedulers: image.extractedSchedulers,
    steps: image.steps,
    cfgScale: image.cfgScale,
    seed: image.seed,
    positivePrompt: image.positivePrompt,
    negativePrompt: image.negativePrompt,
    collectionIds: image.collectionIds,
  };
}

/**
 * Parse comma-separated string into array
 */
function parseCommaSeparated(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parse aspect ratios parameter
 */
function parseAspectRatios(
  value: string | null,
): ("portrait" | "landscape" | "square")[] {
  if (!value) return [];
  const values = parseCommaSeparated(value);
  const valid: ("portrait" | "landscape" | "square")[] = [];
  for (const v of values) {
    if (v === "portrait" || v === "landscape" || v === "square") {
      valid.push(v);
    }
  }
  return valid;
}

/**
 * Parse file formats parameter
 */
function parseFileFormats(value: string | null): ("PNG" | "JPG" | "WebP")[] {
  if (!value) return [];
  const values = parseCommaSeparated(value);
  const valid: ("PNG" | "JPG" | "WebP")[] = [];
  for (const v of values) {
    const upper = v.toUpperCase();
    if (upper === "PNG" || upper === "JPG" || upper === "WEBP") {
      valid.push((upper === "WEBP" ? "WebP" : upper) as "PNG" | "JPG" | "WebP");
    }
  }
  return valid;
}

export const GET: RequestHandler = async ({ url }) => {
  // Parse pagination params
  const pageSize = parseInt(url.searchParams.get("page_size") || "50");
  const cursorStr = url.searchParams.get("cursor");
  const direction = (url.searchParams.get("direction") || "next") as
    | "next"
    | "prev";

  // Parse sort param
  const sortParam = url.searchParams.get("sort");
  const sort = mapSortParam(sortParam);

  // Build pagination options
  const pagination: PaginationOptions = {
    pageSize,
    cursor: parseCursor(cursorStr),
    direction,
  };

  // Parse filter params and build FilterCriteria
  const filters: FilterCriteria = {};

  // User marks filter
  const ratingMin = url.searchParams.get("rating_min");
  const ratingMax = url.searchParams.get("rating_max");
  const colorLabel = url.searchParams.get("color_label");
  const flag = url.searchParams.get("flag");
  const tagFilter = url.searchParams.get("tag");

  if (
    ratingMin !== null ||
    ratingMax !== null ||
    colorLabel !== null ||
    flag !== null ||
    tagFilter !== null
  ) {
    filters.user = {};

    if (ratingMin !== null) {
      filters.user.ratingMin = parseInt(ratingMin);
    }
    if (ratingMax !== null) {
      filters.user.ratingMax = parseInt(ratingMax);
    }
    if (colorLabel !== null) {
      filters.user.colorLabels = [colorLabel];
    }
    if (flag !== null) {
      filters.user.flags = [flag];
    }
    if (tagFilter !== null) {
      // Look up tag by name for backward compatibility
      const tagId = await lookupTagIdByName(tagFilter);
      if (tagId !== null) {
        filters.user.tagIds = [tagId];
      }
    }
  }

  // Text search filter (backward compat: "search" maps to positivePrompt)
  const searchQuery = url.searchParams.get("search");
  const positivePrompt = url.searchParams.get("positive_prompt");
  const negativePrompt = url.searchParams.get("negative_prompt");

  if (
    searchQuery !== null ||
    positivePrompt !== null ||
    negativePrompt !== null
  ) {
    filters.text = {};
    if (searchQuery !== null) {
      filters.text.positivePrompt = searchQuery;
    }
    if (positivePrompt !== null) {
      filters.text.positivePrompt = positivePrompt;
    }
    if (negativePrompt !== null) {
      filters.text.negativePrompt = negativePrompt;
    }
  }

  // Collection filter
  const collectionId = url.searchParams.get("collection_id");
  if (collectionId !== null) {
    const cid = parseInt(collectionId);
    if (!isNaN(cid)) {
      filters.collection = { collectionId: cid };
    }
  }

  // Folder filter (path_prefix)
  const pathPrefix = url.searchParams.get("path_prefix");
  if (pathPrefix !== null) {
    filters.folder = { pathPrefix };
  }

  // Generation params filter (models, loras, samplers, schedulers, steps, cfg, seed)
  const models = parseCommaSeparated(url.searchParams.get("models"));
  const loras = parseCommaSeparated(url.searchParams.get("loras"));
  const samplers = parseCommaSeparated(url.searchParams.get("samplers"));
  const schedulers = parseCommaSeparated(url.searchParams.get("schedulers"));
  const stepsMin = url.searchParams.get("steps_min");
  const stepsMax = url.searchParams.get("steps_max");
  const cfgMin = url.searchParams.get("cfg_min");
  const cfgMax = url.searchParams.get("cfg_max");
  const seed = url.searchParams.get("seed");

  if (
    models.length > 0 ||
    loras.length > 0 ||
    samplers.length > 0 ||
    schedulers.length > 0 ||
    stepsMin !== null ||
    stepsMax !== null ||
    cfgMin !== null ||
    cfgMax !== null ||
    seed !== null
  ) {
    filters.generation = {};

    if (models.length > 0) {
      filters.generation.models = models;
    }
    if (loras.length > 0) {
      filters.generation.loras = loras;
    }
    if (samplers.length > 0) {
      filters.generation.samplers = samplers;
    }
    if (schedulers.length > 0) {
      filters.generation.schedulers = schedulers;
    }
    if (stepsMin !== null) {
      filters.generation.stepsMin = parseInt(stepsMin);
    }
    if (stepsMax !== null) {
      filters.generation.stepsMax = parseInt(stepsMax);
    }
    if (cfgMin !== null) {
      filters.generation.cfgMin = parseFloat(cfgMin);
    }
    if (cfgMax !== null) {
      filters.generation.cfgMax = parseFloat(cfgMax);
    }
    if (seed !== null) {
      filters.generation.seed = seed;
    }
  }

  // Properties filter (width, height, aspect ratios, file formats, has alpha)
  const widthMin = url.searchParams.get("width_min");
  const widthMax = url.searchParams.get("width_max");
  const heightMin = url.searchParams.get("height_min");
  const heightMax = url.searchParams.get("height_max");
  const aspectRatios = parseAspectRatios(url.searchParams.get("aspect_ratios"));
  const fileFormats = parseFileFormats(url.searchParams.get("file_formats"));
  const hasAlpha = url.searchParams.get("has_alpha");

  if (
    widthMin !== null ||
    widthMax !== null ||
    heightMin !== null ||
    heightMax !== null ||
    aspectRatios.length > 0 ||
    fileFormats.length > 0 ||
    hasAlpha !== null
  ) {
    filters.properties = {};

    if (widthMin !== null) {
      filters.properties.widthMin = parseInt(widthMin);
    }
    if (widthMax !== null) {
      filters.properties.widthMax = parseInt(widthMax);
    }
    if (heightMin !== null) {
      filters.properties.heightMin = parseInt(heightMin);
    }
    if (heightMax !== null) {
      filters.properties.heightMax = parseInt(heightMax);
    }
    if (aspectRatios.length > 0) {
      filters.properties.aspectRatios = aspectRatios;
    }
    if (fileFormats.length > 0) {
      filters.properties.fileFormats = fileFormats;
    }
    if (hasAlpha !== null) {
      filters.properties.hasAlpha = hasAlpha === "true" || hasAlpha === "1";
    }
  }

  // Query the database
  const result = await galleryQueryService.query(filters, sort, pagination);

  // Map results to frontend-compatible format
  const images = result.images.map(mapToFrontendFormat);

  // Return in the format the frontend expects
  // For backward compatibility, include both "page" (derived) and cursor info
  return json({
    images,
    total: result.total,
    pageSize: result.pageSize,
    hasMore: result.hasMore,
    hasLess: result.hasLess,
    nextCursor: result.nextCursor,
    prevCursor: result.prevCursor,
  });
};
