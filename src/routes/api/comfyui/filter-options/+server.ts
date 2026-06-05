import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { imageAttributes, tags } from "$lib/server/db/schema";
import { sql } from "drizzle-orm";

export const GET: RequestHandler = async () => {
  // Query distinct models from extractedModels JSON array
  const modelsResult = await db
    .selectDistinct({ value: sql<string>`json_each.value` })
    .from(imageAttributes)
    .innerJoin(sql`json_each(${imageAttributes.extractedModels})`, sql`true`)
    .where(sql`json_each.value IS NOT NULL`);

  const models = modelsResult
    .map((r) => r.value)
    .filter((v): v is string => v !== null)
    .sort();

  // Query distinct loras from extractedLoras JSON array
  const lorasResult = await db
    .selectDistinct({ value: sql<string>`json_each.value` })
    .from(imageAttributes)
    .innerJoin(sql`json_each(${imageAttributes.extractedLoras})`, sql`true`)
    .where(sql`json_each.value IS NOT NULL`);

  const loras = lorasResult
    .map((r) => r.value)
    .filter((v): v is string => v !== null)
    .sort();

  // Query distinct samplers from extractedSamplers JSON array
  const samplersResult = await db
    .selectDistinct({ value: sql<string>`json_each.value` })
    .from(imageAttributes)
    .innerJoin(sql`json_each(${imageAttributes.extractedSamplers})`, sql`true`)
    .where(sql`json_each.value IS NOT NULL`);

  const samplers = samplersResult
    .map((r) => r.value)
    .filter((v): v is string => v !== null)
    .sort();

  // Query distinct schedulers from extractedSchedulers JSON array
  const schedulersResult = await db
    .selectDistinct({ value: sql<string>`json_each.value` })
    .from(imageAttributes)
    .innerJoin(
      sql`json_each(${imageAttributes.extractedSchedulers})`,
      sql`true`,
    )
    .where(sql`json_each.value IS NOT NULL`);

  const schedulers = schedulersResult
    .map((r) => r.value)
    .filter((v): v is string => v !== null)
    .sort();

  // Query distinct non-null colorLabel values
  const colorLabelsResult = await db
    .selectDistinct({ value: imageAttributes.colorLabel })
    .from(imageAttributes)
    .where(sql`${imageAttributes.colorLabel} IS NOT NULL`);

  const colorLabels = colorLabelsResult
    .map((r) => r.value)
    .filter((v): v is string => v !== null)
    .sort();

  // Query all tags
  const allTags = await db.query.tags.findMany({
    orderBy: (tags, { asc }) => [asc(tags.name)],
  });

  const tagsResult = allTags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
  }));

  return json({
    models,
    loras,
    samplers,
    schedulers,
    colorLabels,
    tags: tagsResult,
  });
};
