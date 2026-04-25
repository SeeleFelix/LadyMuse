import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { prompts, promptVersions } from "$lib/server/db/schema";
import { eq, desc, like, or, and, sql } from "drizzle-orm";

export const GET: RequestHandler = async ({ url }) => {
  const search = url.searchParams.get("search");
  const sort = url.searchParams.get("sort") || "date";

  let query = db.select().from(prompts).$dynamic();

  const conditions = [];
  if (search) {
    const w = `%${search}%`;
    conditions.push(
      or(
        like(prompts.title, w),
        like(prompts.positivePrompt, w),
        like(prompts.notes, w),
        like(prompts.tags, w),
      ),
    );
  }

  let list;
  if (conditions.length > 0) {
    list = await db
      .select()
      .from(prompts)
      .where(and(...conditions))
      .orderBy(
        sort === "rating" ? desc(prompts.rating) : desc(prompts.createdAt),
      )
      .limit(100);
  } else {
    list = await db
      .select()
      .from(prompts)
      .orderBy(
        sort === "rating" ? desc(prompts.rating) : desc(prompts.createdAt),
      )
      .limit(100);
  }

  return json(list);
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const result = await db
    .insert(prompts)
    .values({
      title: body.title,
      positivePrompt: body.positive_prompt,
      negativePrompt: body.negative_prompt,
      notes: body.notes,
      tags: body.tags,
      rating: body.rating,
      source: body.source || "manual",
      sampler: body.sampler,
      scheduler: body.scheduler,
      steps: body.steps,
      cfgScale: body.cfg_scale,
      width: body.width,
      height: body.height,
    })
    .returning();
  return json(result[0]);
};

export const PUT: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const id = body.id;
  if (!id) return json({ error: "id required" }, { status: 400 });

  // Get current version for history
  const current = await db.select().from(prompts).where(eq(prompts.id, id));
  if (current.length === 0)
    return json({ error: "not found" }, { status: 404 });

  const prev = current[0];
  if (
    prev.positivePrompt !== body.positive_prompt ||
    prev.negativePrompt !== body.negative_prompt
  ) {
    const versionCount = await db
      .select({ count: sql`count(*)` })
      .from(promptVersions)
      .where(eq(promptVersions.promptId, id));
    const nextVersion = (versionCount[0]?.count ?? 0) + 1;

    await db.insert(promptVersions).values({
      promptId: id,
      version: nextVersion,
      positive: prev.positivePrompt,
      negative: prev.negativePrompt,
      diffSummary: body.diff_summary || `版本 ${nextVersion}`,
    });
  }

  await db
    .update(prompts)
    .set({
      title: body.title,
      positivePrompt: body.positive_prompt,
      negativePrompt: body.negative_prompt,
      notes: body.notes,
      tags: body.tags,
      rating: body.rating,
      sampler: body.sampler,
      scheduler: body.scheduler,
      steps: body.steps,
      cfgScale: body.cfg_scale,
      width: body.width,
      height: body.height,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(prompts.id, id));

  return json({ success: true });
};

export const DELETE: RequestHandler = async ({ request }) => {
  const { id } = await request.json();
  if (!id) return json({ error: "id required" }, { status: 400 });

  await db.delete(promptVersions).where(eq(promptVersions.promptId, id));
  await db.delete(prompts).where(eq(prompts.id, id));
  return json({ success: true });
};
