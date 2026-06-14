import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { findProtectedPaths } from "$lib/server/deletion-guard";
import { TrashService } from "$lib/server/trash-service";
import { getOutputDir } from "$lib/server/comfyui-browser";

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

  const outputDir = await getOutputDir();
  if (!outputDir) {
    return json({ error: "Output directory not configured" }, { status: 500 });
  }
  const trash = new TrashService(db, outputDir);

  let trashed = 0;
  for (const relativePath of relative_paths) {
    try {
      await trash.softDeleteToTrash(relativePath);
      trashed++;
    } catch (e: any) {
      return json(
        { error: `Failed to trash: ${e.message}`, trashed },
        { status: 500 },
      );
    }
  }

  return json({ success: true, trashed });
};
