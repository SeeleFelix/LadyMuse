import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { browseImages, getOutputDir } from "$lib/server/comfyui-browser";
import { db } from "$lib/server/db";
import {
  imageAttributes,
  imageTags,
  tags,
  collections,
  collectionImages,
} from "$lib/server/db/schema";
import { evaluateSmartCollection } from "$lib/server/smart-collections";
import { eq, sql, inArray } from "drizzle-orm";

export const GET: RequestHandler = async ({ url }) => {
  const outputDir = await getOutputDir();
  if (!outputDir) {
    return json(
      { error: "ComfyUI output directory not configured" },
      { status: 400 },
    );
  }

  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = parseInt(url.searchParams.get("page_size") || "24");
  const sort = (url.searchParams.get("sort") || "date-desc") as
    | "date-desc"
    | "date-asc"
    | "name";

  // Filter params
  const ratingMin = url.searchParams.get("rating_min");
  const colorLabel = url.searchParams.get("color_label");
  const flag = url.searchParams.get("flag");
  const tagFilter = url.searchParams.get("tag");
  const collectionId = url.searchParams.get("collection_id");

  const result = await browseImages(page, pageSize, sort);

  // Enrich with attributes and tags from DB
  if (result.images.length > 0) {
    const paths = result.images.map((img) => img.relativePath);

    // Fetch attributes
    const attrs =
      paths.length > 0
        ? await db
            .select()
            .from(imageAttributes)
            .where(inArray(imageAttributes.relativePath, paths))
        : [];
    const attrMap = new Map(attrs.map((a) => [a.relativePath, a]));

    // Fetch tags
    const imgTags =
      paths.length > 0
        ? await db
            .select({
              relativePath: imageTags.relativePath,
              tagId: tags.id,
              tagName: tags.name,
              tagSlug: tags.slug,
            })
            .from(imageTags)
            .leftJoin(tags, eq(imageTags.tagId, tags.id))
            .where(inArray(imageTags.relativePath, paths))
        : [];
    const tagMap = new Map<
      string,
      { id: number; name: string; slug: string }[]
    >();
    for (const t of imgTags) {
      if (!t.tagId) continue;
      const list = tagMap.get(t.relativePath) || [];
      list.push({ id: t.tagId, name: t.tagName || "", slug: t.tagSlug || "" });
      tagMap.set(t.relativePath, list);
    }

    // Attach to images
    for (const img of result.images) {
      const attr = attrMap.get(img.relativePath);
      (img as any).attributes = attr
        ? {
            rating: attr.rating ?? 0,
            colorLabel: attr.colorLabel,
            flag: attr.flag,
            notes: attr.notes,
            stackId: attr.stackId,
          }
        : null;
      (img as any).tags = tagMap.get(img.relativePath) || [];
    }

    // Apply filters (in-memory, post-fetch)
    let filtered = result.images;
    if (ratingMin) {
      const min = parseInt(ratingMin);
      filtered = filtered.filter(
        (img) => ((img as any).attributes?.rating ?? 0) >= min,
      );
    }
    if (colorLabel) {
      filtered = filtered.filter(
        (img) => (img as any).attributes?.colorLabel === colorLabel,
      );
    }
    if (flag) {
      filtered = filtered.filter(
        (img) => (img as any).attributes?.flag === flag,
      );
    }
    if (tagFilter) {
      filtered = filtered.filter((img) => {
        const imgTagList = (img as any).tags as { name: string }[];
        return imgTagList.some((t) => t.name === tagFilter);
      });
    }

    if (collectionId) {
      const cid = parseInt(collectionId);
      if (!isNaN(cid)) {
        const collRows = await db
          .select()
          .from(collections)
          .where(eq(collections.id, cid));
        const coll = collRows[0];
        if (coll?.isSmart && coll.smartCriteria) {
          try {
            const criteria = JSON.parse(coll.smartCriteria);
            const smartPaths = await evaluateSmartCollection(criteria);
            const smartPathSet = new Set(smartPaths);
            filtered = filtered.filter((img) =>
              smartPathSet.has(img.relativePath),
            );
          } catch {
            /* invalid criteria */
          }
        } else {
          const collImgs = await db
            .select({ relativePath: collectionImages.relativePath })
            .from(collectionImages)
            .where(eq(collectionImages.collectionId, cid));
          const collPathSet = new Set(collImgs.map((ci) => ci.relativePath));
          filtered = filtered.filter((img) =>
            collPathSet.has(img.relativePath),
          );
        }
      }
    }

    if (filtered.length !== result.images.length) {
      const removed = result.images.length - filtered.length;
      result.images = filtered;
      result.total -= removed;
    }
  }

  return json(result);
};
