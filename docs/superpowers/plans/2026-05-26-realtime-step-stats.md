# Real-time Step Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add context length to the existing badge, make badge update in real-time per step, store per-step data for historical review, and show context size near input box.

**Key insight:** AI SDK `finish-step.usage.inputTokens` is the total input tokens for that step's API call (includes all prior context). Each step's `inputTokens` IS the context window size at that point. Do NOT accumulate — use the latest step's value.

**Architecture:** Server emits `step-usage` SSE events per step. Frontend accumulates cost/outputTokens (deltas), takes latest inputTokens as context size. All per-step data stored in `usageJson.steps`. No DB schema changes.

---

### Task 1: Server — emit `step-usage` events and collect steps

**Files:**
- Modify: `src/lib/server/agent/index.ts:136-248`

- [ ] **Step 1: Add step counter and collector before the fullStream loop**

In `src/lib/server/agent/index.ts`, after line 137 (`const toolTimings: ...`), add:

```typescript
let stepNumber = 0;
const collectedSteps: Array<{
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cost: number;
}> = [];
```

- [ ] **Step 2: Add `finish-step` handler inside the fullStream loop**

After the existing `tool-result` handler block (after line 184), add:

```typescript
} else if (event.type === "finish-step") {
  const stepUsage = event.usage;
  const cacheRead = (stepUsage.inputTokenDetails as any)?.cacheReadTokens ?? 0;
  const stepCostResult = await calculateCost(resolvedProviderId, resolvedModel, {
    inputTokens: stepUsage.inputTokens ?? 0,
    outputTokens: stepUsage.outputTokens ?? 0,
    cacheReadTokens: cacheRead,
  });
  stepNumber++;
  const stepEntry = {
    inputTokens: stepUsage.inputTokens ?? 0,
    outputTokens: stepUsage.outputTokens ?? 0,
    cacheReadTokens: cacheRead,
    cost: stepCostResult.cost,
  };
  collectedSteps.push(stepEntry);
  yield JSON.stringify({
    type: "step-usage",
    stepNumber,
    ...stepEntry,
    currency: stepCostResult.currency,
  }) + "\n";
}
```

- [ ] **Step 3: Add `steps` to the final `usage` event**

Replace the existing `usage` event yield (around line 208) with:

```typescript
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
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/agent/index.ts
git commit -m "feat: emit step-usage SSE events from finish-step in streamText"
```

---

### Task 2: Frontend — real-time badge + context indicator

**Files:**
- Modify: `src/routes/chat/+page.svelte`

- [ ] **Step 1: Add context state**

After the `sessionCost` derived (line 62), add:

```typescript
let currentContextTokens = $state(0);
```

- [ ] **Step 2: Add `step-usage` handler**

After the existing `usage` handler (after line 512), add:

```typescript
} else if (event.type === "step-usage") {
  const existing = messageCosts.get(costIdx) || {
    cost: 0,
    currency: event.currency,
    inputTokens: 0,
    outputTokens: 0,
    cacheHitTokens: 0,
    source: "calculated",
  };
  messageCosts.set(costIdx, {
    cost: existing.cost + event.cost,
    currency: event.currency,
    inputTokens: event.inputTokens,
    outputTokens: existing.outputTokens + event.outputTokens,
    cacheHitTokens: existing.cacheHitTokens + event.cacheReadTokens,
    source: "calculated",
  });
  messageCosts = new Map(messageCosts);
  currentContextTokens = event.inputTokens;
}
```

- [ ] **Step 3: Update `usage` handler to preserve `steps`**

Replace the existing `usage` handler (lines 503-512) with:

```typescript
} else if (event.type === "usage") {
  messageCosts.set(costIdx, {
    cost: event.cost,
    currency: event.currency,
    inputTokens: event.inputTokens,
    outputTokens: event.outputTokens,
    cacheHitTokens: event.cacheHitTokens || 0,
    source: event.source,
    ...(event.steps ? { steps: event.steps } : {}),
  });
  messageCosts = new Map(messageCosts);
  currentContextTokens = event.inputTokens;
}
```

This overwrites the step-accumulated data with the authoritative final total, and preserves the `steps` array for storage.

- [ ] **Step 4: Reset context on new request and new chat**

In `sendMessage`, after `isLoading = true;` (line 370), add:

```typescript
currentContextTokens = 0;
```

In `newChat`, after `isLoading = false;`, add:

```typescript
currentContextTokens = 0;
```

