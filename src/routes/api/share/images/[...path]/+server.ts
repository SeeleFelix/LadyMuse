import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { resolveImagePath } from "$lib/server/comfyui-browser";
import { existsSync, readFileSync } from "node:fs";
import { stripPngMetadata } from "$lib/server/strip-png-metadata";

export const GET: RequestHandler = async ({ params }) => {
  const relativePath = decodeURIComponent(params.path);
  const absPath = await resolveImagePath(relativePath);

  if (!absPath || !existsSync(absPath)) {
    return json({ error: "Not found" }, { status: 404 });
  }

  const buf = readFileSync(absPath);
  const ext = absPath.split(".").pop()?.toLowerCase() || "png";

  const mimeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  };

  const body = ext === "png" ? stripPngMetadata(buf) : buf;

  return new Response(body, {
    headers: {
      "Content-Type": mimeMap[ext] || "image/png",
      "Content-Length": body.length.toString(),
      "Cache-Control": "public, max-age=604800",
    },
  });
};
