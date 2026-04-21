import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConfig, setConfig, getAllConfig } from '$lib/server/config';

export const GET: RequestHandler = async () => {
	const config = await getAllConfig();
	return json(config);
};

export const POST: RequestHandler = async ({ request }) => {
	const { key, value } = await request.json();
	if (!key || typeof value !== 'string') {
		return json({ error: 'key 和 value 必填' }, { status: 400 });
	}
	await setConfig(key, value);
	return json({ success: true });
};
