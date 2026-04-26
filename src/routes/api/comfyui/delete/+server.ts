import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import {
  imageAttributes,
  imageTags,
  collectionImages,
} from "$lib/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { resolveImagePath } from "$lib/server/comfyui-browser";
import { unlinkSync } from "node:fs";

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { relative_path } = body;

  if (!relative_path) {
    return json({ error: "relative_path is required" }, { status: 400 });
  }

  const absPath = await resolveImagePath(relative_path);
  if (!absPath) {
    return json({ error: "Invalid path" }, { status: 400 });
  }

  // Delete from filesystem
  try {
    unlinkSync(absPath);
  } catch (e: any) {
    return json(
      { error: `Failed to delete file: ${e.message}` },
      { status: 500 },
    );
  }

  // Clean up database references
  await db.delete(imageTags).where(eq(imageTags.relativePath, relative_path));
  await db
    .delete(collectionImages)
    .where(eq(collectionImages.relativePath, relative_path));
  await db
    .delete(imageAttributes)
    .where(eq(imageAttributes.relativePath, relative_path));

  return json({ success: true });
};
