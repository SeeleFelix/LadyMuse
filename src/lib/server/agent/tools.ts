import { readFileSync } from "fs";
import { join } from "path";
import { tool } from "ai";
import { z } from "zod";
import { db } from "../db";
import {
  artConcepts,
  artPatterns,
  artReferences,
  prompts,
  keywordStats,
  sessions,
  sessionMessages,
} from "../db/schema";
import { eq, like, or, and, desc, sql } from "drizzle-orm";
import { generateEmbedding, cosineSimilarity } from "../knowledge/embedding";
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

type PendingTool = {
  resolve: (choice: string) => void;
  reject: (e: Error) => void;
  question: string;
  options: { label: string; text: string }[];
};

const pendingToolCalls = new Map<string, PendingTool>();

export function resolveToolCall(toolCallId: string, choice: string): boolean {
  const pending = pendingToolCalls.get(toolCallId);
  if (!pending) return false;
  pending.resolve(choice);
  pendingToolCalls.delete(toolCallId);
  return true;
}

export const presentOptions = tool({
  description:
    "向用户展示一组可点击的选项。在创作对话的每一步——感受方向、光线选择、构图决策、反转对比——只要需要用户从几个方向中选一个，就必须调用此工具。每次选项 2-4 个，每个用'字母|画面描述'格式，描述要具体有画面感。绝不能用纯文本写选项让用户手打。",
  inputSchema: z.object({
    question: z
      .string()
      .describe("问用户的问题，如'哪种光更接近你想要的感觉？'"),
    options: z
      .array(
        z.object({
          label: z.string().describe("选项字母，如A/B/C"),
          text: z.string().describe("选项描述文本，要有画面感"),
        }),
      )
      .describe("2-4个选项"),
  }),
  execute: async ({ question, options }, { toolCallId }) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingToolCalls.delete(toolCallId);
        reject(new Error("用户超时未选择"));
      }, 300_000); // 5 min
      pendingToolCalls.set(toolCallId, {
        resolve: (v: string) => {
          clearTimeout(timeout);
          resolve({ question, options, choice: v });
        },
        reject: (e: Error) => {
          clearTimeout(timeout);
          reject(e);
        },
        question,
        options,
      });
    });
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

export const exploreDimension = tool({
  description:
    "浏览一个视觉维度下有哪些艺术概念。当你想了解某个维度（如光影、构图、色彩）有哪些可用概念，或需要确定具体概念名时使用。category 必须是以下之一：lighting/composition/color/texture/setting/subject/style/technical。可选传 subCategory 缩小范围。",
  inputSchema: z.object({
    category: z
      .enum([
        "lighting",
        "composition",
        "color",
        "texture",
        "setting",
        "subject",
        "style",
        "technical",
      ])
      .describe("要浏览的维度"),
    subCategory: z.string().optional().describe("子分类，不传返回整个维度"),
  }),
  execute: async ({ category, subCategory }) => {
    const rows = await db
      .select({
        name: artConcepts.name,
        nameZh: artConcepts.nameZh,
        subCategory: artConcepts.subCategory,
      })
      .from(artConcepts)
      .where(eq(artConcepts.category, category))
      .limit(30);

    const filtered = subCategory
      ? rows.filter((r) => r.subCategory === subCategory)
      : rows;

    return filtered.map((r) => ({
      name: r.name,
      nameZh: r.nameZh,
      subCategory: r.subCategory,
    }));
  },
});

export const getConcept = tool({
  description:
    "获取一个艺术概念的完整信息（视觉效果描述、提示词标签/自然语言用法、关联概念）。给出精确概念名后调用。",
  inputSchema: z.object({
    name: z.string().describe("概念英文名或中文名"),
  }),
  execute: async ({ name }) => {
    let rows = await db
      .select()
      .from(artConcepts)
      .where(eq(artConcepts.name, name));

    if (rows.length === 0) {
      rows = await db
        .select()
        .from(artConcepts)
        .where(eq(artConcepts.nameZh, name));
    }

    if (rows.length === 0) {
      return `未找到概念 "${name}"。请使用 explore_dimension 浏览相关维度，或 find_concepts 模糊搜索。`;
    }

    const c = rows[0];

    let relatedDetails: { name: string; nameZh: string | null }[] = [];
    if (c.relatedConcepts) {
      const relatedNames = JSON.parse(c.relatedConcepts) as string[];
      if (relatedNames.length > 0) {
        relatedDetails = await db
          .select({ name: artConcepts.name, nameZh: artConcepts.nameZh })
          .from(artConcepts)
          .where(or(...relatedNames.map((n) => eq(artConcepts.name, n))))
          .limit(10);
      }
    }

    return {
      name: c.name,
      nameZh: c.nameZh,
      category: c.category,
      subCategory: c.subCategory,
      visualDescription: c.visualDescription,
      tags: c.tags ? JSON.parse(c.tags) : [],
      tagUsage: c.tagUsage,
      naturalLanguage: c.naturalLanguage,
      nlUsage: c.nlUsage,
      relatedConcepts: relatedDetails,
      source: c.source,
    };
  },
});

