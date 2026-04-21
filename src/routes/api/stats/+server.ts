import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { artCategories, artTechniques, styles, prompts } from '$lib/server/db/schema';
import { count } from 'drizzle-orm';

export const GET: RequestHandler = async () => {
	const [cats] = await db.select({ count: count() }).from(artCategories);
	const [techs] = await db.select({ count: count() }).from(artTechniques);
	const [stys] = await db.select({ count: count() }).from(styles);
	const [prps] = await db.select({ count: count() }).from(prompts);

	return json({
		categories: cats?.count ?? 0,
		techniques: techs?.count ?? 0,
		styles: stys?.count ?? 0,
		prompts: prps?.count ?? 0
	});
};
