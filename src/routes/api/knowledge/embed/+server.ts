import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { embedAll } from "$lib/server/knowledge/embed-all";
import { getSyncStatus } from "$lib/server/knowledge/sync-status";

export const POST: RequestHandler = async ({ request }) => {
  const status = getSyncStatus();
  if (status.running) {
    return json({ error: "Sync already in progress" }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const { dimension, name } = body || {};

  embedAll(dimension, name).catch((e) => console.error("[embed]", e));
  return json({ ok: true });
};
