# Multi-Step Continuation: Fix Lost Tool History on Step Limit

Date: 2026-05-27

## Problem

When the agent's multi-step execution hits the `stepCountIs(10)` limit, the stream stops without producing a final text response. The user must manually send a follow-up message, but:

1. **Frontend filters out tool messages** (`+page.svelte:392-394`) — only `user`/`assistant` roles are sent to the API
2. **AI loses all tool context** — sees empty assistant messages and has no knowledge of previous tool calls/results
3. **Token waste** — AI repeats the same tool calls from scratch
4. **User frustration** — multiple "continue" messages needed, agent keeps re-searching

Session 258 demonstrates this clearly: 22+ tool calls per round, no assistant text output, user asks "结果呢" / "给我提示词" / "别查了" repeatedly.

## Solution

Three-part fix: auto-continue, message format repair, and safety limits.

### Part 1: Server-Side Auto-Continue

**File**: `src/lib/server/agent/index.ts`

Wrap `streamText` in a loop. When a round ends without text output and the step limit was reached, automatically chain another `streamText` call with the accumulated conversation history.

**Parameters** (configurable via config table):
- `max_steps_per_round`: 20 (up from 10)
- `max_continuation_rounds`: 3 (max 20 × 3 = 60 total steps)
- `max_continuation_input_tokens`: 200,000 (safety cutoff)

**Auto-continue logic**:

```
for each continuation round (0..max_continuation_rounds):
    result = streamText({ messages, stepCountIs(max_steps_per_round) })
    stream all events to frontend as before

    steps = await result.steps
    lastStep = steps[steps.length - 1]

    if lastStep has text content → done, break

    // Reconstruct messages from steps for next round
    for each step in steps:
        // Assistant message with tool calls
        messages.push({
            role: "assistant",
            content: step.content  // includes tool-call parts
        })
        // Tool result message
        if step has tool results:
            messages.push({
                role: "tool",
                content: step.toolResults.map(r => ({
                    type: "tool-result",
                    toolCallId: r.toolCallId,
                    toolName: r.toolName,
                    output: { type: "text", value: JSON.stringify(r.result) }
                }))
            })

    // Safety: check accumulated tokens
    if totalInputTokens > max_continuation_input_tokens → force stop

    yield { type: "continuation", round }
```

**Frontend event**: When receiving `{ type: "continuation", round }`, keep loading state active. The frontend's event loop continues as normal — tool-call, tool-result, and text events flow seamlessly.

**Step `content` structure** (AI SDK v6 `ContentPart`):
- `{ type: "text", text: "..." }` — text output
- `{ type: "tool-call", toolCallId, toolName, input }` — tool invocation

The `StepResult.toolResults` array provides `{ toolCallId, toolName, result }` for constructing tool messages.

### Part 2: Fix Message History Format

**File**: `src/routes/chat/+page.svelte`

Current code (line 392-394) filters out all tool messages:
```typescript
const apiMessages = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));
```

Replace with a converter that reconstructs the full AI SDK multi-step message format:

```typescript
function buildApiMessages(messages: ChatMessage[]): ModelMessage[] {
    const result: ModelMessage[] = [];
    let i = 0;

    while (i < messages.length) {
        const msg = messages[i];

        if (msg.role === "user") {
            result.push({ role: "user", content: msg.content });
            i++;
        } else if (msg.role === "assistant") {
            // Collect subsequent tool messages that belong to this assistant turn
            const toolCalls: ToolCallPart[] = [];
            const toolResults: ToolResultPart[] = [];
            let j = i + 1;
            while (j < messages.length && messages[j].role === "tool") {
                const tool = messages[j];
                const detail = parseToolDetail(tool.toolDetail);
                if (detail) {
                    const toolCallId = tool.toolCallId || `tc_${j}`;
                    toolCalls.push({
                        type: "tool-call",
                        toolCallId,
                        toolName: detail.name,
                        input: detail.input,
                    });
                    const resultText = extractToolResultText(tool.toolDetail);
                    toolResults.push({
                        type: "tool-result",
                        toolCallId,
                        toolName: detail.name,
                        output: { type: "text", value: resultText },
                    });
                }
                j++;
            }

            // Assistant message with tool calls
            const content: AssistantContent = [];
            if (msg.content.trim()) {
                content.push({ type: "text", text: msg.content });
            }
            content.push(...toolCalls);
            result.push({ role: "assistant", content });

            // Tool result message
            if (toolResults.length > 0) {
                result.push({ role: "tool", content: toolResults });
            }

            i = j; // skip past consumed tool messages
        } else {
            i++; // skip orphaned tool messages (shouldn't happen)
        }
    }

    return result;
}
```

**`parseToolDetail` helper**: Extracts `name` and `input` from the stored JSON in `tool_detail`. The `tool_detail` field stores:
```
{
  "name": "search_civitai_images",
  "input": { "query": "...", ... }
}

--- 结果 ---
{"domain": "civitai.red", ...}
```

**`extractToolResultText` helper**: Extracts the text after `--- 结果 ---` marker.

**Tool messages tracking**: Currently, `ChatMessage.toolCallId` is set for `present_options` tool but cleared for other tools after result. Need to preserve `toolCallId` for all tool messages to maintain the call ↔ result mapping. Two changes:

1. In the tool-call event handler, store `toolCallId` on the message:
```typescript
const toolMsg: ChatMessage = {
    role: "tool",
    content: `🔍 ${toolName}...`,
    toolDetail: JSON.stringify({
        name: event.name,
        input: event.input,
        toolCallId: event.toolCallId,  // ← include in stored detail
    }, null, 2),
    toolCallId: event.toolCallId,  // ← preserve on message object
};
```

2. In `parseToolDetail`, extract `toolCallId` from the stored JSON as a fallback when the message's `toolCallId` field is absent (e.g., loaded from DB before this change).

### Part 3: Empty Assistant Message Persistence

**File**: `src/routes/chat/+page.svelte` (line 587)

Currently, empty assistant messages are skipped:
```typescript
if (msg.content && msg.content.trim()) {
    await appendToSession(msg.role, msg.content, msg.toolDetail, usageJson);
}
```

Change to also save assistant messages that have `toolDetail` (tool-only steps):
```typescript
if ((msg.content && msg.content.trim()) || (msg.role === "assistant" && msg.toolDetail)) {
    const content = msg.content || "[tool calls only]";
    await appendToSession(msg.role, content, msg.toolDetail, usageJson);
}
```

This ensures the DB history is complete even for steps that only made tool calls.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/server/agent/index.ts` | Add auto-continue loop around `streamText` |
| `src/routes/chat/+page.svelte` | Replace `apiMessages` builder, preserve `toolCallId`, fix empty message save |
| `src/lib/server/config.ts` | Add `max_steps_per_round`, `max_continuation_rounds`, `max_continuation_input_tokens` config keys |

## DB Schema

No changes. The existing `tool_detail` JSON format contains all the information needed for message reconstruction.

## Testing

1. Send a complex creative request that triggers 10+ tool calls
2. Verify auto-continue fires without user intervention
3. Verify the final response includes insights from all tool calls made across continuation rounds
4. After completion, reload the session and send a follow-up message
5. Verify the AI sees the full tool history from the previous turn (no repeated tool calls)
6. Test token safety limit by sending an extremely complex request
7. Test abort during continuation (user cancels mid-stream)

## Out of Scope

- UI changes for tool call display
- Refactoring of tool detail storage format
- Changes to the tool definitions themselves
- Streaming protocol changes (event format stays the same)
