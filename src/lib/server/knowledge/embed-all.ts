import { db, sqlite } from "../db";
import { artConcepts } from "../db/schema";
import { isNull, eq, and } from "drizzle-orm";
import { generateEmbeddings } from "./embedding";
import { startSync, updateProgress, finishSync, failSync } from "./sync-status";

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

    for (let i = 0; i < texts.length; i += B) {
      const batch = texts.slice(i, i + B);
      const names = rows.slice(i, i + B).map((r) => r.name);
      const embeddings = await generateEmbeddings(batch);
      const insertStmt = sqlite.prepare(
        "INSERT OR REPLACE INTO vec_concepts (id, embedding) VALUES (?, ?)",
      );
      for (let j = 0; j < embeddings.length; j++) {
        const name = names[j];
        const vec = new Float32Array(embeddings[j]);
        const blob = Buffer.from(vec.buffer);
        insertStmt.run(name, blob);
        await db
          .update(artConcepts)
          .set({ embedding: JSON.stringify(embeddings[j]) })
          .where(eq(artConcepts.name, name));
      }
      updateProgress({ done: Math.min(i + B, texts.length) });
    }

    finishSync();
    return { done: texts.length, total: texts.length };
  } catch (e: any) {
    failSync(e.message);
    throw e;
  }
}
