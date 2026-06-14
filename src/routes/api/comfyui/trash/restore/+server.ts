import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { TrashService } from "$lib/server/trash-service";
import { getOutputDir } from "$lib/server/comfyui-browser";

export const POST: RequestHandler = async ({ request }) => {
  const { id } = await request.json();
  if (typeof id !== "number") {
    return json({ error: "id (number) is required" }, { status: 400 });
  }
  const outputDir = await getOutputDir();
  if (!outputDir) return json({ error: "Not configured" }, { status: 500 });
  const trash = new TrashService(db, outputDir);
  try {
    const result = await trash.restoreFromTrash(id);
    return json(result);
  } catch (e: any) {
    return json({ error: e.message }, { status: 404 });
  }
};
