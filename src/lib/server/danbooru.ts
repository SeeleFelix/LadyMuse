const BASE_URL = "https://danbooru.donmai.us";
const TIMEOUT = 15000;
const RATE_LIMIT_MS = 1100; // ~1 req/s to stay under 500/hr

let lastRequestTime = 0;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function rateLimitedFetch(url: string, retries = 3): Promise<any> {
  // Enforce rate limit
  const elapsed = Date.now() - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - elapsed);
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) await sleep(2000 * Math.pow(2, attempt - 1));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT);
      lastRequestTime = Date.now();
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timer);
      if (res.status === 429) {
        if (attempt === retries) throw new Error("Danbooru rate limited");
        await sleep(5000);
        continue;
      }
      if (!res.ok)
        throw new Error(`Danbooru HTTP ${res.status}: ${res.statusText}`);
      return await res.json();
    } catch (e: any) {
      if (attempt === retries) throw e;
    }
  }
}

// --- Interfaces ---

export interface DanbooruTagGroup {
  section: string;
  tags: string[];
}

export interface DanbooruTag {
  name: string;
  postCount: number;
  category: number;
  description: string | null;
}

// category mapping
const TAG_CATEGORIES: Record<number, string> = {
  0: "general",
  1: "artist",
  3: "copyright",
  4: "character",
  5: "meta",
};

// --- API Functions ---

/**
 * Fetch a tag group wiki page and parse it into sections with tag names.
 * Tag group wiki pages use markdown with ## headings and tag links.
 */
export async function fetchTagGroup(
  topic: string,
): Promise<DanbooruTagGroup[]> {
  const wikiTitle = `tag_group:${topic}`;
  const data = await rateLimitedFetch(
    `${BASE_URL}/wiki_pages/${encodeURIComponent(wikiTitle)}.json`,
  );

  if (!data?.body) return [];

  return parseTagGroupWiki(data.body);
}

/**
 * Fetch post_count for a batch of tag names.
 * Returns a map of tagName → postCount.
 */
export async function fetchTagCounts(
  tagNames: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  // Danbooru allows searching multiple tags with comma-separated names
  // But it's more reliable to batch in groups of 20
  const batchSize = 20;
  for (let i = 0; i < tagNames.length; i += batchSize) {
    const batch = tagNames.slice(i, i + batchSize);
    for (const name of batch) {
      try {
        const data = await rateLimitedFetch(
          `${BASE_URL}/tags.json?search[name]=${encodeURIComponent(name)}&search[hide_empty]=true&limit=1`,
        );
        if (Array.isArray(data) && data.length > 0) {
          result.set(name, data[0].post_count ?? 0);
        }
      } catch {
        // Skip individual failures
      }
    }
  }

  return result;
}

/**
 * Fetch the wiki page for a single tag, returning its description text.
 */
export async function fetchTagWiki(tagName: string): Promise<string | null> {
  try {
    const data = await rateLimitedFetch(
      `${BASE_URL}/wiki_pages/${encodeURIComponent(tagName)}.json`,
    );
    if (!data?.body) return null;
    // Strip wiki markup, return plain text
    return stripWikiMarkup(data.body);
  } catch {
    return null;
  }
}

// --- Wiki Parsing ---

/**
 * Parse a tag group wiki page into structured sections.
 * Wiki format uses ## Headings followed by lists of tag links like:
 * - [tag_name](/posts?tags=tag_name) or {{tag_name}}
 */
function parseTagGroupWiki(body: string): DanbooruTagGroup[] {
  const groups: DanbooruTagGroup[] = [];
  let currentSection = "";
  let currentTags: string[] = [];

  const lines = body.split("\n");

  for (const line of lines) {
    // Detect section headers: ## Section Name or h2. Section Name
    const headerMatch =
      line.match(/^#{1,3}\s+(.+)/) ||
      line.match(/^h[1-6](?:#[\w-]+)?\.\s*(.+)/);
    if (headerMatch) {
      if (currentTags.length > 0 || currentSection) {
        groups.push({ section: currentSection, tags: currentTags });
      }
      currentSection = headerMatch[1].trim();
      currentTags = [];
      continue;
    }

    // Extract tag names from various link formats
    // Format 1: [[tag_name]] — Danbooru DText wiki links (primary format)
    // Format 2: [tag_name](/posts?tags=tag_name) — markdown links
    // Format 3: {{tag_name}} — wiki syntax
    // Format 4: **tag_name** — bold text
    const bracketMatches = line.matchAll(/\[\[([^\]]+)\]\]/g);
    for (const m of bracketMatches) {
      const tag = m[1].trim().toLowerCase().replace(/\s+/g, "_");
      if (tag && !tag.startsWith("tag_group") && !currentTags.includes(tag)) {
        currentTags.push(tag);
      }
    }

    const linkMatches = line.matchAll(/\[([^\]]+)\]\([^)]*tags[^)]*\)/g);
    for (const m of linkMatches) {
      const tag = m[1].trim().toLowerCase().replace(/\s+/g, "_");
      if (tag && !tag.startsWith("tag_group") && !currentTags.includes(tag)) {
        currentTags.push(tag);
      }
    }

    const wikiMatches = line.matchAll(/\{\{([^}]+)\}\}/g);
    for (const m of wikiMatches) {
      const tag = m[1].trim().toLowerCase().replace(/\s+/g, "_");
      if (tag && !tag.startsWith("tag_group") && !currentTags.includes(tag)) {
        currentTags.push(tag);
      }
    }

    const boldMatches = line.matchAll(/\*\*([^*]+)\*\*/g);
    for (const m of boldMatches) {
      const raw = m[1].trim();
      // Only if it looks like a tag (lowercase, no spaces or underscores)
      if (raw && /^[a-z0-9_()]+$/.test(raw) && !raw.startsWith("tag_group")) {
        const tag = raw.toLowerCase().replace(/\s+/g, "_");
        if (!currentTags.includes(tag)) {
          currentTags.push(tag);
        }
      }
    }
  }

  // Push last section
  if (currentTags.length > 0) {
    groups.push({ section: currentSection, tags: currentTags });
  }

  return groups;
}

/**
 * Strip Danbooru wiki markup to get plain text.
 */
function stripWikiMarkup(text: string): string {
  return text
    .replace(/\[([^]]+)\]\([^)]+\)/g, "$1") // markdown links → text
    .replace(/\{\{([^}]+)\}\}/g, "$1") // {{wiki}} → text
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **bold** → text
    .replace(/^[#]+\s+/gm, "") // headers
    .replace(/^h[1-6]\.\s*/gm, "") // Redmine headers
    .replace(/\n{3,}/g, "\n\n") // collapse multiple blank lines
    .trim()
    .slice(0, 1000); // Cap description length
}

// --- Topic Mapping ---

export const TAG_GROUP_TOPICS = {
  lighting: "lighting",
  composition: "image_composition",
  posture: "posture",
  colors: "colors",
  aesthetic: "visual_aesthetic",
  background: "backgrounds",
  gestures: "gestures",
  focus: "focus_tags",
} as const;

export type DanbooruTopic = keyof typeof TAG_GROUP_TOPICS;
