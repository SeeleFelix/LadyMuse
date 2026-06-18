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
      ...img,
      metadataJson: undefined,
    })),
    nextCursor,
    hasMore: images.length >= 50,
  };
};
