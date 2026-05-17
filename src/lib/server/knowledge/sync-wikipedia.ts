import { db } from "../db";
import { artConcepts } from "../db/schema";
import { eq, or } from "drizzle-orm";
import { generateEmbeddings } from "./embedding";
import { startSync, updateProgress, finishSync, failSync } from "./sync-status";

// Wikipedia 分类 → 维度映射
const WIKIPEDIA_CATEGORY_MAPPING: Record<
  string,
  { category: string; subCategory: string }
> = {
  "Category:Photographic_techniques": {
    category: "technical",
    subCategory: "photography",
  },
  "Category:Photographic_lighting": {
    category: "lighting",
    subCategory: "photographic",
  },
  "Category:Composition_in_visual_art": {
    category: "composition",
    subCategory: "",
  },
  "Category:Color": { category: "color", subCategory: "" },
  "Category:Color_theory": { category: "color", subCategory: "theory" },
  "Category:Painting_techniques": {
    category: "technical",
    subCategory: "painting",
  },
  "Category:Art_movements": { category: "style", subCategory: "" },
  "Category:Art_genres": { category: "style", subCategory: "genre" },
  "Category:Visual_arts_media": { category: "texture", subCategory: "media" },
  "Category:Artistic_techniques": { category: "technical", subCategory: "" },
  "Category:Light": { category: "lighting", subCategory: "natural" },
  "Category:Perspective_(graphical)": {
    category: "composition",
    subCategory: "perspective",
  },
};

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const DELAY_MS = 200;

interface WikiPage {
  pageid: number;
  title: string;
  extract: string;
}

async function getCategoryMembers(categoryTitle: string): Promise<string[]> {
  const members: string[] = [];
  let cmcontinue: string | undefined;

  do {
    const params = new URLSearchParams({
      action: "query",
      list: "categorymembers",
      cmtitle: categoryTitle,
      cmtype: "page",
      cmlimit: "500",
      format: "json",
      origin: "*",
    });
    if (cmcontinue) params.set("cmcontinue", cmcontinue);

    const res = await fetch(`${WIKIPEDIA_API}?${params}`);
    const data = await res.json();
    const cm = data.query?.categorymembers || [];
    for (const m of cm) members.push(m.title);
    cmcontinue = data.continue?.cmcontinue;
  } while (cmcontinue);

  return members;
}

async function getPageSummary(title: string): Promise<WikiPage | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url);

  if (res.status === 404) return null;
  if (!res.ok)
    throw new Error(`Wikipedia API error for ${title}: ${res.status}`);

  const data = await res.json();
  return {
    pageid: data.pageid,
    title: data.title,
    extract: data.extract || "",
  };
}

async function getChineseTitle(enTitle: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    prop: "langlinks",
    titles: enTitle,
    lllang: "zh",
    llprop: "autonym",
    format: "json",
    origin: "*",
  });

  const res = await fetch(`${WIKIPEDIA_API}?${params}`);
  const data = await res.json();
  const pages = data.query?.pages || {};
  for (const page of Object.values(pages) as any[]) {
    const ll = page.langlinks;
    if (ll && ll.length > 0) return ll[0]["*"];
  }
  return null;
}

export async function syncWikipedia(): Promise<{
  inserted: number;
  skipped: number;
}> {
  if (!startSync("wikipedia")) {
    throw new Error("Sync already in progress");
  }

  try {
    let inserted = 0;
    let skipped = 0;
    const embeddingTargets: string[] = [];

    const categoryEntries = Object.entries(WIKIPEDIA_CATEGORY_MAPPING);
    updateProgress({
      stage: "downloading",
      total: categoryEntries.length,
      done: 0,
    });

    for (let ci = 0; ci < categoryEntries.length; ci++) {
      const [wikiCat, mapping] = categoryEntries[ci];
      console.log(`Processing: ${wikiCat}`);

      const titles = await getCategoryMembers(wikiCat);

      for (const title of titles) {
        if (
          title.startsWith("List of") ||
          title.startsWith("Glossary of") ||
          title.startsWith("Outline of") ||
          title.startsWith("Index of")
        ) {
          skipped++;
          continue;
        }

        const summary = await getPageSummary(title);
        if (!summary || !summary.extract) {
          skipped++;
          continue;
        }

        const nameZh = await getChineseTitle(title);

        const existing = await db
          .select({
            id: artConcepts.id,
            source: artConcepts.source,
            visualDescription: artConcepts.visualDescription,
          })
          .from(artConcepts)
          .where(eq(artConcepts.name, title));

        const data = {
          name: title,
          nameZh: nameZh || null,
          category: mapping.category,
          subCategory: mapping.subCategory || null,
          visualDescription: summary.extract,
          source: "wikipedia" as const,
          sourceId: String(summary.pageid),
        };

        if (existing.length > 0) {
          const old = existing[0];
          const oldSource = old.source || "";
          const newSource = oldSource.includes("wikipedia")
            ? oldSource
            : `${oldSource}+wikipedia`;

          await db
            .update(artConcepts)
            .set({
              ...data,
              source: newSource,
              visualDescription: oldSource.includes("aat")
                ? old.visualDescription
                : summary.extract,
            })
            .where(eq(artConcepts.id, old.id));

          skipped++;
          embeddingTargets.push(title);
        } else {
          await db.insert(artConcepts).values(data);
          inserted++;
          embeddingTargets.push(title);
        }

        await new Promise((r) => setTimeout(r, DELAY_MS));
      }

      updateProgress({ done: ci + 1 });
    }

    updateProgress({ stage: "importing" });

    // 批量生成 embedding（仅处理本次同步涉及的条目）
    if (embeddingTargets.length > 0) {
      updateProgress({ stage: "embedding" });
      const rows = await db
        .select({
          name: artConcepts.name,
          visualDescription: artConcepts.visualDescription,
        })
        .from(artConcepts)
        .where(or(...embeddingTargets.map((n) => eq(artConcepts.name, n))));

      const texts = rows.map((c) => c.visualDescription || "");
      if (texts.length > 0) {
        const embeddings = await generateEmbeddings(texts);
        for (let i = 0; i < rows.length; i++) {
          await db
            .update(artConcepts)
            .set({ embedding: JSON.stringify(embeddings[i]) })
            .where(eq(artConcepts.name, rows[i].name));
        }
      }
    }

    finishSync();
    return { inserted, skipped };
  } catch (e: any) {
    failSync(e.message);
    throw e;
  }
}
