import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { imageAttributes } from "$lib/server/db/schema";
import { eq, or, gt, lt, and, desc } from "drizzle-orm";

const DEFAULT_LIMIT = 50;

function parseJsonArray(val: string | null): string[] {
  if (!val) return [];
  try {
    return JSON.parse(val);
  } catch {
    return [];
  }
}

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

  return json({
    images: images.map((img) => ({
      relativePath: img.relativePath,
      rating: img.rating,
      colorLabel: img.colorLabel,
      flag: img.flag,
      notes: img.notes,
      stackId: img.stackId,
      width: img.width,
      height: img.height,
      aspectRatio: img.aspectRatio,
      fileSize: img.fileSize,
      fileFormat: img.fileFormat,
      hasAlpha: img.hasAlpha,
      createdAt: img.createdAt ?? "",
      updatedAt: img.updatedAt ?? "",
      fileModifiedAt: img.fileModifiedAt,
      isMissing: img.isMissing,
      extractedModels: parseJsonArray(img.extractedModels),
      extractedLoras: parseJsonArray(img.extractedLoras),
      extractedSamplers: parseJsonArray(img.extractedSamplers),
      extractedSchedulers: parseJsonArray(img.extractedSchedulers),
      steps: img.steps,
      cfgScale: img.cfgScale,
      seed: img.seed,
      positivePrompt: img.positivePrompt,
      negativePrompt: img.negativePrompt,
      tags: [] as { id: number; name: string; slug: string }[],
      collectionIds: [] as number[],
    })),
    nextCursor,
    hasMore,
  });
};
