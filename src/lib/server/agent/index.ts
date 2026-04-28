import { streamText, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { buildSystemPrompt } from "./system-prompt";
import { getEnabledTools } from "./tools";
import { getConfig } from "../config";
import { getProvider } from "../providers";
import { calculateCost, checkBudget, logUsage } from "../cost-tracker";

const DEFAULT_MODEL = "anthropic/claude-sonnet-4-6";

interface Message {
  role: "user" | "assistant";
  content: string;
  image?: string;
}

export async function* chatStream(
  messages: Message[],
  modelId?: string,
  providerId?: string,
  sessionId?: number,
  signal?: AbortSignal,
) {
  const resolvedModel =
    modelId || (await getConfig("default_model")) || DEFAULT_MODEL;
  const resolvedProvider = providerId || "openrouter";

  const provider = getProvider(resolvedProvider);
  if (!provider) {
    yield JSON.stringify({
      type: "error",
      content: `未知提供商 "${resolvedProvider}"`,
    }) + "\n";
    return;
  }

  const apiKey = await getConfig(provider.apiKeyConfigKey);
  if (!apiKey) {
    yield JSON.stringify({
      type: "error",
      content: `请先配置 ${provider.name} API Key`,
    }) + "\n";
    return;
  }

  let model;
  let deepseekProvider = false;
  if (provider.id === "deepseek") {
    deepseekProvider = true;
    const deepseek = createDeepSeek({
      apiKey,
      fetch: async (url: any, init: any) => {
        if (typeof init?.body === "string") {
          const body = JSON.parse(init.body);
          body.reasoning_effort = "max";
          init.body = JSON.stringify(body);
        }
        return fetch(url, init);
      },
    });
    model = deepseek(resolvedModel);
  } else {
    const client = createOpenAI({
      baseURL: provider.baseURL,
      apiKey,
    });
    model = client.chat(resolvedModel);
  }

  const formattedMessages = messages.map((m): any => {
    if (m.image) {
      return {
        role: m.role,
        content: [
          { type: "text" as const, text: m.content },
          { type: "image" as const, image: m.image },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });

  const jbEnabled = await getConfig("jailbreak_enabled");
  if (jbEnabled === "true") {
    const jbPrompt = await getConfig("jailbreak_prompt");
    if (jbPrompt) {
      formattedMessages.push({ role: "user", content: jbPrompt });
    }
  }

  // Budget check
  const budget = await checkBudget();
  if (!budget.allowed) {
    yield JSON.stringify({
      type: "budget-warning",
      dailyCost: budget.dailyCost,
      monthlyCost: budget.monthlyCost,
      dailyLimit: budget.dailyLimit,
      monthlyLimit: budget.monthlyLimit,
    }) + "\n";
    yield JSON.stringify({
      type: "error",
      content: "预算已超限，请调整预算设置或等待下一周期。",
    }) + "\n";
    return;
  }

  const startTime = Date.now();
  const systemPrompt = await buildSystemPrompt();
  const promptBuildMs = Date.now() - startTime;
  const streamStart = Date.now();

  const result = streamText({
    model,
    system: systemPrompt,
    messages: formattedMessages,
    tools: getEnabledTools(),
    stopWhen: stepCountIs(10),
    ...(deepseekProvider && {
      providerOptions: {
        deepseek: {
          thinking: { type: "enabled" },
        },
      },
    }),
  });

  let gotText = false;
  let firstTokenMs = 0;
  let firstReasoningMs = 0;
  let reasoningEndMs = 0;
  const toolStartTimes = new Map<string, number>();
  const toolTimings: { name: string; durationMs: number }[] = [];

  try {
    for await (const event of result.fullStream) {
      if (signal?.aborted) break;
      if (event.type === "reasoning-delta") {
        if (!firstReasoningMs) {
          firstReasoningMs = Date.now() - streamStart;
        }
        yield JSON.stringify({
          type: "reasoning",
          content: event.text,
        }) + "\n";
      } else if (event.type === "text-delta") {
        if (!gotText) {
          firstTokenMs = Date.now() - streamStart;
          if (!reasoningEndMs) reasoningEndMs = firstTokenMs;
        }
        gotText = true;
        yield JSON.stringify({ type: "text", content: event.text }) + "\n";
      } else if (event.type === "tool-call") {
        toolStartTimes.set(event.toolName, Date.now());
        yield JSON.stringify({
          type: "tool-call",
          name: event.toolName,
          input: event.input,
        }) + "\n";
      } else if (event.type === "tool-result") {
        const toolStart = toolStartTimes.get(event.toolName);
        if (toolStart) {
          toolTimings.push({
            name: event.toolName,
            durationMs: Date.now() - toolStart,
          });
          toolStartTimes.delete(event.toolName);
        }
        const output =
          typeof event.output === "string"
            ? event.output
            : JSON.stringify(event.output);
        yield JSON.stringify({
          type: "tool-result",
          name: event.toolName,
          output,
        }) + "\n";
      }
    }

    // Fallback: if fullStream didn't emit text-delta, get from result.text promise
    if (!gotText) {
      const finalText = await result.text;
      if (finalText) {
        yield JSON.stringify({ type: "text", content: finalText }) + "\n";
      }
    }

    const totalStreamMs = Date.now() - streamStart;

    // Capture usage and calculate cost
    const usage = await result.totalUsage;
    const durationMs = Date.now() - startTime;

    const resolvedProviderId = providerId || "openrouter";
    const costResult = await calculateCost(resolvedProviderId, resolvedModel, {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      cacheReadTokens: (usage.inputTokenDetails as any)?.cacheReadTokens ?? 0,
    });

    yield JSON.stringify({
      type: "usage",
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      cacheHitTokens: costResult.breakdown.cacheHitTokens,
      cost: costResult.cost,
      currency: costResult.currency,
      breakdown: costResult.breakdown,
      source: costResult.source,
      durationMs,
    }) + "\n";

    yield JSON.stringify({
      type: "timing",
      promptBuildMs,
      firstTokenMs,
      firstReasoningMs,
      reasoningDurationMs:
        reasoningEndMs && firstReasoningMs
          ? reasoningEndMs - firstReasoningMs
          : 0,
      totalStreamMs,
      toolTimings,
    }) + "\n";

    await logUsage({
      sessionId,
      provider: resolvedProviderId,
      modelId: resolvedModel,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      cacheHitTokens: costResult.breakdown.cacheHitTokens,
      cost: costResult.cost,
      currency: costResult.currency,
      durationMs,
      metadata: { costSource: costResult.source },
    });
  } catch (e: any) {
    yield JSON.stringify({ type: "error", content: e.message }) + "\n";
  }
}

export { DEFAULT_MODEL };
