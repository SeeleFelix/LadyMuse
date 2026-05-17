# Embedding 独立化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 embedding 生成从导入流程拆出，作为独立、增量式操作。同步不再自动跑 embedding，改为前端按需触发。

**Architecture:** 新建 `embed-all.ts` 查询缺失项批量生成，新增 `POST /api/knowledge/embed` 和 `GET /api/knowledge/embed/status`，同步脚本移除 embedding 步骤，知识页面加按钮和状态圆点。

**Tech Stack:** SvelteKit, Drizzle ORM (SQLite), OpenAI-compatible Embeddings API (via OpenRouter), SSE

---

## 文件规划

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/lib/server/knowledge/embed-all.ts` | 新建 | 查缺失项、批量生成 embedding、SSE 上报进度 |
| `src/routes/api/knowledge/embed/+server.ts` | 新建 | POST 端点，触发增量 embedding |
| `src/routes/api/knowledge/embed/status/+server.ts` | 新建 | GET 端点，返回 total/embedded/missing |
| `src/lib/server/knowledge/sync-aat.ts` | 修改 | 移除 embedding 步骤 |
| `src/lib/server/knowledge/sync-wikipedia.ts` | 修改 | 移除 embedding 步骤（如有） |
| `src/routes/knowledge/+page.svelte` | 修改 | 嵌入按钮、状态圆点、进度展示 |

---

### Task 1: 创建 embed-all.ts — 增量 embedding 生成

**Files:**
- Create: `src/lib/server/knowledge/embed-all.ts`

- [ ] **Step 1: 创建文件**

```typescript
import { db } from "../db";
import { artConcepts } from "../db/schema";
import { isNull, eq, and } from "drizzle-orm";
import { generateEmbeddings } from "./embedding";
import { startSync, updateProgress, finishSync, failSync } from "./sync-status";

export async function embedAll(dimension?: string, name?: string) {
  if (!startSync("embedding")) throw new Error("Embedding already in progress");

  try {
    const conditions = [isNull(artConcepts.embedding)];
    if (dimension) conditions.push(eq(artConcepts.category, dimension));
    if (name) conditions.push(eq(artConcepts.name, name));

    const rows = await db
      .select({
        name: artConcepts.name,
        visualDescription: artConcepts.visualDescription,
        nameZh: artConcepts.nameZh,
      })
      .from(artConcepts)
      .where(and(...conditions));

    if (rows.length === 0) {
      finishSync();
      return { done: 0, total: 0 };
    }

    updateProgress({ stage: "embedding", total: rows.length, done: 0 });

    const texts = rows.map(
      (r) => `${r.visualDescription || ""} ${r.name} ${r.nameZh || ""}`,
    );
    const B = 20;

    for (let i = 0; i < texts.length; i += B) {
      const batch = texts.slice(i, i + B);
      const names = rows.slice(i, i + B).map((r) => r.name);
      const embeddings = await generateEmbeddings(batch);
      for (let j = 0; j < embeddings.length; j++) {
        await db
          .update(artConcepts)
          .set({ embedding: JSON.stringify(embeddings[j]) })
          .where(eq(artConcepts.name, names[j]));
      }
      updateProgress({ done: Math.min(i + B, texts.length) });
    }

    finishSync();
    return { done: texts.length, total: texts.length };
  } catch (e: any) {
    failSync(e.message);
    throw e;
  }
}
```

- [ ] **Step 2: 验证编译**

```bash
cd /home/narcissus/Workspace/LadyMuse && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/knowledge/embed-all.ts
git commit -m "feat: add incremental embedding generator"
```

---

### Task 2: 新增 API 端点

**Files:**
- Create: `src/routes/api/knowledge/embed/+server.ts`
- Create: `src/routes/api/knowledge/embed/status/+server.ts`

- [ ] **Step 1: 创建目录**

```bash
mkdir -p /home/narcissus/Workspace/LadyMuse/src/routes/api/knowledge/embed/status
```

- [ ] **Step 2: 创建 POST `/api/knowledge/embed`**

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { embedAll } from "$lib/server/knowledge/embed-all";
import { getSyncStatus } from "$lib/server/knowledge/sync-status";

export const POST: RequestHandler = async ({ request }) => {
  const status = getSyncStatus();
  if (status.running) {
    return json({ error: "Sync already in progress" }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const { dimension, name } = body || {};

  embedAll(dimension, name).catch((e) => console.error("[embed]", e));
  return json({ ok: true });
};
```

