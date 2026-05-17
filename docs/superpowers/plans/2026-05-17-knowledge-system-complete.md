# 知识库系统完整实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 补齐知识库系统的同步触发、前端页面、API端点、旧系统清理，使其完整可用。

**Architecture:** 新建 `sync-status.ts` 管理同步状态（全局单例，SSE推送），重写 `/api/knowledge` 查询 `artConcepts` + 关键词/语义双模式搜索，新增 sync 系列 API 端点，重写 `/knowledge` 页面为8维度浏览器，删除 `/styles` 页面和 `/api/styles`，更新聊天页工具标签。

**Tech Stack:** SvelteKit, Drizzle ORM (SQLite), SSE (Server-Sent Events)

---

## 文件规划

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/lib/server/knowledge/sync-status.ts` | 新建 | 同步状态全局单例 + SSE 客户端管理 |
| `src/lib/server/knowledge/sync-aat.ts` | 修改 | 接入 SyncStatus 报告进度 |
| `src/lib/server/knowledge/sync-wikipedia.ts` | 修改 | 接入 SyncStatus 报告进度 |
| `src/routes/api/knowledge/+server.ts` | 重写 | 查询 artConcepts + 关键词/语义搜索 |
| `src/routes/api/knowledge/[name]/+server.ts` | 新建 | 单条概念详情 |
| `src/routes/api/knowledge/sync/aat/+server.ts` | 新建 | POST 触发 AAT 同步 |
| `src/routes/api/knowledge/sync/wikipedia/+server.ts` | 新建 | POST 触发 Wikipedia 同步 |
| `src/routes/api/knowledge/sync/status/+server.ts` | 新建 | GET 同步进度快照 |
| `src/routes/api/knowledge/sync/progress/+server.ts` | 新建 | GET SSE 进度推送 |
| `src/routes/knowledge/+page.svelte` | 重写 | 8维度浏览器 + 搜索 + 概念详情 + 同步UI |
| `src/routes/chat/+page.svelte` | 修改 | 更新 TOOL_NAMES + TOOL_LABELS |
| `src/routes/styles/+page.svelte` | 删除 | — |
| `src/routes/api/styles/+server.ts` | 删除 | — |

---

### Task 1: SyncStatus 状态管理模块

**Files:**
- Create: `src/lib/server/knowledge/sync-status.ts`

- [ ] **Step 1: 创建 sync-status.ts**

```typescript
interface SyncStatusData {
  running: boolean;
  source: "aat" | "wikipedia" | null;
  stage: "downloading" | "parsing" | "importing" | "embedding" | null;
  total: number;
  done: number;
  percent: number;
  error: string | null;
  lastSync: string | null;
}

// 全局单例
const status: SyncStatusData = {
  running: false,
  source: null,
  stage: null,
  total: 0,
  done: 0,
  percent: 0,
  error: null,
  lastSync: null,
};

// SSE 客户端集合
const clients = new Set<(data: string) => void>();

export function getSyncStatus(): SyncStatusData {
  return { ...status };
}

export function startSync(source: "aat" | "wikipedia"): boolean {
  if (status.running) return false;
  status.running = true;
  status.source = source;
  status.stage = "downloading";
  status.total = 0;
  status.done = 0;
  status.percent = 0;
  status.error = null;
  broadcast();
  return true;
}

export function updateProgress(update: {
  stage?: SyncStatusData["stage"];
  total?: number;
  done?: number;
}) {
  if (update.stage) status.stage = update.stage;
  if (update.total != null) status.total = update.total;
  if (update.done != null) status.done = update.done;
  if (status.total > 0) {
    status.percent = Math.round((status.done / status.total) * 100);
  }
  broadcast();
}

export function finishSync() {
  status.running = false;
  status.stage = null;
  status.lastSync = new Date().toISOString();
  status.source = null;
  broadcast();
}

export function failSync(error: string) {
  status.running = false;
  status.error = error;
  status.stage = null;
  status.source = null;
  broadcast();
}

export function addSSEClient(send: (data: string) => void) {
  clients.add(send);
  // 立即发送当前状态
  send(formatSSE("status", getSyncStatus()));
}

