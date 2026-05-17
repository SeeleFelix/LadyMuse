import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { artConcepts } from "$lib/server/db/schema";
import { eq, or } from "drizzle-orm";

export const GET: RequestHandler = async ({ params }) => {
  const name = decodeURIComponent(params.name);

  let rows = await db
    .select()
    .from(artConcepts)
    .where(eq(artConcepts.name, name));

  if (rows.length === 0) {
    rows = await db
      .select()
      .from(artConcepts)
      .where(eq(artConcepts.nameZh, name));
  }

  if (rows.length === 0) {
    return json({ error: "Not found" }, { status: 404 });
  }

  const c = rows[0];

  let relatedDetails: { name: string; nameZh: string | null }[] = [];
  if (c.relatedConcepts) {
    const relatedNames = JSON.parse(c.relatedConcepts) as string[];
    if (relatedNames.length > 0) {
      relatedDetails = await db
        .select({ name: artConcepts.name, nameZh: artConcepts.nameZh })
        .from(artConcepts)
        .where(or(...relatedNames.map((n) => eq(artConcepts.name, n))))
        .limit(10);
    }
  }

  return json({
    name: c.name,
    nameZh: c.nameZh,
    category: c.category,
    subCategory: c.subCategory,
    visualDescription: c.visualDescription,
    tags: c.tags ? JSON.parse(c.tags) : [],
    tagUsage: c.tagUsage,
    naturalLanguage: c.naturalLanguage,
    nlUsage: c.nlUsage,
    relatedConcepts: relatedDetails,
    source: c.source,
  });
};
