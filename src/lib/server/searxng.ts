const TIMEOUT = 15000;

async function fetchWithRetry(url: string, retries = 1): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
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

export interface SearXNGResult {
  title: string;
  url: string;
  content: string;
  engine?: string;
  score?: number;
}

export async function searxngSearch(
  query: string,
  baseUrl: string,
  options?: {
    language?: string;
    categories?: string;
    pageno?: number;
  },
): Promise<{ results: SearXNGResult[] }> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
  });
  if (options?.language) params.set("language", options.language);
  if (options?.categories) params.set("categories", options.categories);
  if (options?.pageno) params.set("pageno", String(options.pageno));

  const base = baseUrl.replace(/\/+$/, "");
  const data = await fetchWithRetry(`${base}/search?${params.toString()}`);

  return {
    results: (data.results || []).map((r: any) => ({
      title: r.title,
      url: r.url,
      content: r.content || "",
      engine: r.engine,
      score: r.score,
    })),
  };
}
