import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { resolveImagePath } from "$lib/server/comfyui-browser";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname } from "node:path";

export const GET: RequestHandler = async ({ params, url }) => {
  const relativePath = decodeURIComponent(params.path);
  const absPath = await resolveImagePath(relativePath);

  if (!absPath) {
    return json({ error: "Invalid path" }, { status: 400 });
  }

  if (!existsSync(absPath)) {
    return json({ error: "Not found" }, { status: 404 });
  }

  const ext = extname(absPath).toLowerCase();
  const contentType =
    ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".webp"
        ? "image/webp"
        : "image/png";

  const stat = statSync(absPath);
  const stream = createReadStream(absPath);

  return new Response(stream as any, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
      "Content-Length": stat.size.toString(),
    },
  });
};
