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

export interface CivitaiModel {
  id: number;
  name: string;
  type?: string;
  baseModel?: string;
  description?: string;
  stats?: { downloadCount?: number; thumbsUpCount?: number };
  tags?: string[];
}

export interface CivitaiImage {
  id: number;
  url?: string;
  width?: number;
  height?: number;
  baseModel?: string;
  meta?: {
    prompt?: string;
    negativePrompt?: string;
    sampler?: string;
    cfgScale?: number;
    steps?: number;
    seed?: number;
    Size?: string;
    [key: string]: any;
  };
  stats?: { likeCount?: number };
}

export interface CivitaiTag {
  id: number;
  name: string;
  modelCount?: number;
}

interface PageResult<T> {
  items: T[];
  nextCursor?: string;
}

export async function searchModels(
  query: string,
  limit = 20,
  cursor?: string,
): Promise<PageResult<CivitaiModel>> {
  const params = new URLSearchParams({
    query,
    limit: String(limit),
  });
  if (cursor) params.set("cursor", cursor);

  const data = await fetchWithFallback(`/api/v1/models?${params.toString()}`);
  const items = (data.items || []).map((m: any) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    baseModel: m.baseModel,
    description: m.description,
    stats: m.stats,
    tags: m.tags?.map((t: any) => (typeof t === "string" ? t : t.name)),
  }));
  return {
    items,
    nextCursor: data.metadata?.nextCursor,
  };
}

export async function searchImages(
  query: string,
  limit = 20,
  cursor?: string,
): Promise<PageResult<CivitaiImage>> {
  const params = new URLSearchParams({
    query,
    limit: String(limit),
    sort: "Most Reactions",
  });
  if (cursor) params.set("cursor", cursor);

  const data = await fetchWithFallback(`/api/v1/images?${params.toString()}`);
  return {
    items: data.items || [],
    nextCursor: data.metadata?.nextCursor,
  };
}

export async function searchImagesWithFallback(
  query: string,
  limit = 30,
): Promise<{ items: CivitaiImage[]; fallback: boolean }> {
  // 1. Try full query
  let result = await searchImages(query, limit);
  if (result.items.length > 0) return { items: result.items, fallback: false };

  // 2. Try with first 2 words
  const words = query.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    result = await searchImages(words.slice(0, 2).join(" "), limit);
    if (result.items.length > 0) return { items: result.items, fallback: true };
  }

  // 3. Try with first word only
  if (words.length > 2) {
    result = await searchImages(words[0], limit);
    if (result.items.length > 0) return { items: result.items, fallback: true };
  }

  // 4. Fallback to popular images
  result = await fetchPopularImages(limit);
  return { items: result.items, fallback: true };
}

export async function fetchModelImages(
  modelId: number,
  limit = 20,
  cursor?: string,
): Promise<PageResult<CivitaiImage>> {
  const params = new URLSearchParams({
    modelId: String(modelId),
    limit: String(limit),
    sort: "Most Reactions",
  });
  if (cursor) params.set("cursor", cursor);

  const data = await fetchWithFallback(`/api/v1/images?${params.toString()}`);
  return {
    items: data.items || [],
    nextCursor: data.metadata?.nextCursor,
  };
}

export async function fetchPopularImages(
  limit = 20,
  cursor?: string,
): Promise<PageResult<CivitaiImage>> {
  const params = new URLSearchParams({
    limit: String(limit),
    sort: "Most Reactions",
  });
  if (cursor) params.set("cursor", cursor);

  const data = await fetchWithFallback(`/api/v1/images?${params.toString()}`);
  return {
    items: data.items || [],
    nextCursor: data.metadata?.nextCursor,
  };
}

export async function fetchTags(
  query: string,
  limit = 50,
): Promise<PageResult<CivitaiTag>> {
  const params = new URLSearchParams({
    query,
    limit: String(limit),
  });

  const data = await fetchWithFallback(`/api/v1/tags?${params.toString()}`);
  return {
    items: (data.items || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      modelCount: t.modelCount,
    })),
    nextCursor: data.metadata?.nextCursor,
  };
}
