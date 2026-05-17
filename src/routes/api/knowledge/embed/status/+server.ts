import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { artConcepts } from "$lib/server/db/schema";
import { sql } from "drizzle-orm";

export const GET: RequestHandler = async () => {
  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      missing: sql<number>`sum(case when embedding is null then 1 else 0 end)`,
    })
    .from(artConcepts);

  return json({
    total: row?.total ?? 0,
    embedded: (row?.total ?? 0) - (row?.missing ?? 0),
    missing: row?.missing ?? 0,
  });
};
