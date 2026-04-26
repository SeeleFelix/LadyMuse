import { db } from "./db";
import { usageLogs, cachedModels, userConfig, sessions } from "./db/schema";
import { eq, sql, and, gte } from "drizzle-orm";
import { getConfig } from "./config";

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
}

interface PricingTier {
  cache_hit: number;
  cache_miss: number;
  output: number;
}

interface CostResult {
  cost: number;
  currency: string;
  breakdown: {
    cacheHitTokens: number;
    cacheMissTokens: number;
    outputTokens: number;
    cacheHitCost: number;
    cacheMissCost: number;
    outputCost: number;
  };
  source: "reported" | "calculated";
}

export async function calculateCost(
  provider: string,
  modelId: string,
  usage: TokenUsage,
  reportedCost?: number,
): Promise<CostResult> {
  const { inputTokens, outputTokens, cacheReadTokens = 0 } = usage;
  const cacheMissTokens = inputTokens - cacheReadTokens;

  // OpenRouter: use reported cost from header if available
  if (provider === "openrouter" && reportedCost != null) {
    return {
      cost: reportedCost,
      currency: "USD",
      breakdown: {
        cacheHitTokens: cacheReadTokens,
        cacheMissTokens,
        outputTokens,
        cacheHitCost: 0,
        cacheMissCost: 0,
        outputCost: 0,
      },
      source: "reported",
    };
  }

  // DeepSeek: calculate from configured pricing (3-tier)
  if (provider === "deepseek") {
    const pricingJson = await getConfig("pricing_deepseek");
    const pricing: Record<string, PricingTier> = pricingJson
      ? JSON.parse(pricingJson)
      : {};

    const modelPricing = pricing[modelId];
    if (!modelPricing) {
      return {
        cost: 0,
        currency: "CNY",
        breakdown: {
          cacheHitTokens: cacheReadTokens,
          cacheMissTokens,
          outputTokens,
          cacheHitCost: 0,
          cacheMissCost: 0,
          outputCost: 0,
        },
        source: "calculated",
      };
    }

    const cacheHitCost = (cacheReadTokens / 1_000_000) * modelPricing.cache_hit;
    const cacheMissCost =
      (cacheMissTokens / 1_000_000) * modelPricing.cache_miss;
    const outputCost = (outputTokens / 1_000_000) * modelPricing.output;

    return {
      cost: cacheHitCost + cacheMissCost + outputCost,
      currency: "CNY",
      breakdown: {
        cacheHitTokens: cacheReadTokens,
        cacheMissTokens,
        outputTokens,
        cacheHitCost,
        cacheMissCost,
        outputCost,
      },
      source: "calculated",
    };
  }

  // OpenRouter fallback: estimate from cached model pricing
  if (provider === "openrouter") {
    const rows = await db
      .select({ pricing: cachedModels.pricing })
      .from(cachedModels)
      .where(eq(cachedModels.id, modelId))
      .limit(1);

    if (rows.length > 0 && rows[0].pricing) {
      const pricing = JSON.parse(rows[0].pricing);
      const promptPrice = Number(pricing.prompt) || 0;
      const completionPrice = Number(pricing.completion) || 0;
      const inputCost = (inputTokens / 1_000_000) * promptPrice;
      const outputCost = (outputTokens / 1_000_000) * completionPrice;
      return {
        cost: inputCost + outputCost,
        currency: "USD",
        breakdown: {
          cacheHitTokens: cacheReadTokens,
          cacheMissTokens,
          outputTokens,
          cacheHitCost: 0,
          cacheMissCost: inputCost,
          outputCost,
        },
        source: "calculated",
      };
    }
  }

  return {
    cost: 0,
    currency: "USD",
    breakdown: {
      cacheHitTokens: cacheReadTokens,
      cacheMissTokens,
      outputTokens,
      cacheHitCost: 0,
      cacheMissCost: 0,
      outputCost: 0,
    },
    source: "calculated",
  };
}

