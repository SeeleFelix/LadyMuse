import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { sessions, sessionMessages } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';

export const GET: RequestHandler = async () => {
	const list = await db.select().from(sessions).orderBy(desc(sessions.updatedAt)).limit(50);
	return json(list);
};

export const POST: RequestHandler = async ({ request }) => {
	const { title } = await request.json();
	const result = await db.insert(sessions).values({
		title: title || '新对话'
	}).returning();
	return json(result[0]);
};

export const DELETE: RequestHandler = async ({ request }) => {
	const { id } = await request.json();
	if (!id) return json({ error: 'id required' }, { status: 400 });
	await db.delete(sessionMessages).where(eq(sessionMessages.sessionId, id));
	await db.delete(sessions).where(eq(sessions.id, id));
	return json({ success: true });
};
