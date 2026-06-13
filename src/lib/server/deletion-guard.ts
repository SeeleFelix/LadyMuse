import { inArray } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";
import { imageAttributes } from "./db/schema";

export interface ProtectedPath {
  relativePath: string;
  reason: "pick" | "rating";
}

type DbClient = ReturnType<typeof drizzle>;

/**
 * Return the subset of `paths` that are curated (pick flag or non-zero rating)
 * and therefore must not be deleted. Order follows the query result.
 */
export async function findProtectedPaths(
  db: DbClient,
  paths: string[],
): Promise<ProtectedPath[]> {
  if (paths.length === 0) return [];

  const rows = await db
    .select({
      relativePath: imageAttributes.relativePath,
      flag: imageAttributes.flag,
      rating: imageAttributes.rating,
    })
    .from(imageAttributes)
    .where(inArray(imageAttributes.relativePath, paths));

  const protectedPaths: ProtectedPath[] = [];
  for (const row of rows) {
    if (row.flag === "pick") {
      protectedPaths.push({ relativePath: row.relativePath, reason: "pick" });
    } else if ((row.rating ?? 0) > 0) {
      protectedPaths.push({ relativePath: row.relativePath, reason: "rating" });
    }
  }
  return protectedPaths;
}
