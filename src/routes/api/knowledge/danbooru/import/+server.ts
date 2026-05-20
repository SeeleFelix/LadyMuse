import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { importDanbooru } from "$lib/server/knowledge/sync-danbooru";
import { getSyncStatus } from "$lib/server/knowledge/sync-status";

export const POST: RequestHandler = async () => {
  if (getSyncStatus().running) {
    return json({ error: "Sync already in progress" }, { status: 409 });
  }
  importDanbooru().catch((e) => console.error("[danbooru import]", e));
  return json({ ok: true });
};
