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

interface StepLike {
  content: Array<{
    type: string;
    text?: string;
    toolCallId?: string;
    toolName?: string;
    input?: unknown;
  }>;
  toolResults: Array<{
    type: string;
    toolCallId: string;
    toolName: string;
    output: unknown;
  }>;
}

export function stepsToMessages(steps: StepLike[]): Array<Record<string, any>> {
  const messages: Array<Record<string, any>> = [];

  for (const step of steps) {
    const assistantParts = step.content.filter(
      (part) =>
        part.type === "text" ||
        part.type === "tool-call" ||
        part.type === "reasoning",
    );

    if (assistantParts.length > 0) {
      messages.push({ role: "assistant", content: assistantParts });
    }

    if (step.toolResults && step.toolResults.length > 0) {
      messages.push({
        role: "tool",
        content: step.toolResults.map((r) => ({
          type: "tool-result",
          toolCallId: r.toolCallId,
          toolName: r.toolName,
          output: {
            type: "text",
            value:
              typeof r.output === "string"
                ? r.output
                : JSON.stringify(r.output),
          },
        })),
      });
    }
  }

  return messages;
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
  const lastUserMsg = [...formattedMessages]
    .reverse()
    .find((m) => m.role === "user")?.content;
  const systemPrompt = await buildSystemPrompt(lastUserMsg);
  const promptBuildMs = Date.now() - startTime;
  const streamStart = Date.now();
  const resolvedProviderId = providerId || "openrouter";

  const maxStepsPerRound = parseInt(
    (await getConfig("max_steps_per_round")) || "20",
    10,
  );
  const maxContinuationRounds = parseInt(
    (await getConfig("max_continuation_rounds")) || "3",
    10,
  );
  const maxContinuationTokens = parseInt(
    (await getConfig("max_continuation_input_tokens")) || "200000",
    10,
  );

  const tools = await getEnabledTools();
  let allMessages = [...formattedMessages];
  let totalInputTokens = 0;

  for (
    let continuationRound = 0;
    continuationRound <= maxContinuationRounds;
    continuationRound++
  ) {
    const result = streamText({
      model,
      system: systemPrompt,
      messages: allMessages,
      tools,
      stopWhen: stepCountIs(maxStepsPerRound),
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
    let stepNumber = 0;
    const collectedSteps: Array<{
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cost: number;
    }> = [];

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
            toolCallId: event.toolCallId,
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
            toolCallId: (event as any).toolCallId,
            output,
          }) + "\n";
        } else if (event.type === "finish-step") {
          const stepUsage = event.usage;
          const cacheRead =
            (stepUsage.inputTokenDetails as any)?.cacheReadTokens ?? 0;
          const stepCostResult = await calculateCost(
            resolvedProvider,
            resolvedModel,
            {
              inputTokens: stepUsage.inputTokens ?? 0,
              outputTokens: stepUsage.outputTokens ?? 0,
              cacheReadTokens: cacheRead,
            },
          );
          stepNumber++;
          const stepEntry = {
            inputTokens: stepUsage.inputTokens ?? 0,
            outputTokens: stepUsage.outputTokens ?? 0,
            cacheReadTokens: cacheRead,
            cost: stepCostResult.cost,
          };
          collectedSteps.push(stepEntry);
          totalInputTokens += stepUsage.inputTokens ?? 0;
          yield JSON.stringify({
            type: "step-usage",
            stepNumber,
            ...stepEntry,
            currency: stepCostResult.currency,
          }) + "\n";
        }
      }

      if (!gotText) {
        const finalText = await result.text;
        if (finalText) {
          gotText = true;
          yield JSON.stringify({ type: "text", content: finalText }) + "\n";
        }
      }
    } catch (e: any) {
      yield JSON.stringify({ type: "error", content: e.message }) + "\n";
      return;
    }

    if (signal?.aborted) return;

    if (gotText) {
      const totalStreamMs = Date.now() - streamStart;
      const usage = await result.totalUsage;
      const durationMs = Date.now() - startTime;
      const costResult = await calculateCost(
        resolvedProviderId,
        resolvedModel,
        {
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          cacheReadTokens:
            (usage.inputTokenDetails as any)?.cacheReadTokens ?? 0,
        },
      );

      yield JSON.stringify({
        type: "usage",
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        cacheHitTokens: costResult.breakdown.cacheHitTokens,
        cost: costResult.cost,
        currency: costResult.currency,
        breakdown: costResult.breakdown,
        source: costResult.source,
        steps: collectedSteps,
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

      return;
    }

    // No text output — auto-continue
    if (totalInputTokens >= maxContinuationTokens) {
      yield JSON.stringify({
        type: "text",
        content: "[达到 token 上限，请发送消息继续]",
      }) + "\n";
      return;
    }

    const completedSteps = await result.steps;
    const roundMessages = stepsToMessages(
      completedSteps.map((s) => ({
        content: s.content as any[],
        toolResults: (s.toolResults || []) as any[],
      })),
    );
    allMessages = [...allMessages, ...roundMessages];

    yield JSON.stringify({
      type: "continuation",
      round: continuationRound + 1,
    }) + "\n";
  }

  // Exhausted all continuation rounds
  yield JSON.stringify({
    type: "text",
    content: "[达到续跑上限，请发送消息继续]",
  }) + "\n";
}

export { DEFAULT_MODEL };
