import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { stacks, imageAttributes } from "$lib/server/db/schema";
import { eq, isNull, isNotNull } from "drizzle-orm";

// PUT: update stack (rename, change cover, add/remove images)
export const PUT: RequestHandler = async ({ params, request }) => {
  const id = parseInt(params.id);
  const body = await request.json();

  if (body.name !== undefined || body.cover_image_path !== undefined) {
    const values: Record<string, any> = {};
    if (body.name !== undefined) values.name = body.name;
    if (body.cover_image_path !== undefined)
      values.coverImagePath = body.cover_image_path;
    await db.update(stacks).set(values).where(eq(stacks.id, id));
  }

  // Add images to stack
  if (Array.isArray(body.add_paths)) {
    for (const rp of body.add_paths) {
      const existing = await db
        .select()
        .from(imageAttributes)
        .where(eq(imageAttributes.relativePath, rp));
      if (existing.length > 0) {
        await db
          .update(imageAttributes)
          .set({ stackId: id })
          .where(eq(imageAttributes.relativePath, rp));
      } else {
        await db
          .insert(imageAttributes)
          .values({ relativePath: rp, stackId: id });
      }
    }
  }

  // Remove images from stack
  if (Array.isArray(body.remove_paths)) {
    for (const rp of body.remove_paths) {
      await db
        .update(imageAttributes)
        .set({ stackId: null })
        .where(eq(imageAttributes.relativePath, rp));
    }
  }

  const result = await db.select().from(stacks).where(eq(stacks.id, id));
  return json(result[0] || { error: "Not found" }, {
    status: result.length ? 200 : 404,
  });
};

// DELETE: delete stack (unassign all images)
export const DELETE: RequestHandler = async ({ params }) => {
  const id = parseInt(params.id);

  // Unassign all images
  await db
    .update(imageAttributes)
    .set({ stackId: null })
    .where(eq(imageAttributes.stackId, id));

  await db.delete(stacks).where(eq(stacks.id, id));
  return json({ success: true });
};
