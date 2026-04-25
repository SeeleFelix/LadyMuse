import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { generations, generationRatings } from "$lib/server/db/schema";
import { eq, desc } from "drizzle-orm";

export const GET: RequestHandler = async ({ url }) => {
  const promptId = url.searchParams.get("prompt_id");

  let list;
  if (promptId) {
    list = await db
      .select()
      .from(generations)
      .where(eq(generations.promptId, Number(promptId)))
      .orderBy(desc(generations.createdAt))
      .limit(100);
  } else {
    list = await db
      .select()
      .from(generations)
      .orderBy(desc(generations.createdAt))
      .limit(100);
  }

  // Attach ratings
  const result = await Promise.all(
    list.map(async (g) => {
      const ratings = await db
        .select()
        .from(generationRatings)
        .where(eq(generationRatings.generationId, g.id));
      return { ...g, ratings };
    }),
  );

  return json(result);
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const result = await db
    .insert(generations)
    .values({
      promptId: body.prompt_id,
      comfyuiJobId: body.comfyui_job_id,
      imagePath: body.image_path,
      thumbnailPath: body.thumbnail_path,
      parametersJson: body.parameters_json,
      width: body.width,
      height: body.height,
      seed: body.seed,
      sampler: body.sampler,
      steps: body.steps,
      cfgScale: body.cfg_scale,
      modelName: body.model_name,
      durationMs: body.duration_ms,
    })
    .returning();
  return json(result[0]);
};
