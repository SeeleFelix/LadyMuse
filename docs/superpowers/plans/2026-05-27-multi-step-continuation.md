# Multi-Step Continuation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix lost tool history when the agent's multi-step execution hits the step limit — auto-continue on the server, fix message format for manual continues, and persist all messages to DB.

**Architecture:** Wrap `streamText` in a server-side continuation loop that chains calls when the step limit is hit without producing text output. Fix the frontend to build AI SDK–compatible message history (with tool-call/tool-result parts) instead of filtering out tool messages entirely. Save empty assistant messages to ensure complete DB history.

**Tech Stack:** SvelteKit 5, Vercel AI SDK v6 (`ai@6.0.168`), SQLite/Drizzle, Vitest for unit tests

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/lib/server/agent/index.ts` | Auto-continue loop, `stepsToMessages` helper, config reading |
| `src/routes/chat/+page.svelte` | `parseToolDetail`, `extractToolResultText`, `buildApiMessages`, toolCallId preservation, message save fix |
| `src/lib/server/agent/__tests__/continuation.test.ts` | Unit tests for `stepsToMessages` |
| `src/routes/chat/__tests__/build-api-messages.test.ts` | Unit tests for `parseToolDetail`, `extractToolResultText`, `buildApiMessages` |

---

### Task 1: Server-side `stepsToMessages` helper

**Files:**
- Create: `src/lib/server/agent/__tests__/continuation.test.ts`
- Modify: `src/lib/server/agent/index.ts`

This helper converts an array of `StepResult` objects from a completed `streamText` call into `ModelMessage[]` suitable for the next call's `messages` parameter.

- [ ] **Step 1: Write the failing test**

Create `src/lib/server/agent/__tests__/continuation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { stepsToMessages } from "../index";

