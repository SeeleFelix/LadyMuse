import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db, sqlite } from "$lib/server/db";
import { artConcepts, artPatterns, artReferences } from "$lib/server/db/schema";
import { eq, like, or, and, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { generateEmbedding } from "$lib/server/knowledge/embedding";

export const GET: RequestHandler = async ({ url }) => {
  const category = url.searchParams.get("category");
  const search = url.searchParams.get("search");
  const mode = url.searchParams.get("mode") || "keyword";
  const subCategory = url.searchParams.get("subCategory");
  const limit = parseInt(url.searchParams.get("limit") || "500");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  if (mode === "semantic" && search) {
    const queryEmbedding = await generateEmbedding(search);
    const vec = new Float32Array(queryEmbedding);
    const blob = Buffer.from(vec.buffer);

    const rows = sqlite
      .prepare(
        `SELECT v.id, v.distance
         FROM vec_concepts v
         WHERE v.embedding MATCH ? AND k = ?
         ORDER BY v.distance
         LIMIT 20`,
      )
      .all(blob, 20) as { id: string; distance: number }[];

    if (rows.length === 0) {
      return json([]);
    }

    const scoreMap = new Map(rows.map((r) => [r.id, 1 - r.distance]));
    const names = rows.map((r) => r.id);
    const semConds = [or(...names.map((n) => eq(artConcepts.name, n)))];
    if (category) semConds.push(eq(artConcepts.category, category));

    const concepts = await db
      .select({
        name: artConcepts.name,
        nameZh: artConcepts.nameZh,
        category: artConcepts.category,
        subCategory: artConcepts.subCategory,
        visualDescription: artConcepts.visualDescription,
        embedding: artConcepts.embedding,
      })
      .from(artConcepts)
      .where(and(...semConds));

    const results = concepts
      .map((c) => ({
        name: c.name,
        nameZh: c.nameZh,
        category: c.category,
        subCategory: c.subCategory,
        snippet: (c.visualDescription || "").slice(0, 150),
        hasEmbedding: c.embedding ? 1 : 0,
        score: scoreMap.get(c.name) ?? 0,
      }))
      .filter((c) => c.score > 0.5)
      .sort((a, b) => b.score - a.score);

    return json(results);
  }

  const conditions: SQL[] = [];
  if (category) {
    conditions.push(eq(artConcepts.category, category));
  }
  if (subCategory) {
    conditions.push(eq(artConcepts.subCategory, subCategory));
  }
  if (search) {
    const q = `%${search}%`;
    const searchOr = or(
      like(artConcepts.name, q),
      like(artConcepts.nameZh, q),
      like(artConcepts.visualDescription, q),
      like(artConcepts.tags, q),
    );
    if (searchOr) {
      conditions.push(searchOr);
    }
  }

  const baseQuery = db
    .select({
      name: artConcepts.name,
      nameZh: artConcepts.nameZh,
      category: artConcepts.category,
      subCategory: artConcepts.subCategory,
      visualDescription: artConcepts.visualDescription,
      tags: artConcepts.tags,
      embedding: artConcepts.embedding,
    })
    .from(artConcepts);

  const query_ =
    conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

  // Get total count for pagination
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(artConcepts)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const rows = await query_
    .orderBy(artConcepts.category, artConcepts.subCategory, artConcepts.name)
    .limit(limit)
    .offset(offset);

  const grouped: Record<string, typeof rows> = {};
  for (const r of rows) {
    const sub = r.subCategory || "other";
    if (!grouped[sub]) grouped[sub] = [];
    grouped[sub].push(r);
  }

  return json({
    total: countRow?.count ?? 0,
    groups: Object.entries(grouped).map(([sub, items]) => ({
      subCategory: sub,
      concepts: items.map((r) => ({
        name: r.name,
        nameZh: r.nameZh,
        category: r.category,
        subCategory: r.subCategory,
        snippet: (r.visualDescription || "").slice(0, 150),
        tags: r.tags ? JSON.parse(r.tags) : [],
        hasEmbedding: r.embedding ? 1 : 0,
      })),
    })),
  });
};

export const DELETE: RequestHandler = async () => {
  await db.delete(artReferences);
  await db.delete(artPatterns);
  await db.delete(artConcepts);
  return json({ ok: true });
};
