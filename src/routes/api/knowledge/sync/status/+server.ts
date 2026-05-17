import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSyncStatus } from "$lib/server/knowledge/sync-status";

export const GET: RequestHandler = async () => {
  return json(getSyncStatus());
};