- [ ] **Step 3: 创建 GET `/api/knowledge/embed/status`**

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { artConcepts } from "$lib/server/db/schema";
import { isNull, isNotNull, sql } from "drizzle-orm";

export const GET: RequestHandler = async () => {
  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      missing: sql<number>`sum(case when embedding is null then 1 else 0 end)`,
    })
    .from(artConcepts);

  return json({
    total: row?.total ?? 0,
    embedded: (row?.total ?? 0) - (row?.missing ?? 0),
    missing: row?.missing ?? 0,
  });
};
```

- [ ] **Step 4: 验证编译**

```bash
cd /home/narcissus/Workspace/LadyMuse && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/knowledge/embed/
git commit -m "feat: add POST /api/knowledge/embed and GET .../embed/status endpoints"
```

---

### Task 3: 从同步脚本移除 embedding

**Files:**
- Modify: `src/lib/server/knowledge/sync-aat.ts`
- Modify: `src/lib/server/knowledge/sync-wikipedia.ts`

- [ ] **Step 1: 移除 sync-aat.ts 中的 embedding 代码**

在 `sync-aat.ts` 中：
1. 删除 `import { generateEmbeddings } from "./embedding";`
2. 删除 `embTexts` 和 `embNames` 变量声明及使用
3. 删除 `totalBatches`、`updateProgress({ stage: "embedding" ... })` 及 `generateEmbeddings` 调用块
4. 保留 `finishSync()` 调用

- [ ] **Step 2: 移除 sync-wikipedia.ts 中的 embedding 代码**

在 `sync-wikipedia.ts` 中做同样操作（如有 embedding 代码）。

- [ ] **Step 3: 验证编译 + Commit**

```bash
cd /home/narcissus/Workspace/LadyMuse && npx tsc --noEmit
git add src/lib/server/knowledge/sync-aat.ts src/lib/server/knowledge/sync-wikipedia.ts
git commit -m "refactor: remove embedding from sync scripts"
```

---

### Task 4: 更新知识页面

**Files:**
- Modify: `src/routes/knowledge/+page.svelte`

- [ ] **Step 1: 加"生成向量"按钮**

在同步栏，"清空数据"按钮后面添加：

```svelte
<button
  onclick={() => triggerEmbed()}
  disabled={syncStatus.running}
  class="rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
  >生成向量</button
>
```

- [ ] **Step 2: 加 `triggerEmbed` 函数和 `loadEmbedStatus`**

在 script 部分添加：

```typescript
let embedStatus = $state<{ total: number; embedded: number; missing: number } | null>(null);

async function loadEmbedStatus() {
  const res = await fetch("/api/knowledge/embed/status");
  if (res.ok) embedStatus = await res.json();
}

async function triggerEmbed(dimension?: string, name?: string) {
  await fetch("/api/knowledge/embed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dimension, name }),
  });
}
```

在 `onMount` 中调用 `loadEmbedStatus()`。

- [ ] **Step 3: 概念列表加 embedding 状态圆点**

概念列表每项名称左边加：

```svelte
<span
  class="inline-block w-1.5 h-1.5 rounded-full {c.embedding ? 'bg-green-500' : 'bg-zinc-600'}"
  title={c.embedding ? '已有向量' : '缺少向量'}
></span>
```

API 返回的概念列表需要加上 `embedding` 字段（检测是否有 embedding 值）。在 `GET /api/knowledge` 中加：

```typescript
// select 中加:
hasEmbedding: sql<number>`case when embedding is not null then 1 else 0 end`,
```

概念数据结构加 `hasEmbedding?: number`，模板中用 `c.hasEmbedding` 判断。

- [ ] **Step 4: 详情面板加单条生成按钮**

概念详情面板中，若 `!selectedConcept.hasEmbedding`，显示"生成向量"按钮，点击调 `triggerEmbed(undefined, selectedConcept.name)`。

- [ ] **Step 5: 进度复用现有 SSE**

`embedAll` 已调用 `updateProgress`，通过现有 `syncStatus` 推送进度。进度条中 `source: "embedding"` 时显示"正在生成向量"。

- [ ] **Step 6: 验证编译 + Commit**

```bash
cd /home/narcissus/Workspace/LadyMuse && npx tsc --noEmit
git add src/routes/knowledge/+page.svelte src/routes/api/knowledge/+server.ts
git commit -m "feat: add embed button, status dots, and per-concept embedding UI"
```
