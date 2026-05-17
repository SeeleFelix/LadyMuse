import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { syncWikipedia } from "$lib/server/knowledge/sync-wikipedia";
import { getSyncStatus } from "$lib/server/knowledge/sync-status";

export const POST: RequestHandler = async () => {
  const status = getSyncStatus();
  if (status.running) {
    return json({ error: "Sync already in progress", status }, { status: 409 });
  }

  syncWikipedia().catch((e) => {
    console.error("[sync-wikipedia]", e);
  });

  return json({ ok: true });
};
