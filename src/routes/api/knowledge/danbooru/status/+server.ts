import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { danbooruTags } from "$lib/server/db/schema";
import { sql } from "drizzle-orm";

export const GET: RequestHandler = async () => {
  const [total] = await db
    .select({ count: sql<number>`count(*)` })
    .from(danbooruTags);
  const [embedded] = await db
    .select({ count: sql<number>`count(*)` })
    .from(danbooruTags)
    .where(sql`${danbooruTags.embedding} IS NOT NULL`);

  return json({ total: total?.count ?? 0, embedded: embedded?.count ?? 0 });
};
