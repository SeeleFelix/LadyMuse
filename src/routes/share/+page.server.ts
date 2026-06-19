import type { PageServerLoad } from "./$types";
import { db } from "$lib/server/db";
import { imageAttributes } from "$lib/server/db/schema";
import { eq, or, gt, and, desc } from "drizzle-orm";

const COOKIE_NAME = "share_auth";

export const load: PageServerLoad = async ({ cookies }) => {
  const authed = cookies.get(COOKIE_NAME);

  if (!authed) {
    return { authenticated: false as const, images: [] };
  }

  const images = await db
    .select()
    .from(imageAttributes)
    .where(
      and(
        or(gt(imageAttributes.rating, 0), eq(imageAttributes.flag, "pick")),
        eq(imageAttributes.isMissing, false),
      ),
    )
    .orderBy(
      desc(imageAttributes.fileModifiedAt),
      desc(imageAttributes.relativePath),
    )
    .limit(50);

  const nextCursor =
    images.length > 0
      ? Buffer.from(
          JSON.stringify({
            modified_at: images[images.length - 1].fileModifiedAt,
            path: images[images.length - 1].relativePath,
          }),
        ).toString("base64url")
      : null;

  return {
    authenticated: true as const,
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
      createdAt: img.createdAt,
      updatedAt: img.updatedAt,
      fileModifiedAt: img.fileModifiedAt,
      isMissing: img.isMissing,
      extractedModels: img.extractedModels ?? [],
      extractedLoras: img.extractedLoras ?? [],
      extractedSamplers: img.extractedSamplers ?? [],
      extractedSchedulers: img.extractedSchedulers ?? [],
      steps: img.steps,
      cfgScale: img.cfgScale,
      seed: img.seed,
      positivePrompt: img.positivePrompt,
      negativePrompt: img.negativePrompt,
      tags: [] as { id: number; name: string; slug: string }[],
      collectionIds: [] as number[],
    })),
    nextCursor,
    hasMore: images.length >= 50,
  };
};
