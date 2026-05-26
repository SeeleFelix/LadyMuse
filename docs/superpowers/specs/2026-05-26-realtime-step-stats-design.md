# Real-time Step Statistics

## Problem

Token usage and cost are only visible after the entire response stream finishes. During multi-step tool calls (e.g. 3 Civitai searches), the user has no visibility into accumulating costs. After the conversation, only a single total is stored — no per-step breakdown is available for review.

## Goal

- Show token/cost data in real-time as each step completes during streaming
- Store per-step breakdown for historical review
- Add a session-level cumulative counter near the input box

## Data Source

The Vercel AI SDK's `streamText` `fullStream` emits `finish-step` events after each step. Each event contains:

```typescript
{
  type: "finish-step";
  usage: LanguageModelUsage;  // { inputTokens, outputTokens, inputTokenDetails: { cacheReadTokens } }
  response: LanguageModelResponseMetadata;
  finishReason: FinishReason;
}
```

Currently only the final `finish` event (with `totalUsage`) is used.

## Architecture

### Event flow (before)

```
tool-call → tool-result → ... → finish(usage) → timing
```

### Event flow (after)

```
tool-call → tool-result → finish-step(step-usage) → ... → finish(usage) → timing
```

## Changes

### 1. Server: emit `step-usage` events — `src/lib/server/agent/index.ts`

Add a `finish-step` handler in the `fullStream` loop:

- Calculate cost for each step using the existing `calculateCost` function
- Emit a `step-usage` SSE event with step number, tokens, and cost
- Maintain a `stepNumber` counter (starts at 1)
- Collect steps into an array for the final `usage` event

`step-usage` event shape:

```json
{
  "type": "step-usage",
  "stepNumber": 1,
  "inputTokens": 20000,
  "outputTokens": 500,
  "cacheReadTokens": 15000,
  "cost": 0.01,
  "currency": "CNY"
}
```

### 2. Server: include `steps` in final `usage` event — `src/lib/server/agent/index.ts`

The existing final `usage` event adds a `steps` array containing all collected step-level data. This is what gets stored in `usageJson`.

`usage` event shape (new `steps` field):

```json
{
  "type": "usage",
  "inputTokens": 130721,
  "outputTokens": 4299,
  "cacheHitTokens": 91136,
  "cost": 0.066,
  "currency": "CNY",
  "breakdown": { ... },
  "source": "calculated",
  "steps": [
    { "inputTokens": 20000, "outputTokens": 500, "cacheReadTokens": 15000, "cost": 0.01 },
    { "inputTokens": 45000, "outputTokens": 600, "cacheReadTokens": 38000, "cost": 0.02 }
  ]
}
```

### 3. Frontend: real-time badge update — `src/routes/chat/+page.svelte`

Add a `step-usage` event handler:

- On each `step-usage`, accumulate into `messageCosts` for the current assistant message
- The existing badge template is reactive — no template changes needed, only the data source changes from "final write" to "incremental accumulation"
- On final `usage` event, overwrite with the authoritative total (avoids float drift)

New state for collecting steps:

```typescript
let collectedSteps = $state<Array<{ inputTokens: number; outputTokens: number; cacheReadTokens: number; cost: number }>>([]);
```

### 4. Frontend: session cumulative counter — `src/routes/chat/+page.svelte`

New state:

```typescript
let sessionTotalCost = $state(0);
let sessionCurrency = $state("CNY");
```

- On each `step-usage` or `usage`: accumulate `sessionTotalCost`
- On session load: sum costs from all historical messages' `usageJson`
- Render below the input box:

```
本次会话: ¥0.18 | 上下文 130K tokens
```

### 5. Storage: `usageJson` format change

Old format (unchanged, still works):

```json
{"cost":0.066,"currency":"CNY","inputTokens":130721,"outputTokens":4299,"cacheHitTokens":91136,"source":"calculated"}
```

New format (adds `steps` array):

```json
{"cost":0.066,"currency":"CNY","inputTokens":130721,"outputTokens":4299,"cacheHitTokens":91136,"source":"calculated","steps":[...]}
```

Backward compatibility: old data without `steps` field renders the same total-only badge. No migration needed.

## Files Changed

| File | Change |
|---|---|
| `src/lib/server/agent/index.ts` | Add `finish-step` handler, emit `step-usage`, collect steps into `usage` event |
| `src/routes/chat/+page.svelte` | Add `step-usage` handler, session counter state, bottom bar UI |
