import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { resolveToolCall } from "$lib/server/agent/tools";

export const POST: RequestHandler = async ({ request }) => {
  const { toolCallId, choice } = await request.json();

  if (!toolCallId || !choice) {
    return json({ error: "toolCallId and choice required" }, { status: 400 });
  }

  const ok = resolveToolCall(toolCallId, choice);
  if (!ok) {
    return json(
      { error: "toolCallId not found or already resolved" },
      { status: 404 },
    );
  }
  return json({ ok: true });
};
