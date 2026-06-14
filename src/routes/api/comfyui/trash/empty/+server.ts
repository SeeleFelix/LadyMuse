import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { TrashService } from "$lib/server/trash-service";
import { getOutputDir } from "$lib/server/comfyui-browser";

export const POST: RequestHandler = async () => {
  const outputDir = await getOutputDir();
  if (!outputDir) return json({ error: "Not configured" }, { status: 500 });
  const trash = new TrashService(db, outputDir);
  const { count } = await trash.emptyTrash();
  return json({ success: true, purged: count });
};