export async function checkBudget(): Promise<{
  allowed: boolean;
  dailyCost: number;
  monthlyCost: number;
  dailyLimit: number | null;
  monthlyLimit: number | null;
}> {
  const dailyLimitStr = await getConfig("budget_daily_limit");
  const monthlyLimitStr = await getConfig("budget_monthly_limit");
  const dailyLimit = dailyLimitStr ? Number(dailyLimitStr) : null;
  const monthlyLimit = monthlyLimitStr ? Number(monthlyLimitStr) : null;

  if (!dailyLimit && !monthlyLimit) {
    return {
      allowed: true,
      dailyCost: 0,
      monthlyCost: 0,
      dailyLimit,
      monthlyLimit,
    };
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);

  let dailyCost = 0;
  let monthlyCost = 0;

  if (dailyLimit) {
    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(${usageLogs.cost}), 0)` })
      .from(usageLogs)
      .where(
        and(
          eq(usageLogs.currency, "CNY"),
          gte(usageLogs.createdAt, todayStart),
        ),
      );
    dailyCost = Number(result[0]?.total ?? 0);
  }

  if (monthlyLimit) {
    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(${usageLogs.cost}), 0)` })
      .from(usageLogs)
      .where(
        and(
          eq(usageLogs.currency, "CNY"),
          gte(usageLogs.createdAt, monthStart),
        ),
      );
    monthlyCost = Number(result[0]?.total ?? 0);
  }

  const allowed =
    (dailyLimit == null || dailyCost < dailyLimit) &&
    (monthlyLimit == null || monthlyCost < monthlyLimit);

  return { allowed, dailyCost, monthlyCost, dailyLimit, monthlyLimit };
}

export async function logUsage(entry: {
  sessionId?: number;
  provider: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  cacheHitTokens?: number;
  cost: number;
  currency: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  await db.insert(usageLogs).values({
    sessionId: entry.sessionId,
    provider: entry.provider,
    modelId: entry.modelId,
    inputTokens: entry.inputTokens,
    outputTokens: entry.outputTokens,
    cacheHitTokens: entry.cacheHitTokens,
    cost: entry.cost,
    currency: entry.currency,
    durationMs: entry.durationMs,
    metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
    createdAt: now,
  });
}

export async function getUsageStats(): Promise<{
  today: {
    cost: number;
    currency: string;
    inputTokens: number;
    outputTokens: number;
    count: number;
  }[];
  month: {
    cost: number;
    currency: string;
    inputTokens: number;
    outputTokens: number;
    count: number;
  }[];
  recentLogs: (typeof usageLogs.$inferSelect)[];
}> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);

  const today = await db
    .select({
      currency: usageLogs.currency,
      cost: sql<number>`COALESCE(SUM(${usageLogs.cost}), 0)`,
      inputTokens: sql<number>`COALESCE(SUM(${usageLogs.inputTokens}), 0)`,
      outputTokens: sql<number>`COALESCE(SUM(${usageLogs.outputTokens}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(usageLogs)
    .where(gte(usageLogs.createdAt, todayStart))
    .groupBy(usageLogs.currency);

  const month = await db
    .select({
      currency: usageLogs.currency,
      cost: sql<number>`COALESCE(SUM(${usageLogs.cost}), 0)`,
      inputTokens: sql<number>`COALESCE(SUM(${usageLogs.inputTokens}), 0)`,
      outputTokens: sql<number>`COALESCE(SUM(${usageLogs.outputTokens}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(usageLogs)
    .where(gte(usageLogs.createdAt, monthStart))
    .groupBy(usageLogs.currency);

  const recentLogs = await db
    .select({
      id: usageLogs.id,
      sessionId: usageLogs.sessionId,
      provider: usageLogs.provider,
      modelId: usageLogs.modelId,
      inputTokens: usageLogs.inputTokens,
      outputTokens: usageLogs.outputTokens,
      cacheHitTokens: usageLogs.cacheHitTokens,
      cost: usageLogs.cost,
      currency: usageLogs.currency,
      durationMs: usageLogs.durationMs,
      metadata: usageLogs.metadata,
      createdAt: usageLogs.createdAt,
      sessionTitle: sessions.title,
    })
    .from(usageLogs)
    .leftJoin(sessions, eq(usageLogs.sessionId, sessions.id))
    .orderBy(sql`${usageLogs.createdAt} DESC`)
    .limit(50);

  return { today, month, recentLogs };
}
