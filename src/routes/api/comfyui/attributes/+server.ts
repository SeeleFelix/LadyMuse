import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { imageAttributes } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";

export const PUT: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const {
    relative_path,
    rating,
    color_label,
    flag,
    notes,
    stack_id,
    metadata_json,
  } = body;

  if (!relative_path) {
    return json({ error: "relative_path is required" }, { status: 400 });
  }

  const validColors = ["red", "yellow", "green", "blue", "purple"];
  if (
    color_label !== undefined &&
    color_label !== null &&
    !validColors.includes(color_label)
  ) {
    return json({ error: "Invalid color_label" }, { status: 400 });
  }

  const validFlags = ["pick", "reject"];
  if (flag !== undefined && flag !== null && !validFlags.includes(flag)) {
    return json({ error: "Invalid flag" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(imageAttributes)
    .where(eq(imageAttributes.relativePath, relative_path));

  if (existing.length > 0) {
    const setValues: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };
    if (rating !== undefined) setValues.rating = rating;
    if (color_label !== undefined) setValues.colorLabel = color_label;
    if (flag !== undefined) setValues.flag = flag;
    if (notes !== undefined) setValues.notes = notes;
    if (stack_id !== undefined) setValues.stackId = stack_id;
    if (metadata_json !== undefined) setValues.metadataJson = metadata_json;

    await db
      .update(imageAttributes)
      .set(setValues)
      .where(eq(imageAttributes.relativePath, relative_path));
  } else {
    await db.insert(imageAttributes).values({
      relativePath: relative_path,
      rating: rating ?? 0,
      colorLabel: color_label ?? null,
      flag: flag ?? null,
      notes: notes ?? null,
      stackId: stack_id ?? null,
      metadataJson: metadata_json ?? null,
    });
  }

  const result = await db
    .select()
    .from(imageAttributes)
    .where(eq(imageAttributes.relativePath, relative_path));

  return json(result[0]);
};
