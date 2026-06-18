import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { imageAttributes } from "$lib/server/db/schema";
import { eq, or, gt, lt, and, desc } from "drizzle-orm";

const DEFAULT_LIMIT = 50;

interface CursorData {
  modified_at: string;
  path: string;
}

function decodeCursor(cursor: string | null): CursorData | null {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

function encodeCursor(image: {
  fileModifiedAt: string | null;
  relativePath: string;
}): string {
  return Buffer.from(
    JSON.stringify({
      modified_at: image.fileModifiedAt,
      path: image.relativePath,
    }),
  ).toString("base64url");
}

export const GET: RequestHandler = async ({ url }) => {
  const cursorParam = url.searchParams.get("cursor");
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || String(DEFAULT_LIMIT)),
    100,
  );

  const cursor = decodeCursor(cursorParam);

  const conditions = [
    or(gt(imageAttributes.rating, 0), eq(imageAttributes.flag, "pick")),
    eq(imageAttributes.isMissing, false),
  ];

  if (cursor) {
    conditions.push(
      or(
        lt(imageAttributes.fileModifiedAt, cursor.modified_at),
        and(
          eq(imageAttributes.fileModifiedAt, cursor.modified_at),
          lt(imageAttributes.relativePath, cursor.path),
        ),
      ),
    );
  }

  const images = await db
    .select()
    .from(imageAttributes)
    .where(and(...conditions))
    .orderBy(
      desc(imageAttributes.fileModifiedAt),
      desc(imageAttributes.relativePath),
    )
    .limit(limit + 1);

  const hasMore = images.length > limit;
  if (hasMore) images.pop();

  const nextCursor =
    images.length > 0 ? encodeCursor(images[images.length - 1]) : null;

  return json({ images, nextCursor, hasMore });
};
