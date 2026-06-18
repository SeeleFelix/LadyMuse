import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { resolveImagePath } from "$lib/server/comfyui-browser";
import { existsSync, createReadStream, statSync } from "node:fs";
import {
  generateThumbnail,
  getThumbnailPath,
  thumbnailExists,
} from "$lib/server/thumbnail-service";

export const GET: RequestHandler = async ({ params }) => {
  const relativePath = decodeURIComponent(params.path);
  const absPath = await resolveImagePath(relativePath);

  if (!absPath || !existsSync(absPath)) {
    return json({ error: "Not found" }, { status: 404 });
  }

  if (!thumbnailExists(relativePath)) {
    try {
      await generateThumbnail(absPath, relativePath);
    } catch {
      return json({ error: "Failed to generate thumbnail" }, { status: 500 });
    }
  }

  const thumbPath = getThumbnailPath(relativePath);
  const stat = statSync(thumbPath);
  const stream = createReadStream(thumbPath);

  return new Response(stream as any, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=604800",
      "Content-Length": stat.size.toString(),
    },
  });
};
