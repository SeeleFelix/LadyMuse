import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { collections, collectionImages } from "$lib/server/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { BUILTIN_SMART_COLLECTIONS } from "$lib/server/smart-collections";

// GET: list all collections (seeds built-in smart collections on first access)
export const GET: RequestHandler = async () => {
  // Seed built-in smart collections if they don't exist
  const existingSmart = await db
    .select({ name: collections.name })
    .from(collections)
    .where(eq(collections.isSmart, true));
  const existingNames = new Set(existingSmart.map((e) => e.name));
  for (const builtin of BUILTIN_SMART_COLLECTIONS) {
    if (!existingNames.has(builtin.name)) {
      await db.insert(collections).values({
        name: builtin.name,
        isSmart: true,
        smartCriteria: JSON.stringify(builtin.criteria),
      });
    }
  }

  const result = await db
    .select({
      id: collections.id,
      name: collections.name,
      description: collections.description,
      coverImagePath: collections.coverImagePath,
      isSmart: collections.isSmart,
      smartCriteria: collections.smartCriteria,
      createdAt: collections.createdAt,
      imageCount: sql<number>`(SELECT COUNT(*) FROM collection_images WHERE collection_images.collection_id = ${collections.id})`,
    })
    .from(collections)
    .orderBy(desc(collections.createdAt));

  return json(result);
};

// POST: create collection
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { name, description, is_smart, smart_criteria } = body;

  if (!name) {
    return json({ error: "name is required" }, { status: 400 });
  }

  const result = await db
    .insert(collections)
    .values({
      name,
      description: description || null,
      isSmart: is_smart ?? false,
      smartCriteria: smart_criteria ? JSON.stringify(smart_criteria) : null,
    })
    .returning();

  return json(result[0]);
};
