import { db, sqlite } from "../db";
import {
  artConcepts,
  artPatterns,
  artReferences,
  danbooruTags,
} from "../db/schema";
import { isNull, eq, and } from "drizzle-orm";
import { generateEmbeddings } from "./embedding";
import { startSync, updateProgress, finishSync, failSync } from "./sync-status";

type Target = "concepts" | "patterns" | "references" | "danbooru";

const TABLE_MAP = {
  concepts: artConcepts,
  patterns: artPatterns,
  references: artReferences,
  danbooru: danbooruTags,
} as const;

const TABLE_NAMES: Record<Target, string> = {
  concepts: "art_concepts",
  patterns: "art_patterns",
  references: "art_references",
  danbooru: "danbooru_tags",
};

function vecTable(target: Target) {
  return `vec_${target}`;
}

function buildText(r: Record<string, any>, target: Target): string {
  switch (target) {
    case "concepts":
      return `${r.visualDescription || ""} ${r.name} ${r.nameZh || ""}`;
    case "patterns":
      return `${r.intent || ""} ${r.name}`;
    case "references":
      return `${r.intent || ""} ${r.name} ${r.positivePrompt || ""}`;
    case "danbooru":
      return `${r.name} ${stripWikiMarkup((r.body as string) || "").slice(0, 300)}`;
  }
}

function stripWikiMarkup(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\{\{([^}]+)\}\}/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^[#]+\s*/gm, "")
    .replace(/^h[1-6]\.\s*/gm, "")
    .replace(/\[\[|\]\]/g, "")
    .replace(/\[b\]|\[\/b\]|\[i\]|\[\/i\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function embedTarget(target: Target) {
  if (!startSync("embedding")) {
    throw new Error("Embedding already in progress");
  }

  const table = TABLE_MAP[target];
  const vec = vecTable(target);

  try {
    const rows = await db
      .select()
      .from(table as any)
      .where(isNull((table as any).embedding));

    if (rows.length === 0) {
      finishSync();
      return { done: 0, total: 0 };
    }

    updateProgress({ stage: "embedding", total: rows.length, done: 0 });

    const texts = rows.map((r) => buildText(r as any, target));
    const B = 20;

    const insertStmt = sqlite.prepare(
      `INSERT OR REPLACE INTO ${vec} (id, embedding) VALUES (?, ?)`,
    );

    const flagStmt = sqlite.prepare(
      `UPDATE ${TABLE_NAMES[target]} SET embedding = '1' WHERE name = ?`,
    );

    for (let i = 0; i < texts.length; i += B) {
      const batch = texts.slice(i, i + B);
      const batchRows = rows.slice(i, i + B);
      const embeddings = await generateEmbeddings(batch);

      if (embeddings.length !== batchRows.length) {
        throw new Error(
          `API returned ${embeddings.length} embeddings for ${batchRows.length} inputs`,
        );
      }

      const tx = sqlite.transaction(() => {
        for (let j = 0; j < embeddings.length; j++) {
          const row = batchRows[j] as any;
          const vecArr = new Float32Array(embeddings[j]);
          const blob = Buffer.from(vecArr.buffer);
          insertStmt.run(row.name, blob);
          flagStmt.run(row.name);
        }
      });

      tx();
      updateProgress({ done: Math.min(i + B, texts.length) });
    }

    finishSync();
    return { done: texts.length, total: texts.length };
  } catch (e: any) {
    failSync(e.message);
    throw e;
  }
}

// Backward-compatible: embed only concepts with optional dimension/name filter
export async function embedAll(dimension?: string, name?: string) {
  if (!startSync("embedding")) throw new Error("Embedding already in progress");

  try {
    const conditions = [isNull(artConcepts.embedding)];
    if (dimension) conditions.push(eq(artConcepts.category, dimension));
    if (name) conditions.push(eq(artConcepts.name, name));

    const rows = await db
      .select({
        name: artConcepts.name,
        visualDescription: artConcepts.visualDescription,
        nameZh: artConcepts.nameZh,
      })
      .from(artConcepts)
      .where(and(...conditions));

    if (rows.length === 0) {
      finishSync();
      return { done: 0, total: 0 };
    }

    updateProgress({ stage: "embedding", total: rows.length, done: 0 });

    const texts = rows.map(
      (r) => `${r.visualDescription || ""} ${r.name} ${r.nameZh || ""}`,
    );
    const B = 20;

    const insertStmt = sqlite.prepare(
      "INSERT OR REPLACE INTO vec_concepts (id, embedding) VALUES (?, ?)",
    );

    const flagStmt = sqlite.prepare(
      "UPDATE art_concepts SET embedding = '1' WHERE name = ?",
    );

    for (let i = 0; i < texts.length; i += B) {
      const batch = texts.slice(i, i + B);
      const batchRows = rows.slice(i, i + B);
      const embeddings = await generateEmbeddings(batch);

      if (embeddings.length !== batchRows.length) {
        throw new Error(
          `API returned ${embeddings.length} embeddings for ${batchRows.length} inputs`,
        );
      }

      const tx = sqlite.transaction(() => {
        for (let j = 0; j < embeddings.length; j++) {
          const row = batchRows[j];
          const vecArr = new Float32Array(embeddings[j]);
          const blob = Buffer.from(vecArr.buffer);
          insertStmt.run(row.name, blob);
          flagStmt.run(row.name);
        }
      });

      tx();
      updateProgress({ done: Math.min(i + B, texts.length) });
    }

    finishSync();
    return { done: texts.length, total: texts.length };
  } catch (e: any) {
    failSync(e.message);
    throw e;
  }
}
