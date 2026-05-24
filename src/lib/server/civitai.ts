const BASE_URLS = ["https://civitai.red", "https://civitai.com"];
const TIMEOUT = 15000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, retries = 3): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) await sleep(800 * Math.pow(2, attempt - 1));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e: any) {
      if (attempt === retries) throw e;
    }
  }
}

async function fetchWithFallback(path: string): Promise<any> {
  let lastError: any;
  for (const base of BASE_URLS) {
    try {
      return await fetchWithRetry(`${base}${path}`);
    } catch (e: any) {
      lastError = e;
      continue;
    }
  }
  throw lastError;
}

// --- Types ---

export interface CivitaiImage {
  id: number;
  url?: string;
  width?: number;
  height?: number;
  baseModel?: string;
  username?: string;
  createdAt?: string;
  stats?: { likeCount?: number; commentCount?: number; heartCount?: number };
  meta?: {
    prompt?: string;
    negativePrompt?: string;
    sampler?: string;
    cfgScale?: number;
    steps?: number;
    seed?: number;
    Size?: string;
    resources?: { name: string; type: string }[];
    [key: string]: any;
  };
}

export interface CivitaiModel {
  id: number;
  name: string;
  type?: string;
  baseModel?: string;
  description?: string;
  tags?: string[];
  stats?: { downloadCount?: number; thumbsUpCount?: number };
}

interface PageResult<T> {
  items: T[];
  nextCursor?: string;
}

// --- Images API ---

export const IMAGE_SORT_OPTIONS = [
  "Most Reactions",
  "Most Comments",
  "Most Collected",
  "Newest",
  "Oldest",
] as const;

export const IMAGE_PERIOD_OPTIONS = [
  "AllTime",
  "Year",
  "Month",
  "Week",
  "Day",
] as const;

export interface SearchImagesParams {
  query?: string;
  sort?: (typeof IMAGE_SORT_OPTIONS)[number];
  period?: (typeof IMAGE_PERIOD_OPTIONS)[number];
  baseModels?: string;
  modelId?: number;
  username?: string;
  limit?: number;
  cursor?: string;
}

export async function searchImages(
  params: SearchImagesParams,
): Promise<PageResult<CivitaiImage>> {
  const p = new URLSearchParams();
  if (params.query) p.set("query", params.query);
  if (params.sort) p.set("sort", params.sort);
  if (params.period) p.set("period", params.period);
  if (params.baseModels) p.set("baseModels", params.baseModels);
  if (params.modelId != null) p.set("modelId", String(params.modelId));
  if (params.username) p.set("username", params.username);
  if (params.limit != null) p.set("limit", String(params.limit));
  if (params.cursor) p.set("cursor", params.cursor);

  const data = await fetchWithFallback(`/api/v1/images?${p.toString()}`);
  return {
    items: data.items || [],
    nextCursor: data.metadata?.nextCursor,
  };
}

// --- Models API ---

export const MODEL_SORT_OPTIONS = [
  "Highest Rated",
  "Most Downloaded",
  "Newest",
  "Most Liked",
] as const;

export const MODEL_PERIOD_OPTIONS = IMAGE_PERIOD_OPTIONS;

export interface SearchModelsParams {
  query: string;
  types?: string;
  baseModels?: string;
  sort?: (typeof MODEL_SORT_OPTIONS)[number];
  period?: (typeof MODEL_PERIOD_OPTIONS)[number];
  limit?: number;
}

export async function searchModels(
  params: SearchModelsParams,
): Promise<PageResult<CivitaiModel>> {
  const p = new URLSearchParams();
  if (params.query) p.set("query", params.query);
  if (params.types) p.set("types", params.types);
  if (params.baseModels) p.set("baseModels", params.baseModels);
  if (params.sort) p.set("sort", params.sort);
  if (params.period) p.set("period", params.period);
  if (params.limit != null) p.set("limit", String(params.limit));

  const data = await fetchWithFallback(`/api/v1/models?${p.toString()}`);
  const items = (data.items || []).map((m: any) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    baseModel: m.modelVersions?.[0]?.baseModel,
    description: m.description,
    tags: m.tags?.map((t: any) => (typeof t === "string" ? t : t.name)),
    stats: m.stats,
  }));
  return {
    items,
    nextCursor: data.metadata?.nextCursor,
  };
}
