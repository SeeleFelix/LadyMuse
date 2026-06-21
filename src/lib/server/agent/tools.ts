import { tool } from "ai";
import { z } from "zod";
import { db } from "../db";
import modulesJsonData from "./prompts/modules.json";
import {
  artConcepts,
  artPatterns,
  artReferences,
  prompts,
  keywordStats,
  sessions,
  sessionMessages,
  danbooruTags,
  danbooruTagAliases,
  danbooruTagImplications,
} from "../db/schema";
import { eq, like, or, and, desc, sql } from "drizzle-orm";
import { generateEmbedding } from "../knowledge/embedding";
import { sqlite } from "../db";
import { searchImages, searchModels } from "../civitai";
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

function vecSearch(vecTable: string, queryEmbedding: number[], k: number) {
  const VALID = [
    "vec_concepts",
    "vec_patterns",
    "vec_references",
    "vec_danbooru",
  ] as const;
  if (!(VALID as readonly string[]).includes(vecTable)) {
    throw new Error(`Invalid vec table: ${vecTable}`);
  }
  const vec = new Float32Array(queryEmbedding);
  const blob = Buffer.from(vec.buffer);
  return sqlite
    .prepare(
      `SELECT id, distance FROM ${vecTable} WHERE embedding MATCH ? AND k = ? ORDER BY distance`,
    )
    .all(blob, k) as { id: string; distance: number }[];
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

export const listMyPrompts = tool({
  description:
    "列出用户最近保存的提示词目录（不含完整正向提示词）。用于浏览历史记录，了解有哪些已保存的提示词。需要查看完整详情时，用 get_prompt_by_id 按 id 获取。",
  inputSchema: z.object({
    limit: z
      .number()
      .min(1)
      .max(50)
      .optional()
      .describe("返回数量，默认 20，最大 50"),
  }),
  execute: async ({ limit = 20 }) => {
    const results = await db
      .select({
        id: prompts.id,
        title: prompts.title,
        notes: prompts.notes,
        rating: prompts.rating,
        tags: prompts.tags,
        createdAt: prompts.createdAt,
      })
      .from(prompts)
      .orderBy(desc(prompts.createdAt))
      .limit(limit);

    return results.map((p) => ({
      id: p.id,
      title: p.title,
      intent: p.notes,
      rating: p.rating,
      tags: p.tags,
      createdAt: p.createdAt,
    }));
  },
});

export const getPromptById = tool({
  description:
    "按 ID 获取一条提示词的完整详情，包括正向提示词、反向提示词、生成参数等。用于查看从 list_my_prompts 目录中找到的某条提示词的完整内容。",
  inputSchema: z.object({
    id: z.number().describe("提示词 ID"),
  }),
  execute: async ({ id }) => {
    const result = await db
      .select()
      .from(prompts)
      .where(eq(prompts.id, id))
      .limit(1);

    if (result.length === 0) {
      return { error: `未找到 ID 为 ${id} 的提示词` };
    }

    const p = result[0];
    return {
      id: p.id,
      title: p.title,
      positivePrompt: p.positivePrompt,
      negativePrompt: p.negativePrompt,
      intent: p.notes,
      rating: p.rating,
      tags: p.tags,
      sampler: p.sampler,
      scheduler: p.scheduler,
      steps: p.steps,
      cfgScale: p.cfgScale,
      width: p.width,
      height: p.height,
      createdAt: p.createdAt,
    };
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

export const searchCivitaiImages = tool({
  description: `Search Civitai for AI-generated images with prompts and generation parameters. Use this to find real prompt references, study how others write prompts for specific styles/subjects, or browse a model's gallery.

Tips:
- query must be English keywords
- Use different sort+period combinations for variety: sort="Newest" period="Week" for recent trends, sort="Most Comments" for discussion-worthy works
- Use modelId to browse a specific model or LoRA's gallery
- Use baseModels to filter by target architecture (e.g. "Illustrious", "SDXL 1.0", "Flux.1 D")
- Use username to study a specific creator's prompting style
- Use cursor to paginate through more results
- Results include image URLs`,
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe(
        "Search keywords, English. Don't pass this when browsing by modelId or username.",
      ),
    sort: z
      .enum([
        "Most Reactions",
        "Most Comments",
        "Most Collected",
        "Newest",
        "Oldest",
      ])
      .optional()
      .describe("Sort order, default 'Most Reactions'"),
    period: z
      .enum(["AllTime", "Year", "Month", "Week", "Day"])
      .optional()
      .describe("Time window, default 'AllTime'"),
    baseModels: z
      .string()
      .optional()
      .describe(
        "Filter by base model: Illustrious, SDXL 1.0, SD 1.5, Pony, Flux.1 D, etc.",
      ),
    modelId: z
      .number()
      .optional()
      .describe("Images from a specific model's gallery"),
    username: z.string().optional().describe("Images from a specific creator"),
    limit: z
      .number()
      .min(1)
      .max(20)
      .optional()
      .describe("Results per page, default 10, max 20"),
    cursor: z
      .string()
      .optional()
      .describe("Pagination cursor from previous response"),
  }),
  execute: async (params) => {
    try {
      const result = await searchImages({
        query: params.query,
        sort: params.sort,
        period: params.period,
        baseModels: params.baseModels,
        modelId: params.modelId,
        username: params.username,
        limit: params.limit ?? 10,
        cursor: params.cursor,
      });

      const images = result.items.map((img) => ({
        baseModel: img.baseModel,
        likes: img.stats?.likeCount,
        meta: img.meta
          ? {
              prompt: img.meta.prompt,
              negativePrompt: img.meta.negativePrompt || undefined,
              sampler: img.meta.sampler,
              cfgScale: img.meta.cfgScale,
              steps: img.meta.steps,
              resources: img.meta.resources,
            }
          : null,
      }));

      return {
        domain: result.usedDomain,
        images,
        nextCursor: result.nextCursor,
      };
    } catch (e: any) {
      return {
        error: `Civitai search failed: ${e.message}`,
        notice: "Please generate prompts based on your professional knowledge.",
      };
    }
  },
});

export const searchCivitaiModels = tool({
  description:
    "Search Civitai for AI image models (checkpoints, LoRAs, etc.). Returns model info: name, type, base model, tags, stats, description. To see a model's generated images with prompts, use search_civitai_images with that model's ID.",
  inputSchema: z.object({
    query: z.string().describe("Search by model name, English"),
    types: z
      .string()
      .optional()
      .describe(
        "Model type filter: Checkpoint, LORA, DoRA, Controlnet, Upscaler, etc.",
      ),
    baseModels: z
      .string()
      .optional()
      .describe("Filter by base model: Illustrious, SDXL 1.0, SD 1.5, etc."),
    sort: z
      .enum(["Highest Rated", "Most Downloaded", "Newest", "Most Liked"])
      .optional()
      .describe("Sort order, default 'Highest Rated'"),
    period: z
      .enum(["AllTime", "Year", "Month", "Week", "Day"])
      .optional()
      .describe("Time window, default 'AllTime'"),
    limit: z
      .number()
      .min(1)
      .max(10)
      .optional()
      .describe("Results count, default 5, max 10"),
  }),
  execute: async (params) => {
    try {
      const result = await searchModels({
        query: params.query,
        types: params.types,
        baseModels: params.baseModels,
        sort: params.sort,
        period: params.period,
        limit: params.limit ?? 5,
      });

      return {
        models: result.items.map((m) => ({
          id: m.id,
          name: m.name,
          type: m.type,
          baseModel: m.baseModel,
          tags: m.tags?.slice(0, 15),
          downloads: m.stats?.downloadCount,
          likes: m.stats?.thumbsUpCount,
          description: m.description?.slice(0, 300),
        })),
      };
    } catch (e: any) {
      return {
        error: `Civitai model search failed: ${e.message}`,
        notice: "Please proceed without model information.",
      };
    }
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
      .optional()
      .describe("可选，限定搜索范围到某个维度"),
  }),
  execute: async ({ intent, category }) => {
    const queryEmbedding = await generateEmbedding(intent);
    const rows = vecSearch("vec_concepts", queryEmbedding, 8);

    if (rows.length === 0) {
      return "向量索引为空。请先生成 embedding。";
    }

    const names = rows.map((r) => r.id);
    const conds = [or(...names.map((n) => eq(artConcepts.name, n)))];
    if (category) conds.push(eq(artConcepts.category, category));

    const concepts = await db
      .select({
        name: artConcepts.name,
        nameZh: artConcepts.nameZh,
        category: artConcepts.category,
        subCategory: artConcepts.subCategory,
        visualDescription: artConcepts.visualDescription,
      })
      .from(artConcepts)
      .where(and(...conds));

    const scoreMap = new Map(
      rows.map((r) => [r.id, 1 - (r.distance * r.distance) / 2]),
    );

    const results = concepts
      .map((c) => ({
        name: c.name,
        nameZh: c.nameZh,
        category: c.category,
        subCategory: c.subCategory,
        snippet: (c.visualDescription || "").slice(0, 150),
        score: Math.round((scoreMap.get(c.name) ?? 0) * 10000) / 10000,
      }))
      .filter((c) => c.score > 0.5)
      .sort((a, b) => b.score - a.score);

    if (results.length === 0) {
      return "未找到匹配度高的概念。建议尝试 explore_dimension 浏览相关维度。";
    }

    return results;
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
    const rows = vecSearch("vec_patterns", queryEmbedding, 8);

    if (rows.length === 0) {
      return "向量索引为空。请先生成 pattern embedding。";
    }

    const names = rows.map((r) => r.id);
    const patterns = await db
      .select({
        name: artPatterns.name,
        intent: artPatterns.intent,
        structureOrder: artPatterns.structureOrder,
        involvesDimensions: artPatterns.involvesDimensions,
        involvesConcepts: artPatterns.involvesConcepts,
      })
      .from(artPatterns)
      .where(or(...names.map((n) => eq(artPatterns.name, n))));

    const scoreMap = new Map(
      rows.map((r) => [r.id, 1 - (r.distance * r.distance) / 2]),
    );

    const scored = patterns
      .map((p) => {
        let score = scoreMap.get(p.name) ?? 0;

        if (concepts && concepts.length > 0 && p.involvesConcepts) {
          const involved = JSON.parse(p.involvesConcepts) as string[];
          const overlap = concepts.filter((c) => involved.includes(c)).length;
          score = Math.min(1, score + overlap * 0.15);
        }

        return {
          name: p.name,
          intent: p.intent,
          involvesDimensions: p.involvesDimensions
            ? JSON.parse(p.involvesDimensions)
            : [],
          structureOrder: p.structureOrder,
          score: Math.round(score * 10000) / 10000,
        };
      })
      .sort((a, b) => b.score - a.score)
      .filter((p) => p.score > 0.5)
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
        if (concepts?.length) {
          if (r.appliedConcepts) {
            const ac = JSON.parse(r.appliedConcepts) as string[];
            match = concepts.some((c) => ac.includes(c));
          } else {
            match = false;
          }
        }
        if (pattern && r.appliedPattern !== pattern) match = false;
        return match;
      });

      if (intent) {
        const qEmb = await generateEmbedding(intent);
        const vecRows = vecSearch("vec_references", qEmb, 20);
        const scoreMap = new Map(
          vecRows.map((r) => [r.id, 1 - (r.distance * r.distance) / 2]),
        );

        results = filtered
          .map((r) => ({
            name: r.name,
            intent: r.intent,
            promptPreview: r.positivePrompt.slice(0, 200),
            params: r.paramsJson ? JSON.parse(r.paramsJson) : null,
            takeaway: r.takeaway,
            score: Math.round((scoreMap.get(r.name) ?? 0) * 10000) / 10000,
          }))
          .filter((r) => r.score > 0.5)
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
      const vecRows = vecSearch("vec_references", qEmb, 20);
      const scoreMap = new Map(
        vecRows.map((r) => [r.id, 1 - (r.distance * r.distance) / 2]),
      );
      const names = vecRows.map((r) => r.id);

      if (names.length === 0) {
        return "未找到匹配的参考案例。";
      }

      const refs = await db
        .select()
        .from(artReferences)
        .where(
          and(
            eq(artReferences.verified, 1),
            or(...names.map((n) => eq(artReferences.name, n))),
          ),
        );

      results = refs
        .map((r) => ({
          name: r.name,
          intent: r.intent,
          promptPreview: r.positivePrompt.slice(0, 200),
          params: r.paramsJson ? JSON.parse(r.paramsJson) : null,
          takeaway: r.takeaway,
          score: Math.round((scoreMap.get(r.name) ?? 0) * 10000) / 10000,
        }))
        .filter((r) => r.score > 0.5)
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

async function enrichDanbooruTags(
  nameScores: Map<string, number>,
  maxTags: number,
) {
  const names = [...nameScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTags)
    .map(([name]) => name);

  if (names.length === 0) return { tags: [], relatedTags: [] };

  const tags = await db
    .select({
      name: danbooruTags.name,
      body: danbooruTags.body,
      postCount: danbooruTags.postCount,
    })
    .from(danbooruTags)
    .where(or(...names.map((n) => eq(danbooruTags.name, n))));

  const aliasRows = await db
    .select({
      consequentName: danbooruTagAliases.consequentName,
      antecedentName: danbooruTagAliases.antecedentName,
    })
    .from(danbooruTagAliases)
    .where(or(...names.map((n) => eq(danbooruTagAliases.consequentName, n))));
  const aliasMap = new Map<string, string[]>();
  for (const a of aliasRows) {
    const list = aliasMap.get(a.consequentName) ?? [];
    list.push(a.antecedentName);
    aliasMap.set(a.consequentName, list);
  }

  const implRows = await db
    .select({
      antecedentName: danbooruTagImplications.antecedentName,
      consequentName: danbooruTagImplications.consequentName,
    })
    .from(danbooruTagImplications)
    .where(
      or(...names.map((n) => eq(danbooruTagImplications.antecedentName, n))),
    );
  const implMap = new Map<string, string[]>();
  const allRelated = new Set<string>();
  for (const i of implRows) {
    const list = implMap.get(i.antecedentName) ?? [];
    list.push(i.consequentName);
    implMap.set(i.antecedentName, list);
    if (!nameScores.has(i.consequentName)) allRelated.add(i.consequentName);
  }

  return {
    tags: tags
      .map((t) => ({
        name: t.name,
        description: stripWikiBody(t.body || "").slice(0, 250),
        postCount: t.postCount,
        score: Math.round((nameScores.get(t.name) ?? 0) * 10000) / 10000,
        aliases: aliasMap.get(t.name) ?? [],
        implies: implMap.get(t.name) ?? [],
      }))
      .sort((a, b) => b.score - a.score),
    relatedTags: [...allRelated].slice(0, 15),
  };
}

export const searchDanbooruTags = tool({
  description:
    "语义搜索 Danbooru 标签。传入各视觉维度的英文描述，通过向量相似度发现语义相关的标签。用于找到你可能没想到但视觉上相关的标签。一次性传入所有维度描述。",
  inputSchema: z.object({
    queries: z
      .array(z.string())
      .min(1)
      .max(5)
      .describe(
        "各视觉维度的英文描述，如 'soft warm backlighting casting golden rim light'",
      ),
  }),
  execute: async ({ queries }) => {
    const allNames = new Map<string, number>();

    for (const description of queries) {
      const embedding = await generateEmbedding(description);
      const rows = vecSearch("vec_danbooru", embedding, 20);
      for (const r of rows) {
        const score = 1 - (r.distance * r.distance) / 2;
        if (score > 0.3) {
          const prev = allNames.get(r.id) ?? 0;
          if (score > prev) allNames.set(r.id, score);
        }
      }
    }

    if (allNames.size === 0) {
      return "未找到匹配的标签。尝试用更具体的英文视觉描述。";
    }

    return enrichDanbooruTags(allNames, 60);
  },
});

export const lookupDanbooruTags = tool({
  description:
    "精确查找 Danbooru 标签。传入关键词列表，通过标签名精确匹配、模糊匹配和别名展开查找。用于确认你已知的概念对应的标签。支持同时查找多个关键词。",
  inputSchema: z.object({
    keywords: z
      .array(z.string())
      .min(1)
      .max(10)
      .describe("标签名关键词，如 ['glasses', 'smoking', 'rain', 'night']"),
  }),
  execute: async ({ keywords }) => {
    const allNames = new Map<string, number>();

    for (const keyword of keywords) {
      const token = keyword.toLowerCase().replace(/\s+/g, "_");

      // Exact match = 1.0
      const exact = await db
        .select({ name: danbooruTags.name })
        .from(danbooruTags)
        .where(eq(danbooruTags.name, token))
        .limit(1);
      for (const r of exact) {
        allNames.set(r.name, 1.0);
      }

      // LIKE match = 0.7
      const likeResults = await db
        .select({ name: danbooruTags.name })
        .from(danbooruTags)
        .where(
          or(
            like(danbooruTags.name, `${token}\\_%`),
            like(danbooruTags.name, `%\\_${token}`),
            like(danbooruTags.name, `%\\_${token}\\_%`),
          ),
        )
        .limit(10);
      for (const r of likeResults) {
        if (!allNames.has(r.name)) allNames.set(r.name, 0.7);
      }

      // Alias expansion = 0.9
      const aliasRows = await db
        .select({ consequentName: danbooruTagAliases.consequentName })
        .from(danbooruTagAliases)
        .where(eq(danbooruTagAliases.antecedentName, token))
        .limit(5);
      for (const a of aliasRows) {
        if (!allNames.has(a.consequentName))
          allNames.set(a.consequentName, 0.9);
      }
    }

    if (allNames.size === 0) {
      return "未找到匹配的标签。检查关键词拼写，使用下划线格式的标签名。";
    }

    return enrichDanbooruTags(allNames, 30);
  },
});

export const browseDanbooruTags = tool({
  description:
    "浏览 Danbooru 标签库中某个 topic 下的标签分组。先看有什么分类，再深入了解具体标签。",
  inputSchema: z.object({
    topic: z
      .enum([
        "lighting",
        "composition",
        "colors",
        "aesthetic",
        "background",
        "posture",
        "gestures",
        "focus",
      ])
      .describe("要浏览的 topic"),
  }),
  execute: async ({ topic }) => {
    const { fetchTagGroup, TAG_GROUP_TOPICS } = await import("../danbooru");
    const wikiPage = TAG_GROUP_TOPICS[topic as keyof typeof TAG_GROUP_TOPICS];
    if (!wikiPage) return `Unknown topic: ${topic}`;

    const groups = await fetchTagGroup(wikiPage);
    if (groups.length === 0) return `Topic "${topic}" returned no data.`;

    return groups.map((g) => ({
      section: g.section,
      tags: g.tags,
    }));
  },
});

export const getDanbooruTag = tool({
  description:
    "查看单个 Danbooru 标签的完整信息，包括描述、别名、关联标签。用于确认标签含义后再使用。",
  inputSchema: z.object({
    name: z.string().describe("标签名，如'backlighting'"),
  }),
  execute: async ({ name }) => {
    const tag = await db
      .select({
        name: danbooruTags.name,
        body: danbooruTags.body,
        postCount: danbooruTags.postCount,
        otherNames: danbooruTags.otherNames,
      })
      .from(danbooruTags)
      .where(eq(danbooruTags.name, name))
      .limit(1);

    if (tag.length === 0) return `标签 "${name}" 未找到。`;

    const [aliases, implications] = await Promise.all([
      db
        .select({
          antecedentName: danbooruTagAliases.antecedentName,
        })
        .from(danbooruTagAliases)
        .where(eq(danbooruTagAliases.consequentName, name)),
      db
        .select({
          consequentName: danbooruTagImplications.consequentName,
        })
        .from(danbooruTagImplications)
        .where(eq(danbooruTagImplications.antecedentName, name)),
    ]);

    const t = tag[0];
    return {
      name: t.name,
      description: stripWikiBody(t.body || "").slice(0, 400),
      postCount: t.postCount,
      otherNames: t.otherNames ? JSON.parse(t.otherNames as string) : [],
      aliases: aliases.map((a) => a.antecedentName),
      implies: implications.map((i) => i.consequentName),
    };
  },
});

function stripWikiBody(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\{\{([^}]+)\}\}/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^[#h][1-6][.#\w-]*\.?\s*/gm, "")
    .replace(/\[\[|\]\]/g, "")
    .replace(/\[b\]|\[\/b\]|\[i\]|\[\/i\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const allToolDefinitions = {
  explore_dimension: exploreDimension,
  get_concept: getConcept,
  find_concepts: findConcepts,
  find_patterns: findPatterns,
  find_references: findReferences,
  search_my_prompts: searchMyPrompts,
  list_my_prompts: listMyPrompts,
  get_prompt_by_id: getPromptById,
  save_prompt: savePrompt,
  get_user_profile: getUserProfile,
  update_user_profile: updateUserProfile,
  save_session_summary: saveSessionSummary,
  present_options: presentOptions,
  search_civitai_images: searchCivitaiImages,
  search_civitai_models: searchCivitaiModels,
  web_search: webSearch,
  search_danbooru_tags: searchDanbooruTags,
  lookup_danbooru_tags: lookupDanbooruTags,
  browse_danbooru_tags: browseDanbooruTags,
  get_danbooru_tag: getDanbooruTag,
};

interface ToolConfig {
  name: string;
  enabled: boolean;
}

async function loadEnabledTools(): Promise<
  Record<string, (typeof allToolDefinitions)[keyof typeof allToolDefinitions]>
> {
  // File defaults are the source of truth for which tools exist.
  // DB config only overrides enabled/disabled for tools it knows about.
  const toolsJson = await getConfig("agent_tools");
  const fileTools: ToolConfig[] = (modulesJsonData as { tools: ToolConfig[] })
    .tools;
  const dbOverrides: ToolConfig[] = toolsJson ? JSON.parse(toolsJson) : [];
  const overrideMap = new Map(dbOverrides.map((t) => [t.name, t]));
  const tools = fileTools.map((t) =>
    overrideMap.has(t.name)
      ? { ...t, enabled: overrideMap.get(t.name)!.enabled }
      : t,
  );
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
