import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { styleFamilies, styles } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";

export const GET: RequestHandler = async ({ url }) => {
  const familyId = url.searchParams.get("family_id");

  const families = await db
    .select()
    .from(styleFamilies)
    .orderBy(styleFamilies.sortOrder);
  let allStyles = await db.select().from(styles).orderBy(styles.sortOrder);

  if (familyId) {
    allStyles = allStyles.filter((s) => s.familyId === parseInt(familyId));
  }

  // Group styles under families
  const result = families.map((f) => ({
    ...f,
    styles: allStyles.filter((s) => s.familyId === f.id),
  }));

  // If no family grouping requested, return flat style list
  const flat = url.searchParams.get("flat");
  if (flat === "true") {
    return json(allStyles);
  }

  return json(result);
};
