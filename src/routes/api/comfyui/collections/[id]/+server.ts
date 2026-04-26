import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { collections } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";

// PUT: update collection
export const PUT: RequestHandler = async ({ params, request }) => {
  const id = parseInt(params.id);
  const body = await request.json();

  const values: Record<string, any> = { updatedAt: new Date().toISOString() };
  if (body.name !== undefined) values.name = body.name;
  if (body.description !== undefined) values.description = body.description;
  if (body.cover_image_path !== undefined)
    values.coverImagePath = body.cover_image_path;
  if (body.smart_criteria !== undefined)
    values.smartCriteria = JSON.stringify(body.smart_criteria);

  await db.update(collections).set(values).where(eq(collections.id, id));

  const result = await db
    .select()
    .from(collections)
    .where(eq(collections.id, id));
  return json(result[0] || { error: "Not found" }, {
    status: result.length ? 200 : 404,
  });
};

// DELETE: delete collection
export const DELETE: RequestHandler = async ({ params }) => {
  const id = parseInt(params.id);
  await db.delete(collections).where(eq(collections.id, id));
  return json({ success: true });
};
