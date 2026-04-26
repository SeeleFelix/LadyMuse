import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { generations, generationRatings } from "$lib/server/db/schema";

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { relative_path, metadata, rating, is_favorite, notes } = body;

  if (!relative_path) {
    return json({ error: "relative_path is required" }, { status: 400 });
  }

  const imagePath = `/api/comfyui/images/${encodeURIComponent(relative_path)}`;

  // Extract structured fields from metadata if available
  const meta = metadata || {};
  const mainSampler =
    meta.samplers?.length > 0 ? meta.samplers[meta.samplers.length - 1] : null;

  const result = await db
    .insert(generations)
    .values({
      imagePath,
      thumbnailPath: imagePath,
      parametersJson:
        meta.rawPromptJson || (metadata ? JSON.stringify(metadata) : null),
      width: meta.width ?? null,
      height: meta.height ?? null,
      seed: mainSampler?.seed ?? null,
      sampler: mainSampler?.samplerName ?? null,
      steps: mainSampler?.steps ?? null,
      cfgScale: mainSampler?.cfg ?? null,
      modelName: meta.models?.join(", ") ?? null,
    })
    .returning();

  const generation = result[0];

  // Create rating if provided
  if (rating) {
    await db.insert(generationRatings).values({
      generationId: generation.id,
      rating,
      isFavorite: is_favorite ?? false,
      notes: notes || null,
    });
  }

  return json(generation);
};
