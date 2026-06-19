import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { resolveImagePath } from "$lib/server/comfyui-browser";
import { existsSync } from "node:fs";
import sharp from "sharp";

export const GET: RequestHandler = async ({ params }) => {
  const relativePath = decodeURIComponent(params.path);
  const absPath = await resolveImagePath(relativePath);

  if (!absPath || !existsSync(absPath)) {
    return json({ error: "Not found" }, { status: 404 });
  }

  const ext = absPath.split(".").pop()?.toLowerCase() || "png";
  const mimeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  };
  const contentType = mimeMap[ext] || "image/png";

  const targetFormat =
    ext === "jpg" || ext === "jpeg" ? "jpeg" : ext === "webp" ? "webp" : "png";

  // Strip all metadata (sharp strips text chunks by default when re-encoding).
  // ComfyUI workflow data embedded in PNG tEXt chunks is removed.
  // Pixel data is lossless — only encoding, no quality change.
  const buffer = await sharp(absPath).toFormat(targetFormat).toBuffer();

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": buffer.length.toString(),
      "Cache-Control": "public, max-age=604800",
    },
  });
};