export function removeSSEClient(send: (data: string) => void) {
  clients.delete(send);
}

function broadcast() {
  const data = formatSSE("progress", getSyncStatus());
  for (const send of clients) {
    try {
      send(data);
    } catch {
      clients.delete(send);
    }
  }
}

function formatSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
```

- [ ] **Step 2: 验证编译**

```bash
cd /home/narcissus/Workspace/LadyMuse && npx tsc --noEmit -- src/lib/server/knowledge/sync-status.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/knowledge/sync-status.ts
git commit -m "feat: add sync status management module with SSE support"
```

---

### Task 2: 同步脚本接入进度报告

**Files:**
- Modify: `src/lib/server/knowledge/sync-aat.ts`
- Modify: `src/lib/server/knowledge/sync-wikipedia.ts`

- [ ] **Step 1: 修改 sync-aat.ts — 同步顶层函数 `syncAat`**

在 `sync-aat.ts` 顶部添加 import：

```typescript
import { startSync, updateProgress, finishSync, failSync } from "./sync-status";
```

在 `export async function syncAat()` 函数体内，包裹进度的关键节点：

```typescript
export async function syncAat(): Promise<{ inserted: number; updated: number }> {
  if (!startSync("aat")) {
    throw new Error("Sync already in progress");
  }

  try {
    updateProgress({ stage: "downloading" });
    const concepts = await downloadAndParse();

    const relevant = concepts.filter((c) => {
      const dim = mapToDimension(c.hierarchyPath);
      return dim !== "other";
    });

    updateProgress({ stage: "importing", total: relevant.length, done: 0 });

    let inserted = 0;
    let updated = 0;
    const embeddingTexts: string[] = [];
    const embeddingTargets: { name: string }[] = [];

    for (let i = 0; i < relevant.length; i++) {
      const c = relevant[i];
      const category = mapToDimension(c.hierarchyPath);
      const subCategory = extractSubCategory(c.hierarchyPath);
      const scopeNote = c.scopeNote || "";

      const existing = await db
        .select({ id: artConcepts.id })
        .from(artConcepts)
        .where(eq(artConcepts.name, c.prefLabel));

      const data = {
        name: c.prefLabel,
        nameZh: c.prefLabelZh || null,
        category,
        subCategory,
        visualDescription: scopeNote,
        tags: JSON.stringify(c.altLabels),
        relatedConcepts: JSON.stringify(c.relatedUris.map(extractNameFromUri)),
        source: "aat" as const,
        sourceId: c.uri,
      };

      if (existing.length > 0) {
        await db.update(artConcepts).set(data).where(eq(artConcepts.id, existing[0].id));
        updated++;
      } else {
        await db.insert(artConcepts).values(data);
        inserted++;
      }

      embeddingTexts.push(`${scopeNote} ${c.altLabels.join(" ")} ${c.prefLabel}`);
      embeddingTargets.push({ name: c.prefLabel });

      if (i % 100 === 0) {
        updateProgress({ done: i + 1 });
      }
    }

    updateProgress({ stage: "embedding", done: relevant.length });

    if (embeddingTexts.length > 0) {
      const embeddings = await generateEmbeddings(embeddingTexts);
      for (let j = 0; j < embeddings.length; j++) {
        await db
          .update(artConcepts)
          .set({ embedding: JSON.stringify(embeddings[j]) })
          .where(eq(artConcepts.name, embeddingTargets[j].name));
        if (j % 100 === 0) {
          updateProgress({ done: relevant.length + j + 1 });
        }
      }
    }

    finishSync();
    return { inserted, updated };
  } catch (e: any) {
    failSync(e.message);
    throw e;
  }
}
```

- [ ] **Step 2: 修改 sync-wikipedia.ts — 同步顶层函数 `syncWikipedia`**

在 `sync-wikipedia.ts` 顶部添加 import：

```typescript
import { startSync, updateProgress, finishSync, failSync } from "./sync-status";
```

在 `export async function syncWikipedia()` 函数体内添加相同的进度报告模式：

```typescript
export async function syncWikipedia(): Promise<{ inserted: number; skipped: number }> {
  if (!startSync("wikipedia")) {
    throw new Error("Sync already in progress");
  }

  try {
    let inserted = 0;
    let skipped = 0;
    const embeddingTargets: string[] = [];

    const categories = Object.entries(WIKIPEDIA_CATEGORY_MAPPING);
    updateProgress({ stage: "downloading", total: categories.length, done: 0 });

    for (let ci = 0; ci < categories.length; ci++) {
      const [wikiCat, mapping] = categories[ci];
      console.log(`Processing: ${wikiCat}`);

      const titles = await getCategoryMembers(wikiCat);

      for (let ti = 0; ti < titles.length; ti++) {
        const title = titles[ti];
        if (
          title.startsWith("List of") ||
          title.startsWith("Glossary of") ||
          title.startsWith("Outline of") ||
          title.startsWith("Index of")
        ) {
          skipped++;
          continue;
        }

        const summary = await getPageSummary(title);
        if (!summary || !summary.extract) {
          skipped++;
          continue;
        }

        const nameZh = await getChineseTitle(title);

        const existing = await db
          .select({ id: artConcepts.id, source: artConcepts.source, visualDescription: artConcepts.visualDescription })
          .from(artConcepts)
          .where(eq(artConcepts.name, title));

        const data = {
          name: title,
          nameZh: nameZh || null,
          category: mapping.category,
          subCategory: mapping.subCategory || null,
          visualDescription: summary.extract,
          source: "wikipedia" as const,
          sourceId: String(summary.pageid),
        };

        if (existing.length > 0) {
          const old = existing[0];
          const oldSource = old.source || "";
          const newSource = oldSource.includes("wikipedia") ? oldSource : `${oldSource}+wikipedia`;

          await db
            .update(artConcepts)
            .set({
              ...data,
              source: newSource,
              visualDescription: oldSource.includes("aat") ? old.visualDescription : summary.extract,
            })
            .where(eq(artConcepts.id, old.id));
          skipped++;
        } else {
          await db.insert(artConcepts).values(data);
          inserted++;
        }

        embeddingTargets.push(title);
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }

      updateProgress({ done: ci + 1 });
    }

    updateProgress({ stage: "embedding" });

    if (embeddingTargets.length > 0) {
      const rows = await db
        .select({ name: artConcepts.name, visualDescription: artConcepts.visualDescription })
        .from(artConcepts)
        .where(or(...embeddingTargets.map((n) => eq(artConcepts.name, n))));

      const texts = rows.map((c) => c.visualDescription || "");
      if (texts.length > 0) {
        const embeddings = await generateEmbeddings(texts);
        for (let i = 0; i < rows.length; i++) {
          await db
            .update(artConcepts)
            .set({ embedding: JSON.stringify(embeddings[i]) })
            .where(eq(artConcepts.name, rows[i].name));
        }
      }
    }

    finishSync();
    return { inserted, skipped };
  } catch (e: any) {
    failSync(e.message);
    throw e;
  }
}
```

- [ ] **Step 3: 验证编译**

```bash
cd /home/narcissus/Workspace/LadyMuse && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/knowledge/sync-aat.ts src/lib/server/knowledge/sync-wikipedia.ts
git commit -m "feat: wire sync scripts to progress reporting"
```

---

### Task 3: API 端点 — 重写 /api/knowledge + 新增 sync 端点

**Files:**
- Rewrite: `src/routes/api/knowledge/+server.ts`
- Create: `src/routes/api/knowledge/[name]/+server.ts`
- Create: `src/routes/api/knowledge/sync/aat/+server.ts`
- Create: `src/routes/api/knowledge/sync/wikipedia/+server.ts`
- Create: `src/routes/api/knowledge/sync/status/+server.ts`
- Create: `src/routes/api/knowledge/sync/progress/+server.ts`

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p /home/narcissus/Workspace/LadyMuse/src/routes/api/knowledge/\[name\]
mkdir -p /home/narcissus/Workspace/LadyMuse/src/routes/api/knowledge/sync/aat
mkdir -p /home/narcissus/Workspace/LadyMuse/src/routes/api/knowledge/sync/wikipedia
mkdir -p /home/narcissus/Workspace/LadyMuse/src/routes/api/knowledge/sync/status
mkdir -p /home/narcissus/Workspace/LadyMuse/src/routes/api/knowledge/sync/progress
```

