import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { artConcepts, artPatterns, artReferences } from "$lib/server/db/schema";
import { eq, like, or, and, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  generateEmbedding,
  cosineSimilarity,
} from "$lib/server/knowledge/embedding";

export const GET: RequestHandler = async ({ url }) => {
  const category = url.searchParams.get("category");
  const search = url.searchParams.get("search");
  const mode = url.searchParams.get("mode") || "keyword";
  const subCategory = url.searchParams.get("subCategory");

  if (mode === "semantic" && search) {
    const queryEmbedding = await generateEmbedding(search);

    const conditions_semantic: SQL[] = [];
    if (category) {
      conditions_semantic.push(eq(artConcepts.category, category));
    }

    const baseQuery = db
      .select({
        name: artConcepts.name,
        nameZh: artConcepts.nameZh,
        category: artConcepts.category,
        subCategory: artConcepts.subCategory,
        visualDescription: artConcepts.visualDescription,
        embedding: artConcepts.embedding,
      })
      .from(artConcepts);

    const all = await (conditions_semantic.length > 0
      ? baseQuery.where(and(...conditions_semantic))
      : baseQuery);

    const results = all
      .filter((c) => c.embedding)
      .map((c) => ({
        name: c.name,
        nameZh: c.nameZh,
        category: c.category,
        subCategory: c.subCategory,
        snippet: (c.visualDescription || "").slice(0, 150),
        hasEmbedding: c.embedding ? 1 : 0,
        score: cosineSimilarity(queryEmbedding, JSON.parse(c.embedding!)),
      }))
      .sort((a, b) => b.score - a.score)
      .filter((c) => c.score > 0.5)
      .slice(0, 20);

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

  const rows = await query_
    .orderBy(artConcepts.category, artConcepts.subCategory, artConcepts.name)
    .limit(100);

  const grouped: Record<string, typeof rows> = {};
  for (const r of rows) {
    const sub = r.subCategory || "other";
    if (!grouped[sub]) grouped[sub] = [];
    grouped[sub].push(r);
  }

  return json(
    Object.entries(grouped).map(([sub, items]) => ({
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
  );
};

export const DELETE: RequestHandler = async () => {
  await db.delete(artReferences);
  await db.delete(artPatterns);
  await db.delete(artConcepts);
  return json({ ok: true });
};