- [ ] **Step 5: Restore context when loading historical sessions**

In `switchSession`, after `messageCosts = new Map(messageCosts);` (line 255), add:

```typescript
currentContextTokens = 0;
const costs = [...messageCosts.values()];
if (costs.length > 0) {
  currentContextTokens = costs[costs.length - 1].inputTokens || 0;
}
```

- [ ] **Step 6: Add "上下文" to the badge**

In the badge rendering (around line 1193, after the `cached` span block, before the `|` separator), add:

```svelte
{#if cost.contextTokens}
  <span class="text-zinc-700">|</span>
  <span class="text-blue-700"
    >{cost.contextTokens > 1000
      ? (cost.contextTokens / 1000).toFixed(1) + "K"
      : cost.contextTokens}
    上下文</span
  >
{/if}
```

This ADDS "上下文" as a new metric. The existing "in" stays — "in" is total input tokens consumed (sum across steps), "上下文" is the last step's context window size. Different numbers.

To support this, update the `step-usage` handler to track context separately:

In Step 2's `step-usage` handler, change the `messageCosts.set` to also store `contextTokens`:

```typescript
messageCosts.set(costIdx, {
  cost: existing.cost + event.cost,
  currency: event.currency,
  inputTokens: existing.inputTokens + event.inputTokens,
  outputTokens: existing.outputTokens + event.outputTokens,
  cacheHitTokens: existing.cacheHitTokens + event.cacheReadTokens,
  source: "calculated",
  contextTokens: event.inputTokens + event.outputTokens,  // context = in + out
});
```

And in Step 3's `usage` handler, also set contextTokens from the steps array:

```typescript
...(event.steps && event.steps.length > 0
  ? { contextTokens: event.steps[event.steps.length - 1].inputTokens + event.steps[event.steps.length - 1].outputTokens }
  : {}),
```

When loading from history, `contextTokens` is preserved in `usageJson` automatically.

- [ ] **Step 7: Add expandable steps list under badge**

Add a `expandedSteps` set (similar to `expandedTools`):

```typescript
let expandedSteps = $state<Set<number>>(new Set());
```

After the badge `</div>` (the cost/timing row), add:

```svelte
{#if cost.steps && cost.steps.length > 1}
  <button
    onclick={() => {
      const next = new Set(expandedSteps);
      next.has(i) ? next.delete(i) : next.add(i);
      expandedSteps = next;
    }}
    class="mt-0.5 text-[10px] text-zinc-600 hover:text-zinc-400 px-1"
  >
    {expandedSteps.has(i) ? "▼" : "▶"} {cost.steps.length} steps
  </button>
  {#if expandedSteps.has(i)}
    <div class="mt-0.5 px-1 space-y-0.5">
      {#each cost.steps as step, si}
        <div class="text-[10px] text-zinc-600 tabular-nums">
          Step {si + 1}:
          {step.inputTokens > 1000 ? (step.inputTokens / 1000).toFixed(1) + "K" : step.inputTokens} in
          |
          {step.outputTokens > 1000 ? (step.outputTokens / 1000).toFixed(1) + "K" : step.outputTokens} out
          {#if step.cacheReadTokens > 0}
            |
            <span class="text-emerald-700">{step.cacheReadTokens > 1000 ? (step.cacheReadTokens / 1000).toFixed(1) + "K" : step.cacheReadTokens} cached</span>
          {/if}
          |
          {(step.inputTokens + step.outputTokens) > 1000 ? ((step.inputTokens + step.outputTokens) / 1000).toFixed(1) + "K" : (step.inputTokens + step.outputTokens)} 上下文
          |
          {cost.currency === "CNY" ? "¥" : "$"}{step.cost.toFixed(4)}
        </div>
      {/each}
    </div>
  {/if}
{/if}
```

Only shows when there are 2+ steps (single-step responses don't need expansion).

- [ ] **Step 7: Add context indicator below input box**

After the flex row in the input area (after line 1283), add:

```svelte
{#if currentContextTokens > 0}
  <div class="mt-2 text-[10px] text-zinc-600 tabular-nums">
    上下文 {currentContextTokens > 1000 ? (currentContextTokens / 1000).toFixed(1) + "K" : currentContextTokens} tokens
  </div>
{/if}
```

- [ ] **Step 8: Commit**

```bash
git add src/routes/chat/+page.svelte
git commit -m "feat: real-time badge updates with context length indicator"
```