- [ ] **Step 2: 重写 `/api/knowledge/+server.ts`**

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { artConcepts } from "$lib/server/db/schema";
import { eq, like, or, and } from "drizzle-orm";
import { generateEmbedding, cosineSimilarity } from "$lib/server/knowledge/embedding";

export const GET: RequestHandler = async ({ url }) => {
  const category = url.searchParams.get("category");
  const search = url.searchParams.get("search");
  const mode = url.searchParams.get("mode") || "keyword"; // keyword | semantic
  const subCategory = url.searchParams.get("subCategory");

  if (mode === "semantic" && search) {
    // 语义搜索
    const queryEmbedding = await generateEmbedding(search);

    let query = db
      .select({
        name: artConcepts.name,
        nameZh: artConcepts.nameZh,
        category: artConcepts.category,
        subCategory: artConcepts.subCategory,
        visualDescription: artConcepts.visualDescription,
        embedding: artConcepts.embedding,
      })
      .from(artConcepts);

    if (category) {
      query = query.where(eq(artConcepts.category, category));
    }

    const all = await query;

    const results = all
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
      .filter((c) => c.score > 0.5)
      .slice(0, 20);

    return json(results);
  }

  // 关键词搜索
  let query = db
    .select({
      name: artConcepts.name,
      nameZh: artConcepts.nameZh,
      category: artConcepts.category,
      subCategory: artConcepts.subCategory,
      visualDescription: artConcepts.visualDescription,
      tags: artConcepts.tags,
    })
    .from(artConcepts);

  const conditions = [];
  if (category) {
    conditions.push(eq(artConcepts.category, category));
  }
  if (subCategory) {
    conditions.push(eq(artConcepts.subCategory, subCategory));
  }
  if (search) {
    const q = `%${search}%`;
    conditions.push(
      or(
        like(artConcepts.name, q),
        like(artConcepts.nameZh, q),
        like(artConcepts.visualDescription, q),
        like(artConcepts.tags, q),
      ),
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const rows = await query.orderBy(artConcepts.category, artConcepts.subCategory, artConcepts.name).limit(100);

  // 按 subCategory 分组
  const grouped: Record<string, typeof rows> = {};
  for (const r of rows) {
    const sub = r.subCategory || "other";
    if (!grouped[sub]) grouped[sub] = [];
    grouped[sub].push(r);
  }

  return json(Object.entries(grouped).map(([sub, items]) => ({
    subCategory: sub,
    concepts: items.map((r) => ({
      name: r.name,
      nameZh: r.nameZh,
      category: r.category,
      subCategory: r.subCategory,
      snippet: (r.visualDescription || "").slice(0, 150),
      tags: r.tags ? JSON.parse(r.tags) : [],
    })),
  })));
};
```

- [ ] **Step 3: 创建 `/api/knowledge/[name]/+server.ts`**

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { artConcepts } from "$lib/server/db/schema";
import { eq, or } from "drizzle-orm";

export const GET: RequestHandler = async ({ params }) => {
  const name = decodeURIComponent(params.name);

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
    return json({ error: "Not found" }, { status: 404 });
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

  return json({
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
  });
};
```

- [ ] **Step 4: 创建 sync 系列端点**

`/api/knowledge/sync/aat/+server.ts`:

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { syncAat } from "$lib/server/knowledge/sync-aat";
import { getSyncStatus } from "$lib/server/knowledge/sync-status";

export const POST: RequestHandler = async () => {
  const status = getSyncStatus();
  if (status.running) {
    return json({ error: "Sync already in progress", status }, { status: 409 });
  }

  // 异步启动同步
  syncAat().catch((e) => {
    console.error("[sync-aat]", e);
  });

  return json({ ok: true });
};
```

`/api/knowledge/sync/wikipedia/+server.ts`:

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { syncWikipedia } from "$lib/server/knowledge/sync-wikipedia";
import { getSyncStatus } from "$lib/server/knowledge/sync-status";

export const POST: RequestHandler = async () => {
  const status = getSyncStatus();
  if (status.running) {
    return json({ error: "Sync already in progress", status }, { status: 409 });
  }

  syncWikipedia().catch((e) => {
    console.error("[sync-wikipedia]", e);
  });

  return json({ ok: true });
};
```

`/api/knowledge/sync/status/+server.ts`:

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getSyncStatus } from "$lib/server/knowledge/sync-status";

export const GET: RequestHandler = async () => {
  return json(getSyncStatus());
};
```

`/api/knowledge/sync/progress/+server.ts`:

```typescript
import type { RequestHandler } from "./$types";
import { addSSEClient, removeSSEClient } from "$lib/server/knowledge/sync-status";

export const GET: RequestHandler = async ({ request }) => {
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        controller.enqueue(new TextEncoder().encode(data));
      };

      addSSEClient(send);

      request.signal.addEventListener("abort", () => {
        removeSSEClient(send);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
```

- [ ] **Step 5: 验证编译**

```bash
cd /home/narcissus/Workspace/LadyMuse && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/routes/api/knowledge/
git commit -m "feat: rewrite /api/knowledge, add sync endpoints and concept detail API"
```

---

### Task 4: 删除旧 /styles 页面和 /api/styles

**Files:**
- Delete: `src/routes/styles/+page.svelte`
- Delete: `src/routes/api/styles/+server.ts`

- [ ] **Step 1: 删除文件**

```bash
rm /home/narcissus/Workspace/LadyMuse/src/routes/styles/+page.svelte
rm /home/narcissus/Workspace/LadyMuse/src/routes/api/styles/+server.ts
rmdir /home/narcissus/Workspace/LadyMuse/src/routes/styles/ 2>/dev/null
rmdir /home/narcissus/Workspace/LadyMuse/src/routes/api/styles/ 2>/dev/null
```

- [ ] **Step 2: 验证编译**

```bash
cd /home/narcissus/Workspace/LadyMuse && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add -A src/routes/styles/ src/routes/api/styles/
git commit -m "chore: remove deprecated /styles page and /api/styles endpoint"
```

---

### Task 5: 重写 /knowledge 页面

**Files:**
- Rewrite: `src/routes/knowledge/+page.svelte`

- [ ] **Step 1: 重写 knowledge/+page.svelte**

```svelte
<script lang="ts">
  import { onMount } from "svelte";

  interface Concept {
    name: string;
    nameZh: string | null;
    category: string;
    subCategory: string | null;
    snippet: string;
    tags: string[];
    score?: number;
  }

  interface ConceptDetail {
    name: string;
    nameZh: string | null;
    category: string;
    subCategory: string | null;
    visualDescription: string | null;
    tags: string[];
    tagUsage: string | null;
    naturalLanguage: string | null;
    nlUsage: string | null;
    relatedConcepts: { name: string; nameZh: string | null }[];
    source: string;
  }

  interface SyncStatus {
    running: boolean;
    source: string | null;
    stage: string | null;
    total: number;
    done: number;
    percent: number;
    error: string | null;
    lastSync: string | null;
  }

  const DIMENSIONS = [
    { id: "lighting", zh: "光影" },
    { id: "composition", zh: "构图" },
    { id: "color", zh: "色彩" },
    { id: "texture", zh: "质感" },
    { id: "setting", zh: "场景" },
    { id: "subject", zh: "主体" },
    { id: "style", zh: "风格" },
    { id: "technical", zh: "技术" },
  ];

  let selectedDim = $state<string | null>(null);
  let selectedConcept = $state<ConceptDetail | null>(null);
  let searchQuery = $state("");
  let searchMode = $state<"keyword" | "semantic">("keyword");
  let results = $state<{ subCategory: string; concepts: Concept[] }[]>([]);
  let patterns = $state<{ name: string; intent: string | null }[]>([]);
  let loading = $state(false);
  let copied = $state(false);

  let syncStatus = $state<SyncStatus>({
    running: false,
    source: null,
    stage: null,
    total: 0,
    done: 0,
    percent: 0,
    error: null,
    lastSync: null,
  });

  onMount(() => {
    loadSyncStatus();
    loadPatterns();
    const sse = new EventSource("/api/knowledge/sync/progress");
    sse.addEventListener("progress", (e) => {
      syncStatus = JSON.parse(e.data);
    });
    sse.addEventListener("status", (e) => {
      syncStatus = JSON.parse(e.data);
    });
    return () => sse.close();
  });

  async function loadSyncStatus() {
    const res = await fetch("/api/knowledge/sync/status");
    if (res.ok) syncStatus = await res.json();
  }

  async function loadPatterns() {
    // 从目录文本解析模式清单，或后续通过 API 加载
  }

  async function selectDimension(dim: string) {
    selectedDim = dim;
    selectedConcept = null;
    await loadConcepts();
  }

  async function loadConcepts() {
    loading = true;
    const params = new URLSearchParams();
    if (selectedDim) params.set("category", selectedDim);
    if (searchQuery) params.set("search", searchQuery);
    params.set("mode", searchMode);

    const res = await fetch(`/api/knowledge?${params}`);
    if (res.ok) {
      if (searchMode === "semantic" && searchQuery) {
        const flat = await res.json();
        results = [{ subCategory: "搜索结果", concepts: flat }];
      } else {
        results = await res.json();
      }
    }
    loading = false;
  }

  async function selectConcept(name: string) {
    const res = await fetch(`/api/knowledge/${encodeURIComponent(name)}`);
    if (res.ok) selectedConcept = await res.json();
  }

  async function triggerSync(source: "aat" | "wikipedia") {
    await fetch(`/api/knowledge/sync/${source}`, { method: "POST" });
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }
</script>

<div class="flex h-full flex-col">
  <!-- 同步栏 -->
  <div class="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900/50 px-4 py-2">
    <span class="text-sm font-medium text-zinc-200">知识库管理</span>
    <div class="flex-1"></div>
    {#if syncStatus.lastSync}
      <span class="text-xs text-zinc-500">上次同步: {new Date(syncStatus.lastSync).toLocaleString()}</span>
    {/if}
    <button
      onclick={() => triggerSync("aat")}
      disabled={syncStatus.running}
      class="rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
      >同步 AAT</button
    >
    <button
      onclick={() => triggerSync("wikipedia")}
      disabled={syncStatus.running}
      class="rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
      >同步 Wikipedia</button
    >
  </div>

  <!-- 进度条 -->
  {#if syncStatus.running}
    <div class="border-b border-zinc-800 bg-zinc-900/30 px-4 py-1.5">
      <div class="flex items-center gap-2 text-xs text-zinc-400">
        <span>正在同步 {syncStatus.source} · {syncStatus.stage}</span>
        <span class="text-zinc-600">{syncStatus.percent}%</span>
      </div>
      <div class="mt-1 h-1 rounded-full bg-zinc-800">
        <div
          class="h-1 rounded-full bg-violet-500 transition-all"
          style="width: {syncStatus.percent}%"
        ></div>
      </div>
    </div>
  {/if}

  {#if syncStatus.error}
    <div class="border-b border-red-800 bg-red-900/20 px-4 py-1.5 text-xs text-red-400">
      同步失败: {syncStatus.error}
    </div>
  {/if}

  <div class="flex flex-1 overflow-hidden">
    <!-- 左侧：维度 + 搜索 -->
    <div class="w-64 shrink-0 border-r border-zinc-800 bg-zinc-900/50 overflow-y-auto p-3">
      <button
        onclick={() => { selectedDim = null; loadConcepts(); }}
        class="block w-full rounded px-2.5 py-1.5 text-left text-sm mb-2 {!selectedDim
          ? 'bg-violet-600/20 text-violet-300'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}"
        >全部维度</button
      >

      {#each DIMENSIONS as dim}
        <button
          onclick={() => selectDimension(dim.id)}
          class="block w-full rounded px-2.5 py-1.5 text-left text-sm {selectedDim === dim.id
            ? 'bg-violet-600/20 text-violet-300'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}"
          >{dim.zh}</button
        >
      {/each}
    </div>

    <!-- 右侧：概念列表 + 详情 -->
    <div class="flex-1 flex overflow-hidden">
      <!-- 概念列表 -->
      <div class="w-80 shrink-0 border-r border-zinc-800 overflow-y-auto p-4">
        <div class="flex items-center gap-2 mb-3">
          <input
            type="text"
            placeholder="搜索概念..."
            bind:value={searchQuery}
            oninput={() => loadConcepts()}
            class="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
          />
          <select
            bind:value={searchMode}
            onchange={() => searchQuery && loadConcepts()}
            class="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300"
          >
            <option value="keyword">关键词</option>
            <option value="semantic">语义</option>
          </select>
        </div>

        {#if loading}
          <div class="text-xs text-zinc-500">加载中...</div>
        {:else}
          {#each results as group}
            <div class="mb-3">
              <div class="text-xs font-medium text-zinc-500 mb-1">{group.subCategory}</div>
              {#each group.concepts as c}
                <button
                  onclick={() => selectConcept(c.name)}
                  class="block w-full rounded px-2 py-1.5 text-left text-xs {selectedConcept?.name === c.name
                    ? 'bg-violet-600/20 text-violet-300'
                    : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-200'}"
                >
                  <div>{c.nameZh || c.name}</div>
                  {#if c.score != null}
                    <div class="text-zinc-600">{Math.round(c.score * 100)}%</div>
                  {/if}
                </button>
              {/each}
            </div>
          {/each}
          {#if results.length === 0 && !loading}
            <div class="text-xs text-zinc-600">暂无结果</div>
          {/if}
        {/if}
      </div>

      <!-- 详情面板 -->
      <div class="flex-1 overflow-y-auto p-6">
        {#if selectedConcept}
          <div>
            <div class="flex items-center gap-2 mb-1">
              <h1 class="text-xl font-bold text-zinc-100">{selectedConcept.nameZh || selectedConcept.name}</h1>
              <span class="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">{selectedConcept.name}</span>
              <span class="rounded bg-violet-600/20 px-2 py-0.5 text-xs text-violet-400">{selectedConcept.source}</span>
            </div>

            {#if selectedConcept.visualDescription}
              <div class="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <h3 class="text-sm font-medium text-zinc-300 mb-2">视觉描述</h3>
                <p class="text-sm text-zinc-400 leading-relaxed">{selectedConcept.visualDescription}</p>
              </div>
            {/if}

            {#if selectedConcept.tags.length > 0}
              <div class="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <div class="flex items-center justify-between mb-2">
                  <h3 class="text-sm font-medium text-zinc-300">提示词标签</h3>
                  <button
                    onclick={() => copyText(selectedConcept!.tags.join(", "))}
                    class="rounded bg-violet-600 px-3 py-1 text-xs text-white hover:bg-violet-500"
                    >{copied ? "已复制!" : "复制全部"}</button
                  >
                </div>
                <div class="flex flex-wrap gap-1.5">
                  {#each selectedConcept.tags as tag}
                    <span class="rounded bg-violet-600/20 px-2 py-0.5 text-xs text-violet-300">{tag}</span>
                  {/each}
                </div>
                {#if selectedConcept.tagUsage}
                  <p class="mt-2 text-xs text-zinc-500">{selectedConcept.tagUsage}</p>
                {/if}
              </div>
            {/if}

            {#if selectedConcept.naturalLanguage}
              <div class="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <div class="flex items-center justify-between mb-2">
                  <h3 class="text-sm font-medium text-zinc-300">自然语言描述</h3>
                  <button
                    onclick={() => copyText(selectedConcept!.naturalLanguage || "")}
                    class="rounded bg-violet-600 px-3 py-1 text-xs text-white hover:bg-violet-500"
                    >复制</button
                  >
                </div>
                <p class="text-sm text-zinc-400 leading-relaxed">{selectedConcept.naturalLanguage}</p>
                {#if selectedConcept.nlUsage}
                  <p class="mt-2 text-xs text-zinc-500">{selectedConcept.nlUsage}</p>
                {/if}
              </div>
            {/if}

            {#if selectedConcept.relatedConcepts.length > 0}
              <div class="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <h3 class="text-sm font-medium text-zinc-300 mb-2">关联概念</h3>
                <div class="flex flex-wrap gap-1.5">
                  {#each selectedConcept.relatedConcepts as rel}
                    <button
                      onclick={() => selectConcept(rel.name)}
                      class="rounded bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                      >{rel.nameZh || rel.name}</button
                    >
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {:else}
          <div class="flex h-full items-center justify-center text-zinc-600">
            选择一个概念查看详情
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: 验证编译**

```bash
cd /home/narcissus/Workspace/LadyMuse && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/knowledge/+page.svelte
git commit -m "feat: rewrite knowledge page with 8-dimension browser, search, and sync UI"
```

---

### Task 6: 更新聊天页工具标签

**Files:**
- Modify: `src/routes/chat/+page.svelte`

- [ ] **Step 1: 替换 TOOL_NAMES（line 107-114）**

将：

```typescript
const TOOL_NAMES: Record<string, string> = {
  knowledge_search: "搜索知识库",
  search_my_prompts: "搜索历史提示词",
  save_prompt: "保存提示词",
  get_user_profile: "获取用户画像",
  update_user_profile: "更新用户画像",
  save_session_summary: "保存会话摘要",
};
```

替换为：

```typescript
const TOOL_NAMES: Record<string, string> = {
  explore_dimension: "知识库 · 浏览维度",
  get_concept: "知识库 · 查看概念",
  find_concepts: "知识库 · 搜索概念",
  find_patterns: "知识库 · 匹配模式",
  find_references: "知识库 · 查找参考",
  search_my_prompts: "搜索历史提示词",
  save_prompt: "保存提示词",
  get_user_profile: "获取用户画像",
  update_user_profile: "更新用户画像",
  save_session_summary: "保存会话摘要",
};
```

- [ ] **Step 2: 替换 TOOL_LABELS（line 617-630）**

将：

```typescript
const TOOL_LABELS: Record<string, string> = {
  knowledge_search: "知识库搜索",
  search_my_prompts: "搜索历史提示词",
  save_prompt: "保存提示词",
  get_user_profile: "获取用户画像",
  update_user_profile: "更新用户画像",
  save_session_summary: "保存会话摘要",
  search_civitai_models: "搜索 CivitAI 模型",
  search_civitai_prompts: "搜索 CivitAI 提示词",
  search_civitai_tags: "搜索 CivitAI 标签",
  discover_visual_concepts: "视觉概念发现",
  web_search: "网页搜索",
  present_options: "选项交互",
};
```

替换为：

```typescript
const TOOL_LABELS: Record<string, string> = {
  explore_dimension: "知识库 · 浏览维度",
  get_concept: "知识库 · 查看概念",
  find_concepts: "知识库 · 搜索概念",
  find_patterns: "知识库 · 匹配模式",
  find_references: "知识库 · 查找参考",
  search_my_prompts: "搜索历史提示词",
  save_prompt: "保存提示词",
  get_user_profile: "获取用户画像",
  update_user_profile: "更新用户画像",
  save_session_summary: "保存会话摘要",
  search_civitai_models: "搜索 CivitAI 模型",
  search_civitai_prompts: "搜索 CivitAI 提示词",
  search_civitai_tags: "搜索 CivitAI 标签",
  web_search: "网页搜索",
  present_options: "选项交互",
};
```

- [ ] **Step 3: 验证编译**

```bash
cd /home/narcissus/Workspace/LadyMuse && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/chat/+page.svelte
git commit -m "feat: update chat tool labels for new knowledge tools"
```

---

### Task 7: 端到端验证

- [ ] **Step 1: 启动开发服务器**

```bash
cd /home/narcissus/Workspace/LadyMuse && timeout 15 npm run dev 2>&1 || true
```

Expected: Vite 启动成功，无报错。

- [ ] **Step 2: 测试 API 端点**

```bash
# 测试 GET /api/knowledge
curl -s http://localhost:5173/api/knowledge | head -c 200

# 测试 GET /api/knowledge/sync/status
curl -s http://localhost:5173/api/knowledge/sync/status

# 测试 POST /api/knowledge/sync/aat（如果知识库已配置）
curl -s -X POST http://localhost:5173/api/knowledge/sync/aat
```

- [ ] **Step 3: 验证页面路由**

```bash
# /knowledge 页面可访问
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/knowledge
# Expected: 200

# /styles 页面应 404
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/styles
# Expected: 404
```

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: end-to-end validation" --allow-empty
```
