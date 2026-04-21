import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConfig } from '$lib/server/config';
import { db } from '$lib/server/db';
import { cachedModels } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { providers } from '$lib/server/providers';

export const GET: RequestHandler = async ({ url }) => {
	const refresh = url.searchParams.get('refresh') === '1';
	const targetProvider = url.searchParams.get('provider');

	if (refresh) {
		const providerId = targetProvider || 'openrouter';
		const provider = providers.find((p) => p.id === providerId);

		if (!provider) {
			return json({ error: `未知提供商: ${providerId}` }, { status: 400 });
		}

		if (provider.modelsEndpoint) {
			const apiKey = await getConfig(provider.apiKeyConfigKey);
			if (!apiKey) {
				return json({ error: `请先设置 ${provider.name} API Key` }, { status: 400 });
			}

			try {
				const res = await fetch(provider.modelsEndpoint, {
					headers: { Authorization: `Bearer ${apiKey}` }
				});
				if (!res.ok) {
					return json({ error: `${provider.name} 返回错误: ${res.status}` }, { status: 502 });
				}
				const { data } = await res.json();

				// Delete old models for this provider only
				await db.delete(cachedModels).where(eq(cachedModels.provider, providerId));
				const now = new Date().toISOString();
				for (const m of data) {
					await db.insert(cachedModels).values({
						id: m.id,
						provider: providerId,
						name: m.name || m.id,
						description: m.description,
						contextLength: m.context_length,
						pricing: JSON.stringify(m.pricing || {}),
						updatedAt: now
					});
				}
			} catch (e: any) {
				return json({ error: `获取模型失败: ${e.message}` }, { status: 500 });
			}
		} else if (provider.staticModels) {
			// Static model list (e.g. DeepSeek)
			await db.delete(cachedModels).where(eq(cachedModels.provider, providerId));
			const now = new Date().toISOString();
			for (const m of provider.staticModels) {
				await db.insert(cachedModels).values({
					id: m.id,
					provider: providerId,
					name: m.name,
					updatedAt: now
				});
			}
		}
	}

	if (targetProvider) {
		const models = await db.select().from(cachedModels).where(eq(cachedModels.provider, targetProvider));
		return json(models);
	}

	const models = await db.select().from(cachedModels);
	return json(models);
};