describe("stepsToMessages", () => {
  it("converts a step with text only", () => {
    const steps = [
      {
        content: [{ type: "text", text: "Hello" }],
        toolResults: [],
      } as any,
    ];

    const messages = stepsToMessages(steps);

    expect(messages).toEqual([
      {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      },
    ]);
  });

  it("converts a step with tool calls and results into assistant + tool messages", () => {
    const steps = [
      {
        content: [
          { type: "text", text: "Searching..." },
          {
            type: "tool-call",
            toolCallId: "call_1",
            toolName: "search",
            input: { query: "test" },
          },
        ],
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "call_1",
            toolName: "search",
            output: '{"results": []}',
          },
        ],
      } as any,
    ];

    const messages = stepsToMessages(steps);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({
      role: "assistant",
      content: [
        { type: "text", text: "Searching..." },
        {
          type: "tool-call",
          toolCallId: "call_1",
          toolName: "search",
          input: { query: "test" },
        },
      ],
    });
    expect(messages[1]).toEqual({
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: "call_1",
          toolName: "search",
          output: { type: "text", value: '{"results": []}' },
        },
      ],
    });
  });

  it("skips assistant message when step has no content parts", () => {
    const steps = [
      {
        content: [],
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "call_1",
            toolName: "search",
            output: "ok",
          },
        ],
      } as any,
    ];

    const messages = stepsToMessages(steps);

    expect(messages).toEqual([
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "call_1",
            toolName: "search",
            output: { type: "text", value: "ok" },
          },
        ],
      },
    ]);
  });

  it("handles multiple steps", () => {
    const steps = [
      {
        content: [
          {
            type: "tool-call",
            toolCallId: "call_1",
            toolName: "search",
            input: { query: "a" },
          },
        ],
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "call_1",
            toolName: "search",
            output: "result_a",
          },
        ],
      } as any,
      {
        content: [{ type: "text", text: "Done" }],
        toolResults: [],
      } as any,
    ];

    const messages = stepsToMessages(steps);

    expect(messages).toHaveLength(4);
    // Step 1: assistant with tool-call + tool message
    expect(messages[0].role).toBe("assistant");
    expect(messages[1].role).toBe("tool");
    // Step 2: assistant with text
    expect(messages[2].role).toBe("assistant");
  });

  it("stringifies non-string tool output", () => {
    const steps = [
      {
        content: [],
        toolResults: [
          {
            type: "tool-result",
            toolCallId: "call_1",
            toolName: "search",
            output: { key: "value" },
          },
        ],
      } as any,
    ];

    const messages = stepsToMessages(steps);

    expect(messages[0].content[0].output).toEqual({
      type: "text",
      value: '{"key":"value"}',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/agent/__tests__/continuation.test.ts`
Expected: FAIL — `stepsToMessages` is not exported from `../index`

- [ ] **Step 3: Write `stepsToMessages` implementation**

Add to `src/lib/server/agent/index.ts` (before `chatStream` function):

```typescript
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
    // Assistant message: filter to text + tool-call only (exclude tool-result, tool-error)
    const assistantParts = step.content.filter(
      (part) =>
        part.type === "text" ||
        part.type === "tool-call" ||
        part.type === "reasoning",
    );

    if (assistantParts.length > 0) {
      messages.push({ role: "assistant", content: assistantParts });
    }

    // Tool result message
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/agent/__tests__/continuation.test.ts`
Expected: PASS — all 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/agent/index.ts src/lib/server/agent/__tests__/continuation.test.ts
git commit -m "feat: add stepsToMessages helper for auto-continue"
```

---

### Task 2: Server-side auto-continue loop

**Files:**
- Modify: `src/lib/server/agent/index.ts`

Wrap the existing `streamText` call in a continuation loop. When a round ends without text output and the step limit was reached, automatically chain another call with the accumulated history.

- [ ] **Step 1: Add config reader helper**

Add at the top of `chatStream` function body (after `resolvedProvider`), before the model setup:

```typescript
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
```

- [ ] **Step 2: Extract streaming event processor**

The current `for await (const event of result.fullStream)` block (lines 147–218) processes streaming events. Extract the inner body into a separate inner function for reuse across continuation rounds.

Before the `try { for await ... }` block, add a function to consume a stream and yield events. Refactor the existing code:

Replace the current `try` block (from line 146 `try {` to the end of the `for await` at line 219) with:

```typescript
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
      tools: await getEnabledTools(),
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

      // Fallback: if fullStream didn't emit text-delta, get from result.text promise
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

    // Check if the model produced text — if yes, we're done
    if (gotText) {
      // Report usage and timing for the final round
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

    // No text output — check if we should auto-continue
    if (continuationRound >= maxContinuationRounds) {
      yield JSON.stringify({
        type: "text",
        content: "[达到续跑上限，请发送消息继续]",
      }) + "\n";
      return;
    }

    if (totalInputTokens >= maxContinuationTokens) {
      yield JSON.stringify({
        type: "text",
        content: "[达到 token 上限，请发送消息继续]",
      }) + "\n";
      return;
    }

    // Reconstruct messages from completed steps for next round
    const completedSteps = await result.steps;
    const roundMessages = stepsToMessages(
      completedSteps.map((s) => ({
        content: s.content as any[],
        toolResults: (s.toolResults || []) as any[],
      })),
    );
    allMessages = [...allMessages, ...roundMessages];

    // Signal continuation to frontend
    yield JSON.stringify({
      type: "continuation",
      round: continuationRound + 1,
    }) + "\n";
  }
```

**Important**: This replaces everything from the current `const result = streamText({` line (line 117) through the end of the `catch` block (line 282). The variable declarations for `gotText`, `firstTokenMs`, etc. are now INSIDE the loop (reset per round). The outer variables that persist across rounds are `allMessages` and `totalInputTokens`.

The variables `resolvedProviderId` and `startTime` referenced in the usage reporting need to be declared before the loop. `resolvedProviderId` is already defined at line 235. Move it before the loop:

```typescript
const resolvedProviderId = providerId || "openrouter";
```

The `streamStart` variable (line 115) should also be moved before the loop since `firstTokenMs` and `reasoningEndMs` track time from stream start.

- [ ] **Step 3: Verify the file compiles**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | head -20`
Expected: No errors related to `index.ts`

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/agent/index.ts
git commit -m "feat: add server-side auto-continue loop for multi-step tool calls"
```

---

### Task 3: Frontend toolCallId preservation

**Files:**
- Modify: `src/routes/chat/+page.svelte`

Currently, tool messages for non-`present_options` tools don't get `toolCallId` set, and the toolDetail JSON doesn't include it. This means when messages are loaded from DB, we can't match tool calls to results.

- [ ] **Step 1: Update tool-call event handler**

In `src/routes/chat/+page.svelte`, find the `else` branch of the `tool-call` event handler (around line 460–469):

Current:
```typescript
const toolMsg: ChatMessage = {
    role: "tool",
    content: `🔍 ${toolName}...`,
    toolDetail: JSON.stringify(
        { name: event.name, input: event.input },
        null,
        2,
    ),
};
messages = [...messages, toolMsg];
pendingToolMap.set(event.toolCallId, messages.length - 1);
```

Replace with:
```typescript
const toolMsg: ChatMessage = {
    role: "tool",
    content: `🔍 ${toolName}...`,
    toolDetail: JSON.stringify(
        {
            name: event.name,
            input: event.input,
            toolCallId: event.toolCallId,
        },
        null,
        2,
    ),
    toolCallId: event.toolCallId,
};
messages = [...messages, toolMsg];
pendingToolMap.set(event.toolCallId, messages.length - 1);
```

- [ ] **Step 2: Update tool-result event handler**

In the same file, find the tool-result handler for non-present_options tools (around line 490–509). The `pendingToolMap.delete` line should no longer clear the toolCallId. No change needed to the delete itself — it only removes from the map, not from the message. The `toolCallId` stays on the message.

But verify that the `present_options` branch (line 478–482) doesn't clear toolCallId from other messages. It only clears the specific message in the map, so it's fine.

- [ ] **Step 3: Remove toolCallId clearing on abort**

In the abort handler (around line 571–575):

Current:
```typescript
if (e.name === "AbortError") {
    for (const m of messages) {
        if (m.role === "tool") m.toolCallId = undefined;
    }
    optionsDisabled = true;
}
```

Change to only clear toolCallId for present_options messages (which have pending promises):
```typescript
if (e.name === "AbortError") {
    for (const m of messages) {
        if (m.role === "tool" && m.options) m.toolCallId = undefined;
    }
    optionsDisabled = true;
}
```

- [ ] **Step 4: Verify no compilation errors**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add src/routes/chat/+page.svelte
git commit -m "fix: preserve toolCallId on tool messages for history reconstruction"
```

---

### Task 4: Frontend `buildApiMessages` with AI SDK format

**Files:**
- Modify: `src/routes/chat/+page.svelte`

Replace the current `apiMessages` filter/map with a proper converter that builds AI SDK v6 `ModelMessage[]` format including tool-call and tool-result parts.

- [ ] **Step 1: Add `parseToolDetail` helper**

Add before the `sendMessage` function (around line 372):

```typescript
function parseToolDetail(
    raw: string | undefined,
): { name: string; input: any; toolCallId?: string } | null {
    if (!raw) return null;
    try {
        // tool_detail stores JSON before the "--- 结果 ---" marker
        const resultMarker = raw.indexOf("\n\n--- 结果 ---\n");
        const jsonPart = resultMarker >= 0 ? raw.slice(0, resultMarker) : raw;
        return JSON.parse(jsonPart);
    } catch {
        return null;
    }
}

function extractToolResultText(raw: string | undefined): string {
    if (!raw) return "";
    const marker = "\n\n--- 结果 ---\n";
    const idx = raw.indexOf(marker);
    if (idx < 0) return "";
    return raw.slice(idx + marker.length);
}
```

- [ ] **Step 2: Add `buildApiMessages` function**

Add right after the helpers:

```typescript
function buildApiMessages(localMessages: ChatMessage[]): Array<Record<string, any>> {
    const result: Array<Record<string, any>> = [];
    let i = 0;

    while (i < localMessages.length) {
        const msg = localMessages[i];

        if (msg.role === "user") {
            result.push({ role: "user", content: msg.content });
            i++;
        } else if (msg.role === "assistant") {
            const toolCalls: Array<Record<string, any>> = [];
            const toolResults: Array<Record<string, any>> = [];

            // Collect subsequent tool messages (skip empty assistants between them)
            let j = i + 1;
            while (
                j < localMessages.length &&
                (localMessages[j].role === "tool" ||
                    (localMessages[j].role === "assistant" &&
                        !localMessages[j].content.trim()))
            ) {
                if (localMessages[j].role === "tool") {
                    const tool = localMessages[j];
                    const detail = parseToolDetail(tool.toolDetail);
                    if (detail) {
                        const tcId =
                            tool.toolCallId ||
                            detail.toolCallId ||
                            `tc_${j}`;
                        toolCalls.push({
                            type: "tool-call",
                            toolCallId: tcId,
                            toolName: detail.name,
                            input: detail.input,
                        });
                        const resultText = extractToolResultText(
                            tool.toolDetail,
                        );
                        toolResults.push({
                            type: "tool-result",
                            toolCallId: tcId,
                            toolName: detail.name,
                            output: { type: "text", value: resultText },
                        });
                    }
                }
                j++;
            }

            // Assistant message with tool calls
            const content: Array<Record<string, any>> = [];
            if (msg.content.trim()) {
                content.push({ type: "text", text: msg.content });
            }
            content.push(...toolCalls);

            if (content.length > 0) {
                result.push({ role: "assistant", content });
            }

            // Tool result message
            if (toolResults.length > 0) {
                result.push({ role: "tool", content: toolResults });
            }

            i = j;
        } else {
            i++;
        }
    }

    return result;
}
```

- [ ] **Step 3: Replace the old `apiMessages` builder**

In the `sendMessage` function, replace lines 392–394:

Current:
```typescript
const apiMessages = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));
```

Replace with:
```typescript
const apiMessages = buildApiMessages(messages);
```

The `apiMessages.slice(0, -1)` on line 406 stays as-is — it still excludes the last message (the empty assistant placeholder for the current response).

- [ ] **Step 4: Verify no compilation errors**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add src/routes/chat/+page.svelte
git commit -m "fix: build AI SDK compatible message history with tool calls"
```

---

### Task 5: Frontend message save fix

**Files:**
- Modify: `src/routes/chat/+page.svelte`

Empty assistant messages (tool-only steps) are currently skipped during save. This means DB history is incomplete — assistant messages that precede tool calls are lost.

- [ ] **Step 1: Fix the save condition**

In `sendMessage`, find the save loop (around line 581–594):

Current:
```typescript
for (let i = newMsgStart; i < messages.length; i++) {
    if (savedMessageIndices.has(i)) {
        savedMessageIndices.delete(i);
        continue;
    }
    const msg = messages[i];
    if (msg.content && msg.content.trim()) {
        let usageJson: string | undefined;
        if (msg.role === "assistant" && messageCosts.has(i)) {
            usageJson = JSON.stringify(messageCosts.get(i));
        }
        await appendToSession(msg.role, msg.content, msg.toolDetail, usageJson);
    }
}
```

Replace with:
```typescript
for (let i = newMsgStart; i < messages.length; i++) {
    if (savedMessageIndices.has(i)) {
        savedMessageIndices.delete(i);
        continue;
    }
    const msg = messages[i];
    const hasContent = msg.content && msg.content.trim();
    const isToolStep = msg.role === "assistant" && !hasContent && i + 1 < messages.length && messages[i + 1].role === "tool";
    if (hasContent || isToolStep) {
        let usageJson: string | undefined;
        if (msg.role === "assistant" && messageCosts.has(i)) {
            usageJson = JSON.stringify(messageCosts.get(i));
        }
        await appendToSession(
            msg.role,
            msg.content || "",
            msg.toolDetail,
            usageJson,
        );
    }
}
```

This saves:
- Messages with content (as before)
- Empty assistant messages that precede tool messages (tool-only steps)

- [ ] **Step 2: Verify no compilation errors**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/routes/chat/+page.svelte
git commit -m "fix: save empty assistant messages that precede tool calls"
```

---

### Task 6: Frontend `continuation` event handling

**Files:**
- Modify: `src/routes/chat/+page.svelte`

The server now emits `{ type: "continuation", round }` events during auto-continue. The frontend should handle these gracefully (no-op is fine, but we should not break on unknown events).

- [ ] **Step 1: Verify unknown event types are handled**

Look at the event processing switch in `sendMessage` (lines 435–563). Unknown event types fall through the `if/else if` chain and are silently ignored (the `try/catch` at line 566 catches any parse errors). The `continuation` event will be silently handled.

No code changes needed for basic functionality. If you want to show a UI indicator, add this before the `error` handler:

```typescript
} else if (event.type === "continuation") {
    // Auto-continue in progress, no UI change needed
    // The streaming continues seamlessly
}
```

This is optional — the frontend already handles unknown events correctly.

- [ ] **Step 2: Commit (if changes were made)**

Only commit if you added the explicit handler.

```bash
git add src/routes/chat/+page.svelte
git commit -m "feat: handle continuation event from auto-continue"
```

---

### Task 7: Integration test (manual)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Test auto-continue**

1. Send a complex creative request that would require many tool calls, e.g.: "画一个精致的魔法少女在花园里，需要非常详细的背景和光影效果"
2. Watch the streaming — tool calls should continue without stopping
3. If the step limit is hit, the server should auto-continue (look for "continuation" in browser console)
4. The final response should include insights from ALL tool calls, not just the last round
5. Verify no repeated tool calls (no duplicate `search_civitai_images` with the same query)

- [ ] **Step 3: Test manual continue with history**

1. After auto-continue works, test a request that triggers many tool calls
2. If auto-continue maxes out (3 rounds), the "达到续跑上限" message should appear
3. Send a follow-up message like "继续"
4. Verify the AI does NOT re-call the same tools — it should see previous results in the history
5. Check browser DevTools Network tab → the messages payload should include tool-call and tool-result parts

- [ ] **Step 4: Test session reload**

1. After a multi-tool-call conversation, reload the page
2. Switch to that session in the sidebar
3. Send a follow-up message
4. Verify tool history is intact (AI doesn't repeat searches)

- [ ] **Step 5: Test abort during continuation**

1. Send a complex request
2. Click stop mid-stream (during auto-continue)
3. Verify no crash, the partial results are shown
4. Send a new message — verify the history is correct

---

## Self-Review

**1. Spec coverage:**
- Part 1 (auto-continue): Tasks 1, 2, 6
- Part 2 (message format): Tasks 3, 4
- Part 3 (empty message save): Task 5
- Config keys: Task 2 (reads from config with defaults)
- Safety limits: Task 2 (token cutoff, round limit)
- Testing: Task 7

**2. Placeholder scan:** No TBD, TODO, or vague steps. All code is concrete.

**3. Type consistency:**
- `stepsToMessages` uses `StepLike` interface matching AI SDK's `StepResult` structure
- `buildApiMessages` uses `Record<string, any>` to avoid importing AI SDK types in Svelte
- `parseToolDetail` returns `{ name, input, toolCallId? }` — consistent with how it's stored
- `extractToolResultText` returns string — used as `output.value` in tool-result parts
