import { readFileSync } from "fs";
import { join } from "path";
import { tool } from "ai";
import { z } from "zod";
import { db } from "../db";
import {
  artTechniques,
  styles,
  prompts,
  keywordStats,
  sessions,
  sessionMessages,
} from "../db/schema";
import { eq, like, or, and, desc, sql } from "drizzle-orm";
import {
  searchModels,
  searchImages,
  searchImagesWithFallback,
  fetchModelImages,
  fetchPopularImages,
  fetchTags,
} from "../civitai";
import { searxngSearch } from "../searxng";
import { getConfig } from "../config";
import { getTagsByTopic, type DanbooruTopic } from "../danbooru-sync";

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
  description:
    '搜索艺术知识库（技法、风格、概念）。当用户提到视觉感觉或需要艺术概念参考时使用。请用简短英文关键词搜索，可以一次传多个词（如 "chiaroscuro dark lighting"）。',
  inputSchema: z.object({
    query: z.string().describe("搜索关键词，多个词用空格分隔"),
    type: z.enum(["technique", "style", "all"]).describe("搜索类型，默认 all"),
  }),
  execute: async (params) => {
    const { query, type = "all" } = params ?? {};
    if (!query) return "请提供搜索关键词";

    const words = query.split(/\s+/).filter(Boolean);
    if (words.length === 0) return "请提供搜索关键词";

    const results: any[] = [];

    if (type === "technique" || type === "all") {
      const techFields = [
        artTechniques.name,
        artTechniques.nameZh,
        artTechniques.promptKeywords,
        artTechniques.nlDescription,
        artTechniques.moodTags,
        artTechniques.tags,
        artTechniques.description,
      ];
      const techs = await db
        .select()
        .from(artTechniques)
        .where(buildMultiWordFilter(words, techFields))
        .limit(5);

      for (const t of techs) {
        results.push({
          type: "technique",
          name: t.nameZh || t.name,
          nameEn: t.name,
          keywords: t.promptKeywords,
          nlDescription: t.nlDescription,
          description: t.description?.slice(0, 200),
          mood: t.moodTags,
        });
      }
    }

    if (type === "style" || type === "all") {
      const styleFields = [
        styles.name,
        styles.nameZh,
        styles.tags,
        styles.description,
        styles.qualityTags,
      ];
      const matchedStyles = await db
        .select()
        .from(styles)
        .where(buildMultiWordFilter(words, styleFields))
        .limit(3);

      for (const s of matchedStyles) {
        results.push({
          type: "style",
          name: s.nameZh || s.name,
          nameEn: s.name,
          positiveTemplate: s.positiveTemplate,
          nlTemplate: s.nlTemplate,
          negativePrompt: s.negativePrompt,
          recommendedParams: s.recommendedParams,
        });
      }
    }

    return results.length > 0 ? results : `未找到与"${query}"匹配的结果`;
  },
});

export const searchMyPrompts = tool({
  description: "搜索用户历史保存的提示词。查找与当前创作意图相似的历史经验。",
  inputSchema: z.object({
    query: z.string().describe("搜索意图关键词"),
  }),
  execute: async ({ query }) => {
    const words = query.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];

    const promptFields = [
      prompts.positivePrompt,
      prompts.title,
      prompts.notes,
      prompts.tags,
    ];
    const results = await db
      .select()
      .from(prompts)
      .where(buildMultiWordFilter(words, promptFields))
      .orderBy(desc(prompts.createdAt))
      .limit(5);

    return results.map((p) => ({
      id: p.id,
      title: p.title,
      positive: p.positivePrompt.slice(0, 200),
      negative: p.negativePrompt?.slice(0, 100),
      rating: p.rating,
      notes: p.notes,
      tags: p.tags,
    }));
  },
});

export const savePrompt = tool({
  description:
    '保存提示词到用户个人库。当用户说"保存"或对当前提示词满意时使用。',
  inputSchema: z.object({
    positive: z.string().describe("正向提示词"),
    negative: z.string().optional().describe("反向提示词"),
    title: z.string().optional().describe("标题"),
    intent: z.string().optional().describe("创作意图描述"),
    model_type: z
      .string()
      .optional()
      .describe("目标模型类型：ZIT/SDXL/SD1.5/FLUX/Illustrious/Anima"),
    tags: z.string().optional().describe("标签，逗号分隔"),
    rating: z.number().min(1).max(5).optional().describe("用户评分"),
    sampler: z.string().optional().describe("采样器"),
    scheduler: z.string().optional().describe("调度器"),
    steps: z.number().optional().describe("步数"),
    cfg_scale: z.number().optional().describe("CFG Scale"),
    width: z.number().optional().describe("宽度"),
    height: z.number().optional().describe("高度"),
  }),
  execute: async (params) => {
    const result = await db
      .insert(prompts)
      .values({
        title: params.title || "未命名",
        positivePrompt: params.positive,
        negativePrompt: params.negative,
        notes: params.intent,
        tags: params.tags,
        rating: params.rating,
        source: "agent",
        sampler: params.sampler,
        scheduler: params.scheduler,
        steps: params.steps,
        cfgScale: params.cfg_scale,
        width: params.width,
        height: params.height,
      })
      .returning();

    return { success: true, id: result[0].id };
  },
});

