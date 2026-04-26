import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { sessions, sessionMessages } from "$lib/server/db/schema";
import { eq, desc } from "drizzle-orm";

export const GET: RequestHandler = async ({ params }) => {
  const id = Number(params.id);
  const session = await db.select().from(sessions).where(eq(sessions.id, id));
  if (session.length === 0)
    return json({ error: "not found" }, { status: 404 });

  const msgs = await db
    .select()
    .from(sessionMessages)
    .where(eq(sessionMessages.sessionId, id))
    .orderBy(sessionMessages.id);

  return json({ ...session[0], messages: msgs });
};

export const POST: RequestHandler = async ({ params, request }) => {
  const id = Number(params.id);
  const { role, content, tool_detail, usage_json } = await request.json();
  if (!role || !content)
    return json({ error: "role and content required" }, { status: 400 });

  const result = await db
    .insert(sessionMessages)
    .values({
      sessionId: id,
      role,
      content,
      toolDetail: tool_detail || null,
      usageJson: usage_json || null,
    })
    .returning();

  await db
    .update(sessions)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(sessions.id, id));

  return json(result[0]);
};
