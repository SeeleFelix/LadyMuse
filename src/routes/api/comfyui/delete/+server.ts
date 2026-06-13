import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import {
  imageAttributes,
  imageTags,
  collectionImages,
} from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { resolveImagePath, clearCache } from "$lib/server/comfyui-browser";
import { unlinkSync } from "node:fs";
import { broadcastDeletion } from "$lib/server/file-sync-service";
import { findProtectedPaths } from "$lib/server/deletion-guard";

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { relative_paths } = body as { relative_paths?: string[] };

  if (!Array.isArray(relative_paths) || relative_paths.length === 0) {
    return json(
      { error: "relative_paths (string[]) is required" },
      { status: 400 },
    );
  }

  // Reject the whole batch if any path is curated.
  const protectedPaths = await findProtectedPaths(db, relative_paths);
  if (protectedPaths.length > 0) {
    return json(
      { error: "protected", protected: protectedPaths },
      { status: 409 },
    );
  }

  // Best-effort: a mid-batch failure returns 500 with the count deleted so far.
  // The caller reconciles final state via store.refresh() rather than this count.
  let deleted = 0;
  for (const relativePath of relative_paths) {
    const absPath = await resolveImagePath(relativePath);
    if (!absPath) continue;

    try {
      unlinkSync(absPath);
      clearCache();
    } catch (e: any) {
      return json(
        { error: `Failed to delete file: ${e.message}`, deleted },
        { status: 500 },
      );
    }

    try {
      await db
        .delete(imageTags)
        .where(eq(imageTags.relativePath, relativePath));
      await db
        .delete(collectionImages)
        .where(eq(collectionImages.relativePath, relativePath));
      await db
        .delete(imageAttributes)
        .where(eq(imageAttributes.relativePath, relativePath));
    } catch (e: any) {
      return json(
        { error: "Failed to clean database rows", relativePath, deleted },
        { status: 500 },
      );
    }

    broadcastDeletion(relativePath);
    deleted++;
  }

  return json({ success: true, deleted });
};