export const getUserProfile = tool({
  description:
    "获取用户偏好画像。包括常用模型、偏好风格、有效关键词等。用于个性化建议。",
  inputSchema: z.object({}),
  execute: async () => {
    const stats = await db
      .select()
      .from(keywordStats)
      .orderBy(desc(keywordStats.avgRating));
    const topKeywords = stats.slice(0, 10).map((s) => ({
      keyword: s.keyword,
      avgRating: s.avgRating,
      usageCount: s.usageCount,
    }));

    const recentPrompts = await db
      .select()
      .from(prompts)
      .orderBy(desc(prompts.createdAt))
      .limit(5);

    const sessionCount =
      (await db.select({ count: sql`count(*)` }).from(sessions))[0]?.count ?? 0;

    return {
      topEffectiveKeywords: topKeywords,
      recentSavedPrompts: recentPrompts.map((p) => ({
        id: p.id,
        title: p.title,
        rating: p.rating,
      })),
      totalSessions: sessionCount,
      totalSavedPrompts: recentPrompts.length,
    };
  },
});

export const updateUserProfile = tool({
  description: "更新用户偏好画像。当发现用户偏好某个关键词或风格时自动调用。",
  inputSchema: z.object({
    effective_keywords: z
      .array(z.string())
      .optional()
      .describe("新增的有效关键词"),
    preferred_style: z.string().optional().describe("偏好的风格描述"),
  }),
  execute: async (params) => {
    if (params.effective_keywords) {
      for (const keyword of params.effective_keywords) {
        const existing = await db
          .select()
          .from(keywordStats)
          .where(eq(keywordStats.keyword, keyword));
        if (existing.length > 0) {
          await db
            .update(keywordStats)
            .set({
              usageCount: (existing[0].usageCount ?? 0) + 1,
              lastUsedAt: new Date().toISOString(),
            })
            .where(eq(keywordStats.keyword, keyword));
        } else {
          await db.insert(keywordStats).values({
            keyword,
            usageCount: 1,
            lastUsedAt: new Date().toISOString(),
          });
        }
      }
    }
    return { success: true, updated: params };
  },
});

export const saveSessionSummary = tool({
  description: "保存会话摘要。当对话结束时调用，记录本次创作的关键信息。",
  inputSchema: z.object({
    summary: z.string().describe("本次会话的摘要"),
    key_decisions: z.array(z.string()).describe("关键创作决策"),
  }),
  execute: async ({ summary, key_decisions }) => {
    return { success: true, note: "摘要已记录" };
  },
});

export const searchCivitaiModels = tool({
  description:
    "从 Civitai 搜索 AI 图像模型。查找 Checkpoint、LoRA 等模型及其描述、标签、下载量。当用户想了解某个风格或主题有哪些可用模型时使用。",
  inputSchema: z.object({
    query: z
      .string()
      .describe("搜索关键词，英文，如 anime、realistic portrait"),
    limit: z.number().optional().describe("返回数量，默认 5"),
  }),
  execute: async ({ query, limit = 5 }) => {
    const result = await searchModels(query, limit);
    return result.items.map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      baseModel: m.baseModel,
      downloads: m.stats?.downloadCount,
      tags: m.tags?.slice(0, 10),
      description: m.description?.slice(0, 200),
    }));
  },
});

export const searchCivitaiPrompts = tool({
  description:
    "从 Civitai 搜索真实的高质量提示词参考。搜索约 30 张高赞图片，提取完整 prompt 和参数，返回给你分析。你应该从中提炼出有效的关键词模式、常用参数配置、视觉概念，然后用你自己的理解重新组织成符合用户风格偏好的提示词。重要：query 必须使用英文关键词，如果用户说的是中文，请先翻译成英文再搜索。",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "搜索关键词，必须使用英文，如 crying girl、landscape sunset、cyberpunk city",
      ),
  }),
  execute: async ({ query }) => {
    try {
      const { items, fallback } = await searchImagesWithFallback(query, 30);

      const prompts = items
        .filter((img) => img.meta?.prompt)
        .slice(0, 30)
        .map((img) => ({
          prompt: img.meta!.prompt,
          negativePrompt: img.meta!.negativePrompt || undefined,
          sampler: img.meta!.sampler,
          cfgScale: img.meta!.cfgScale,
          steps: img.meta!.steps,
          size: img.meta!.Size,
          baseModel: img.baseModel,
          likes: img.stats?.likeCount,
        }));

      if (prompts.length === 0) {
        return {
          notice: "未找到包含提示词的图片。请直接基于你的专业知识生成提示词。",
          query,
        };
      }

      return {
        query,
        fallback,
        totalResults: prompts.length,
        prompts,
      };
    } catch (e: any) {
      return {
        error: `Civitai 搜索失败: ${e.message}`,
        query,
        notice: "请直接基于你的专业知识生成提示词。",
      };
    }
  },
});

