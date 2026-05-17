import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { syncAat } from "$lib/server/knowledge/sync-aat";
import { getSyncStatus } from "$lib/server/knowledge/sync-status";

export const POST: RequestHandler = async () => {
  const status = getSyncStatus();
  if (status.running) {
    return json({ error: "Sync already in progress", status }, { status: 409 });
  }

  syncAat().catch((e) => {
    console.error("[sync-aat]", e);
  });

  return json({ ok: true });
};
