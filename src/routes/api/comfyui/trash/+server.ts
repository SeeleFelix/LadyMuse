import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { TrashService } from "$lib/server/trash-service";
import { getOutputDir } from "$lib/server/comfyui-browser";

export const GET: RequestHandler = async ({ url }) => {
  const outputDir = await getOutputDir();
  if (!outputDir) return json({ error: "Not configured" }, { status: 500 });
  const trash = new TrashService(db, outputDir);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "50");
  const result = await trash.listTrash(page, pageSize);
  return json(result);
};
