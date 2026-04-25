import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { generationRatings } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { generation_id, rating, is_favorite, notes, effective_keywords } =
    body;

  if (!generation_id || !rating) {
    return json(
      { error: "generation_id and rating required" },
      { status: 400 },
    );
  }

  // Upsert: check if rating exists
  const existing = await db
    .select()
    .from(generationRatings)
    .where(eq(generationRatings.generationId, generation_id));

  if (existing.length > 0) {
    await db
      .update(generationRatings)
      .set({
        rating,
        isFavorite: is_favorite ?? existing[0].isFavorite,
        notes: notes ?? existing[0].notes,
        effectiveKeywords: effective_keywords ?? existing[0].effectiveKeywords,
      })
      .where(eq(generationRatings.generationId, generation_id));
  } else {
    await db.insert(generationRatings).values({
      generationId: generation_id,
      rating,
      isFavorite: is_favorite ?? false,
      notes,
      effectiveKeywords: effective_keywords,
    });
  }

  return json({ success: true });
};
