import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import {
  artCategories,
  artSubcategories,
  artTechniques,
} from "$lib/server/db/schema";
import { eq, sql } from "drizzle-orm";

export const GET: RequestHandler = async ({ url }) => {
  const search = url.searchParams.get("search");
  const mood = url.searchParams.get("mood");

  // Get full hierarchy
  const categories = await db
    .select()
    .from(artCategories)
    .orderBy(artCategories.sortOrder);

  const subcategories = await db
    .select()
    .from(artSubcategories)
    .orderBy(artSubcategories.sortOrder);

  let techniques = await db
    .select()
    .from(artTechniques)
    .orderBy(artTechniques.sortOrder);

  // Filter by mood tags
  if (mood) {
    techniques = techniques.filter((t) =>
      t.moodTags?.toLowerCase().includes(mood.toLowerCase()),
    );
  }

  // Filter by search
  if (search) {
    const q = search.toLowerCase();
    techniques = techniques.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.nameZh?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.promptKeywords.toLowerCase().includes(q) ||
        t.tags?.toLowerCase().includes(q),
    );
  }

  // Group subcategories under categories
  const result = categories.map((cat) => ({
    ...cat,
    subcategories: subcategories
      .filter((sub) => sub.categoryId === cat.id)
      .map((sub) => ({
        ...sub,
        techniques: techniques.filter((t) => t.subcategoryId === sub.id),
      })),
  }));

  return json(result);
};
