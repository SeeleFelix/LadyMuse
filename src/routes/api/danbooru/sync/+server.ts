import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { syncTagGroups, syncDescriptions } from "$lib/server/danbooru-sync";

export const POST: RequestHandler = async ({ url }) => {
  const type = url.searchParams.get("type");

  if (type === "structure") {
    try {
      const result = await syncTagGroups();
      return json(result);
    } catch (e: any) {
      return json({ error: e.message }, { status: 500 });
    }
  }

  if (type === "descriptions") {
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    try {
      const result = await syncDescriptions(limit);
      return json(result);
    } catch (e: any) {
      return json({ error: e.message }, { status: 500 });
    }
  }

  return json(
    { error: "Unknown sync type. Use ?type=structure or ?type=descriptions" },
    { status: 400 },
  );
};
