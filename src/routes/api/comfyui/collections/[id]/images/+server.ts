import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { collectionImages } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";

// GET: list images in collection
export const GET: RequestHandler = async ({ params }) => {
  const id = parseInt(params.id);
  const result = await db
    .select()
    .from(collectionImages)
    .where(eq(collectionImages.collectionId, id))
    .orderBy(collectionImages.sortOrder);

  return json(result);
};

// POST: add images to collection
export const POST: RequestHandler = async ({ params, request }) => {
  const id = parseInt(params.id);
  const body = await request.json();
  const { relative_paths } = body;

  if (!Array.isArray(relative_paths)) {
    return json({ error: "relative_paths array required" }, { status: 400 });
  }

  for (const rp of relative_paths) {
    try {
      await db.insert(collectionImages).values({
        collectionId: id,
        relativePath: rp,
      });
    } catch {
      // Already exists, skip
    }
  }

  return json({ success: true });
};

// DELETE: remove images from collection
export const DELETE: RequestHandler = async ({ params, request }) => {
  const id = parseInt(params.id);
  const body = await request.json();
  const { relative_paths } = body;

  if (!Array.isArray(relative_paths)) {
    return json({ error: "relative_paths array required" }, { status: 400 });
  }

  for (const rp of relative_paths) {
    await db
      .delete(collectionImages)
      .where(
        eq(collectionImages.collectionId, id) &&
          eq(collectionImages.relativePath, rp),
      );
  }

  return json({ success: true });
};