export const searchCivitaiTags = tool({
  description:
    "从 Civitai 搜索标签。查找与图像生成相关的标签关键词及其使用频次。当用户需要了解某个标签的流行度或寻找相关标签时使用。",
  inputSchema: z.object({
    query: z.string().describe("搜索关键词，英文"),
    limit: z.number().optional().describe("返回数量，默认 10"),
  }),
  execute: async ({ query, limit = 10 }) => {
    const result = await fetchTags(query, limit);
    return result.items.map((t) => ({
      name: t.name,
      modelCount: t.modelCount,
    }));
  },
});

export const webSearch = tool({
  description:
    "搜索互联网获取实时信息。当用户询问知识库和 Civitai 之外的信息时使用，如艺术家资料、最新画风趋势、技法教程、文化背景等。query 使用英文关键词效果更好。",
  inputSchema: z.object({
    query: z.string().describe("搜索关键词，英文效果更好"),
    search_depth: z
      .enum(["basic", "advanced"])
      .optional()
      .describe("搜索深度，默认 basic"),
  }),
  execute: async ({ query, search_depth }) => {
    const baseUrl = (await getConfig("searxng_url")) || "http://localhost:8888";
    try {
      const { results } = await searxngSearch(query, baseUrl, {
        categories: search_depth === "advanced" ? "general" : "general",
      });
      if (results.length === 0) {
        return `未找到与"${query}"相关的结果`;
      }
      return {
        results: results.slice(0, 10).map((r) => ({
          title: r.title,
          url: r.url,
          content: r.content?.slice(0, 500),
        })),
      };
    } catch (e: any) {
      return {
        error: `Web 搜索失败: ${e.message}`,
        notice: "请直接基于你的专业知识回答。",
      };
    }
  },
});

export const discoverVisualConcepts = tool({
  description:
    "发现与当前创作主题相关的视觉概念标签。覆盖光影、构图、姿态、色彩、美学风格、背景、手势、景深等。从本地数据库读取 Danbooru 标签数据，用于发现你可能不知道的有用视觉概念。",
  inputSchema: z.object({
    topic: z
      .enum([
        "lighting",
        "composition",
        "posture",
        "colors",
        "aesthetic",
        "background",
        "gestures",
        "focus",
      ])
      .describe("要探索的视觉概念领域"),
  }),
  execute: async ({ topic }) => {
    try {
      const tags = await getTagsByTopic(topic as DanbooruTopic);
      if (tags.length === 0) {
        return {
          notice: `本地数据库中没有 "${topic}" 的标签数据。请先在管理页面同步 Danbooru 数据。`,
          topic,
        };
      }

      // Group by section
      const sections: Record<string, { tags: string[]; topTags: string[] }> =
        {};
      for (const tag of tags) {
        const section = tag.section || "other";
        if (!sections[section]) {
          sections[section] = { tags: [], topTags: [] };
        }
        sections[section].tags.push(tag.tagName);
        if (
          sections[section].topTags.length < 5 &&
          (tag.postCount ?? 0) > 100
        ) {
          sections[section].topTags.push(tag.tagName);
        }
      }

      return {
        topic,
        totalTags: tags.length,
        sections: Object.entries(sections).map(([name, data]) => ({
          section: name,
          tagCount: data.tags.length,
          allTags: data.tags,
          popularTags: data.topTags,
        })),
      };
    } catch (e: any) {
      return {
        error: `视觉概念查询失败: ${e.message}`,
        notice: "请直接基于你的专业知识生成提示词。",
      };
    }
  },
});

const allToolDefinitions = {
  knowledge_search: knowledgeSearch,
  search_my_prompts: searchMyPrompts,
  save_prompt: savePrompt,
  get_user_profile: getUserProfile,
  update_user_profile: updateUserProfile,
  save_session_summary: saveSessionSummary,
  search_civitai_models: searchCivitaiModels,
  search_civitai_prompts: searchCivitaiPrompts,
  search_civitai_tags: searchCivitaiTags,
  discover_visual_concepts: discoverVisualConcepts,
  web_search: webSearch,
};

interface ToolConfig {
  name: string;
  enabled: boolean;
}

function loadEnabledTools(): Record<
  string,
  (typeof allToolDefinitions)[keyof typeof allToolDefinitions]
> {
  const configPath = join(import.meta.dirname, "prompts", "modules.json");
  const config: { tools: ToolConfig[] } = JSON.parse(
    readFileSync(configPath, "utf-8"),
  );
  const enabled = new Set(
    config.tools.filter((t) => t.enabled).map((t) => t.name),
  );
  const result: Record<
    string,
    (typeof allToolDefinitions)[keyof typeof allToolDefinitions]
  > = {};
  for (const [name, def] of Object.entries(allToolDefinitions)) {
    if (enabled.has(name)) result[name] = def;
  }
  return result;
}

export function getEnabledTools(): Record<
  string,
  (typeof allToolDefinitions)[keyof typeof allToolDefinitions]
> {
  return loadEnabledTools();
}
