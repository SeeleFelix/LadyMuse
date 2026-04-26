import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { stacks, imageAttributes } from "$lib/server/db/schema";
import { eq, desc } from "drizzle-orm";

// GET: list all stacks
export const GET: RequestHandler = async () => {
  const result = await db.select().from(stacks).orderBy(desc(stacks.createdAt));
  return json(result);
};

// POST: create stack and assign images
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { name, image_paths } = body;

  const stack = await db
    .insert(stacks)
    .values({
      name: name || null,
      coverImagePath: image_paths?.[0] || null,
    })
    .returning();

  // Assign stack_id to all images
  if (Array.isArray(image_paths)) {
    for (const rp of image_paths) {
      const existing = await db
        .select()
        .from(imageAttributes)
        .where(eq(imageAttributes.relativePath, rp));
      if (existing.length > 0) {
        await db
          .update(imageAttributes)
          .set({ stackId: stack[0].id })
          .where(eq(imageAttributes.relativePath, rp));
      } else {
        await db.insert(imageAttributes).values({
          relativePath: rp,
          stackId: stack[0].id,
        });
      }
    }
  }

  return json(stack[0]);
};
