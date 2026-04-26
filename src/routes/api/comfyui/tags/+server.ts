import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { tags, imageTags } from "$lib/server/db/schema";
import { eq, sql } from "drizzle-orm";

// GET: list all tags with usage counts
export const GET: RequestHandler = async () => {
  const result = await db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      imageCount: sql<number>`(SELECT COUNT(*) FROM image_tags WHERE image_tags.tag_id = ${tags.id})`,
    })
    .from(tags)
    .orderBy(tags.name);

  return json(result);
};

// POST: add tags to an image (auto-creates tags)
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { relative_path, tag_names } = body;

  if (!relative_path || !Array.isArray(tag_names)) {
    return json(
      { error: "relative_path and tag_names are required" },
      { status: 400 },
    );
  }

  const results: { id: number; name: string; slug: string }[] = [];

  for (const name of tag_names) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
      .replace(/^-|-$/g, "");

    // Upsert tag
    let tag = await db.select().from(tags).where(eq(tags.slug, slug));
    if (tag.length === 0) {
      tag = await db.insert(tags).values({ name, slug }).returning();
    }

    // Link to image (ignore if already linked)
    try {
      await db.insert(imageTags).values({
        relativePath: relative_path,
        tagId: tag[0].id,
      });
    } catch {
      // Already exists, ignore
    }

    results.push(tag[0]);
  }

  return json(results);
};

// DELETE: remove tags from an image
export const DELETE: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { relative_path, tag_ids } = body;

  if (!relative_path || !Array.isArray(tag_ids)) {
    return json(
      { error: "relative_path and tag_ids are required" },
      { status: 400 },
    );
  }

  for (const tagId of tag_ids) {
    await db
      .delete(imageTags)
      .where(
        sql`${imageTags.relativePath} = ${relative_path} AND ${imageTags.tagId} = ${tagId}`,
      );
  }

  return json({ success: true });
};
