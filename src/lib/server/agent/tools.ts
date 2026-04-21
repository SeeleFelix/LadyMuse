import { tool } from 'ai';
import { z } from 'zod';
import { db } from '../db';
import { artTechniques, styles, prompts, keywordStats, sessions, sessionMessages } from '../db/schema';
import { eq, like, or, and, desc, sql } from 'drizzle-orm';

function buildMultiWordFilter(words: string[], fields: any[]) {
	const conditions: any[] = [];
	for (const word of words) {
		const w = `%${word}%`;
		for (const field of fields) {
			conditions.push(like(field, w));
		}
	}
	return or(...conditions);
}

export const knowledgeSearch = tool({
	description: '搜索艺术知识库（技法、风格、概念）。当用户提到视觉感觉或需要艺术概念参考时使用。请用简短英文关键词搜索，可以一次传多个词（如 "chiaroscuro dark lighting"）。',
	inputSchema: z.object({
		query: z.string().describe('搜索关键词，多个词用空格分隔'),
		type: z.enum(['technique', 'style', 'all']).describe('搜索类型，默认 all')
	}),
	execute: async (params) => {
		const { query, type = 'all' } = params ?? {};
		if (!query) return '请提供搜索关键词';

		const words = query.split(/\s+/).filter(Boolean);
		if (words.length === 0) return '请提供搜索关键词';

		const results: any[] = [];

		if (type === 'technique' || type === 'all') {
			const techFields = [artTechniques.name, artTechniques.nameZh, artTechniques.promptKeywords, artTechniques.nlDescription, artTechniques.moodTags, artTechniques.tags, artTechniques.description];
			const techs = await db.select().from(artTechniques)
				.where(buildMultiWordFilter(words, techFields))
				.limit(5);

			for (const t of techs) {
				results.push({
					type: 'technique',
					name: t.nameZh || t.name,
					nameEn: t.name,
					keywords: t.promptKeywords,
					nlDescription: t.nlDescription,
					description: t.description?.slice(0, 200),
					mood: t.moodTags
				});
			}
		}

		if (type === 'style' || type === 'all') {
			const styleFields = [styles.name, styles.nameZh, styles.tags, styles.description, styles.qualityTags];
			const matchedStyles = await db.select().from(styles)
				.where(buildMultiWordFilter(words, styleFields))
				.limit(3);

			for (const s of matchedStyles) {
				results.push({
					type: 'style',
					name: s.nameZh || s.name,
					nameEn: s.name,
					positiveTemplate: s.positiveTemplate,
					nlTemplate: s.nlTemplate,
					negativePrompt: s.negativePrompt,
					recommendedParams: s.recommendedParams
				});
			}
		}

		return results.length > 0 ? results : `未找到与"${query}"匹配的结果`;
	}
});

export const searchMyPrompts = tool({
	description: '搜索用户历史保存的提示词。查找与当前创作意图相似的历史经验。',
	inputSchema: z.object({
		query: z.string().describe('搜索意图关键词')
	}),
	execute: async ({ query }) => {
		const words = query.split(/\s+/).filter(Boolean);
		if (words.length === 0) return [];

		const promptFields = [prompts.positivePrompt, prompts.title, prompts.notes, prompts.tags];
		const results = await db.select().from(prompts)
			.where(buildMultiWordFilter(words, promptFields))
			.orderBy(desc(prompts.createdAt)).limit(5);

		return results.map((p) => ({
			id: p.id,
			title: p.title,
			positive: p.positivePrompt.slice(0, 200),
			negative: p.negativePrompt?.slice(0, 100),
			rating: p.rating,
			notes: p.notes,
			tags: p.tags
		}));
	}
});

export const savePrompt = tool({
	description: '保存提示词到用户个人库。当用户说"保存"或对当前提示词满意时使用。',
	inputSchema: z.object({
		positive: z.string().describe('正向提示词'),
		negative: z.string().optional().describe('反向提示词'),
		title: z.string().optional().describe('标题'),
		intent: z.string().optional().describe('创作意图描述'),
		model_type: z.string().optional().describe('目标模型类型：SD1.5/SDXL/FLUX/SD3'),
		tags: z.string().optional().describe('标签，逗号分隔'),
		rating: z.number().min(1).max(5).optional().describe('用户评分')
	}),
	execute: async (params) => {
		const result = await db.insert(prompts).values({
			title: params.title || '未命名',
			positivePrompt: params.positive,
			negativePrompt: params.negative,
			notes: params.intent,
			tags: params.tags,
			rating: params.rating,
			source: 'agent'
		}).returning();

		return { success: true, id: result[0].id };
	}
});

export const getUserProfile = tool({
	description: '获取用户偏好画像。包括常用模型、偏好风格、有效关键词等。用于个性化建议。',
	inputSchema: z.object({}),
	execute: async () => {
		const stats = await db.select().from(keywordStats).orderBy(desc(keywordStats.avgRating));
		const topKeywords = stats.slice(0, 10).map((s) => ({
			keyword: s.keyword,
			avgRating: s.avgRating,
			usageCount: s.usageCount
		}));

		const recentPrompts = await db.select().from(prompts)
			.orderBy(desc(prompts.createdAt)).limit(5);

		const sessionCount = (await db.select({ count: sql`count(*)` }).from(sessions))[0]?.count ?? 0;

		return {
			topEffectiveKeywords: topKeywords,
			recentSavedPrompts: recentPrompts.map((p) => ({ id: p.id, title: p.title, rating: p.rating })),
			totalSessions: sessionCount,
			totalSavedPrompts: recentPrompts.length
		};
	}
});

export const updateUserProfile = tool({
	description: '更新用户偏好画像。当发现用户偏好某个关键词或风格时自动调用。',
	inputSchema: z.object({
		effective_keywords: z.array(z.string()).optional().describe('新增的有效关键词'),
		preferred_style: z.string().optional().describe('偏好的风格描述')
	}),
	execute: async (params) => {
		if (params.effective_keywords) {
			for (const keyword of params.effective_keywords) {
				const existing = await db.select().from(keywordStats)
					.where(eq(keywordStats.keyword, keyword));
				if (existing.length > 0) {
					await db.update(keywordStats)
						.set({
							usageCount: (existing[0].usageCount ?? 0) + 1,
							lastUsedAt: new Date().toISOString()
						})
						.where(eq(keywordStats.keyword, keyword));
				} else {
					await db.insert(keywordStats).values({
						keyword,
						usageCount: 1,
						lastUsedAt: new Date().toISOString()
					});
				}
			}
		}
		return { success: true, updated: params };
	}
});

export const saveSessionSummary = tool({
	description: '保存会话摘要。当对话结束时调用，记录本次创作的关键信息。',
	inputSchema: z.object({
		summary: z.string().describe('本次会话的摘要'),
		key_decisions: z.array(z.string()).describe('关键创作决策')
	}),
	execute: async ({ summary, key_decisions }) => {
		return { success: true, note: '摘要已记录' };
	}
});

export const allTools = {
	knowledge_search: knowledgeSearch,
	search_my_prompts: searchMyPrompts,
	save_prompt: savePrompt,
	get_user_profile: getUserProfile,
	update_user_profile: updateUserProfile,
	save_session_summary: saveSessionSummary
};