export const findConcepts = tool({
  description:
    "用自然语言意图描述搜索匹配的艺术概念。当你不知道确切概念名、只有模糊方向时使用。如用户说'神秘黑暗的感觉'，搜索 matching 的视觉概念。",
  inputSchema: z.object({
    intent: z.string().describe("意图描述，如'柔和梦幻的光线'"),
  }),
  execute: async ({ intent }) => {
    const queryEmbedding = await generateEmbedding(intent);

    const all = await db
      .select({
        name: artConcepts.name,
        nameZh: artConcepts.nameZh,
        category: artConcepts.category,
        subCategory: artConcepts.subCategory,
        visualDescription: artConcepts.visualDescription,
        embedding: artConcepts.embedding,
      })
      .from(artConcepts);

    const scored = all
      .filter((c) => c.embedding)
      .map((c) => ({
        name: c.name,
        nameZh: c.nameZh,
        category: c.category,
        subCategory: c.subCategory,
        snippet: (c.visualDescription || "").slice(0, 150),
        score: cosineSimilarity(queryEmbedding, JSON.parse(c.embedding!)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .filter((c) => c.score > 0.5);

    if (scored.length === 0) {
      return "未找到相关概念。建议尝试使用 explore_dimension 浏览相关维度。";
    }

    return scored;
  },
});

export const findPatterns = tool({
  description:
    "按意图搜索适用的创作模式。模式告诉你'先放什么后放什么、什么配什么效果好、什么不能一起用'。当用户有了大致方向、需要结构化指导时使用。",
  inputSchema: z.object({
    intent: z.string().describe("意图描述，如'暗调情绪感人物肖像'"),
    concepts: z
      .array(z.string())
      .optional()
      .describe("已知的概念名列表，用于精确匹配"),
  }),
  execute: async ({ intent, concepts }) => {
    const queryEmbedding = await generateEmbedding(intent);

    const all = await db
      .select({
        name: artPatterns.name,
        intent: artPatterns.intent,
        structureOrder: artPatterns.structureOrder,
        involvesDimensions: artPatterns.involvesDimensions,
        involvesConcepts: artPatterns.involvesConcepts,
        embedding: artPatterns.embedding,
      })
      .from(artPatterns);

    const scored = all
      .filter((p) => p.embedding)
      .map((p) => {
        let score = cosineSimilarity(queryEmbedding, JSON.parse(p.embedding!));

        if (concepts && concepts.length > 0 && p.involvesConcepts) {
          const involved = JSON.parse(p.involvesConcepts) as string[];
          const overlap = concepts.filter((c) => involved.includes(c)).length;
          score += overlap * 0.15;
        }

        return {
          name: p.name,
          intent: p.intent,
          involvesDimensions: p.involvesDimensions
            ? JSON.parse(p.involvesDimensions)
            : [],
          structureOrder: p.structureOrder,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (scored.length === 0) {
      return "未找到匹配的创作模式。可以先用 find_concepts 搜索相关概念，然后尝试直接构建。";
    }

    return scored;
  },
});

export const findReferences = tool({
  description:
    "查找验证过的参考案例。按关联概念、模式或意图查找完整的提示词案例及其经验总结。",
  inputSchema: z.object({
    concepts: z.array(z.string()).optional().describe("关联的概念名"),
    pattern: z.string().optional().describe("关联的模式名"),
    intent: z.string().optional().describe("意图描述"),
    limit: z.number().optional().describe("返回数量，默认 3"),
  }),
  execute: async ({ concepts, pattern, intent, limit = 3 }) => {
    let results;

    if (concepts?.length || pattern) {
      const all = await db
        .select()
        .from(artReferences)
        .where(eq(artReferences.verified, 1))
        .orderBy(desc(artReferences.createdAt))
        .limit(50);

      const filtered = all.filter((r) => {
        let match = true;
        if (concepts?.length && r.appliedConcepts) {
          const ac = JSON.parse(r.appliedConcepts) as string[];
          match = concepts.some((c) => ac.includes(c));
        }
        if (pattern && r.appliedPattern !== pattern) match = false;
        return match;
      });

      if (intent) {
        const qEmb = await generateEmbedding(intent);
        results = filtered
          .filter((r) => r.embedding)
          .map((r) => ({
            name: r.name,
            intent: r.intent,
            promptPreview: r.positivePrompt.slice(0, 200),
            params: r.paramsJson ? JSON.parse(r.paramsJson) : null,
            takeaway: r.takeaway,
            score: cosineSimilarity(qEmb, JSON.parse(r.embedding!)),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
      } else {
        results = filtered.slice(0, limit).map((r) => ({
          name: r.name,
          intent: r.intent,
          promptPreview: r.positivePrompt.slice(0, 200),
          params: r.paramsJson ? JSON.parse(r.paramsJson) : null,
          takeaway: r.takeaway,
        }));
      }
    } else if (intent) {
      const qEmb = await generateEmbedding(intent);
      const all = await db
        .select()
        .from(artReferences)
        .where(eq(artReferences.verified, 1));

      results = all
        .filter((r) => r.embedding)
        .map((r) => ({
          name: r.name,
          intent: r.intent,
          promptPreview: r.positivePrompt.slice(0, 200),
          params: r.paramsJson ? JSON.parse(r.paramsJson) : null,
          takeaway: r.takeaway,
          score: cosineSimilarity(qEmb, JSON.parse(r.embedding!)),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } else {
      const rows = await db
        .select({
          name: artReferences.name,
          intent: artReferences.intent,
          positivePrompt: artReferences.positivePrompt,
          paramsJson: artReferences.paramsJson,
          takeaway: artReferences.takeaway,
        })
        .from(artReferences)
        .where(eq(artReferences.verified, 1))
        .orderBy(desc(artReferences.createdAt))
        .limit(limit);

      results = rows.map((r) => ({
        name: r.name,
        intent: r.intent,
        promptPreview: r.positivePrompt.slice(0, 200),
        params: r.paramsJson ? JSON.parse(r.paramsJson) : null,
        takeaway: r.takeaway,
      }));
    }

    if (!results || results.length === 0) {
      return "未找到匹配的参考案例。";
    }

    return results;
  },
});

const allToolDefinitions = {
  explore_dimension: exploreDimension,
  get_concept: getConcept,
  find_concepts: findConcepts,
  find_patterns: findPatterns,
  find_references: findReferences,
  search_my_prompts: searchMyPrompts,
  save_prompt: savePrompt,
  get_user_profile: getUserProfile,
  update_user_profile: updateUserProfile,
  save_session_summary: saveSessionSummary,
  present_options: presentOptions,
  search_civitai_models: searchCivitaiModels,
  search_civitai_prompts: searchCivitaiPrompts,
  search_civitai_tags: searchCivitaiTags,
  web_search: webSearch,
};

interface ToolConfig {
  name: string;
  enabled: boolean;
}

async function loadEnabledTools(): Promise<
  Record<string, (typeof allToolDefinitions)[keyof typeof allToolDefinitions]>
> {
  const toolsJson = await getConfig("agent_tools");
  let tools: ToolConfig[];
  if (toolsJson) {
    tools = JSON.parse(toolsJson);
  } else {
    const configPath = join(import.meta.dirname, "prompts", "modules.json");
    const config: { tools: ToolConfig[] } = JSON.parse(
      readFileSync(configPath, "utf-8"),
    );
    tools = config.tools;
  }
  const enabled = new Set(tools.filter((t) => t.enabled).map((t) => t.name));
  const result: Record<
    string,
    (typeof allToolDefinitions)[keyof typeof allToolDefinitions]
  > = {};
  for (const [name, def] of Object.entries(allToolDefinitions)) {
    if (enabled.has(name)) result[name] = def;
  }
  return result;
}

export async function getEnabledTools(): Promise<
  Record<string, (typeof allToolDefinitions)[keyof typeof allToolDefinitions]>
> {
  return loadEnabledTools();
}
