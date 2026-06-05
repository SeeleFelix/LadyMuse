import type {
  FilterCriteria,
  SortOption,
  ImageResult,
  Cursor,
} from "$lib/stores/gallery-store.svelte";

export interface QueryResult {
  images: ImageResult[];
  total: number;
  pageSize: number;
  hasMore: boolean;
  hasLess: boolean;
  nextCursor: Cursor | null;
  prevCursor: Cursor | null;
}

interface ApiResult<T> {
  data: T | null;
  error: string | null;
}

export class GalleryAPI {
  async query(
    filters: FilterCriteria,
    sort: SortOption,
    pagination: {
      pageSize: number;
      cursor?: Cursor | null;
      direction?: "next" | "prev";
    },
  ): Promise<QueryResult> {
    const params = new URLSearchParams();
    params.set("page_size", String(pagination.pageSize));
    if (pagination.cursor) {
      params.set("cursor", JSON.stringify(pagination.cursor));
    }
    if (pagination.direction) {
      params.set("direction", pagination.direction);
    }
    params.set("sort", `${sort.field}-${sort.direction}`);

    // Add filters as query params
    if (filters.generation?.models?.length)
      params.set("models", filters.generation.models.join(","));
    if (filters.generation?.loras?.length)
      params.set("loras", filters.generation.loras.join(","));
    if (filters.generation?.stepsMin !== undefined)
      params.set("steps_min", String(filters.generation.stepsMin));
    if (filters.generation?.stepsMax !== undefined)
      params.set("steps_max", String(filters.generation.stepsMax));
    if (filters.generation?.cfgMin !== undefined)
      params.set("cfg_min", String(filters.generation.cfgMin));
    if (filters.generation?.cfgMax !== undefined)
      params.set("cfg_max", String(filters.generation.cfgMax));
    if (filters.generation?.seed) params.set("seed", filters.generation.seed);

    if (filters.user?.ratingMin !== undefined)
      params.set("rating_min", String(filters.user.ratingMin));
    if (filters.user?.ratingMax !== undefined)
      params.set("rating_max", String(filters.user.ratingMax));
    if (filters.user?.colorLabels?.length)
      params.set("color_label", filters.user.colorLabels[0]);
    if (filters.user?.flags?.length) params.set("flag", filters.user.flags[0]);

    if (filters.text?.positivePrompt)
      params.set("positive_prompt", filters.text.positivePrompt);
    if (filters.text?.negativePrompt)
      params.set("negative_prompt", filters.text.negativePrompt);
    if (filters.folder?.pathPrefix)
      params.set("path_prefix", filters.folder.pathPrefix);
    if (filters.collection?.collectionId)
      params.set("collection_id", String(filters.collection.collectionId));

    if (filters.properties?.widthMin !== undefined)
      params.set("width_min", String(filters.properties.widthMin));
    if (filters.properties?.widthMax !== undefined)
      params.set("width_max", String(filters.properties.widthMax));
    if (filters.properties?.heightMin !== undefined)
      params.set("height_min", String(filters.properties.heightMin));
    if (filters.properties?.heightMax !== undefined)
      params.set("height_max", String(filters.properties.heightMax));
    if (filters.properties?.aspectRatios?.length)
      params.set("aspect_ratios", filters.properties.aspectRatios.join(","));
    if (filters.properties?.fileFormats?.length)
      params.set("file_formats", filters.properties.fileFormats.join(","));

    const res = await fetch(`/api/comfyui/browse?${params}`);
    if (!res.ok) throw new Error(`Query failed: ${res.statusText}`);
    return res.json();
  }

  async updateAttributes(
    path: string,
    updates: Record<string, unknown>,
  ): Promise<void> {
    const res = await fetch("/api/comfyui/attributes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relative_path: path, ...updates }),
    });
    if (!res.ok) throw new Error(`Update failed: ${res.statusText}`);
  }

  async getFilterOptions(): Promise<{
    models: string[];
    loras: string[];
    samplers: string[];
    schedulers: string[];
    colorLabels: string[];
    tags: { id: number; name: string; slug: string }[];
  }> {
    const res = await fetch("/api/comfyui/filter-options");
    if (!res.ok) throw new Error(`Filter options failed: ${res.statusText}`);
    return res.json();
  }
}

export const galleryAPI = new GalleryAPI();
