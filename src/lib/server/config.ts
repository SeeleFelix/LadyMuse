import { db } from './db';
import { userConfig } from './db/schema';
import { eq } from 'drizzle-orm';

export async function getConfig(key: string): Promise<string | null> {
	const rows = await db.select().from(userConfig).where(eq(userConfig.key, key));
	return rows.length > 0 ? rows[0].value : null;
}

export async function setConfig(key: string, value: string): Promise<void> {
	const existing = await db.select().from(userConfig).where(eq(userConfig.key, key));
	if (existing.length > 0) {
		await db.update(userConfig)
			.set({ value, updatedAt: new Date().toISOString() })
			.where(eq(userConfig.key, key));
	} else {
		await db.insert(userConfig).values({ key, value });
	}
}

export async function getAllConfig(): Promise<Record<string, string>> {
	const rows = await db.select().from(userConfig);
	const result: Record<string, string> = {};
	for (const row of rows) {
		result[row.key] = row.value;
	}
	return result;
}
