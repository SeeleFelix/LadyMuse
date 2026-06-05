# Danbooru 标签知识库 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Danbooru tag knowledge base: JSONL import → SQLite storage → embedding → vector search + browse + detail tools

**Architecture:** User exports BigQuery JSONL → places in `data/danbooru/` → UI triggers import (join + upsert to 3 tables) → UI triggers embed (vec0 `vec_danbooru`) → agent uses 4 tools. Follows existing patterns from embed-all.ts, tools.ts, and Civitai guidance.

**Tech Stack:** better-sqlite3, sqlite-vec, Drizzle ORM, Vercel AI SDK, SvelteKit

---

### Task 1: DB Schema — 4 new tables

**Files:**
- Modify: `src/lib/server/db/schema.ts`
- Modify: `src/lib/server/db/index.ts`

- [ ] **Step 1: Add Drizzle schema**

In `src/lib/server/db/schema.ts`, add after existing danbooru definitions:

```typescript
export const danbooruTags = sqliteTable("danbooru_tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  postCount: integer("post_count").default(0),
  body: text("body"),
  otherNames: text("other_names"),
  embedding: text("embedding"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export const danbooruTagAliases = sqliteTable("danbooru_tag_aliases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  antecedentName: text("antecedent_name").notNull(),
  consequentName: text("consequent_name").notNull(),
  status: text("status").default("active"),
});

export const danbooruTagImplications = sqliteTable("danbooru_tag_implications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  antecedentName: text("antecedent_name").notNull(),
  consequentName: text("consequent_name").notNull(),
  status: text("status").default("active"),
});
```

- [ ] **Step 2: Add vec_danbooru to db/index.ts**

In the vec0 creation block:

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS vec_danbooru USING vec0(
  id TEXT,
  embedding float[1536]
);
```

- [ ] **Step 3: Generate and apply migration**

Run: `npx drizzle-kit generate --name danbooru_tags`

Expected: migration SQL file created.

Run: `npx drizzle-kit migrate`

Expected: tables created.

- [ ] **Step 4: Verify**

```bash
sqlite3 ladymuse.db ".tables" | grep danbooru
# Expected: danbooru_tags, danbooru_tag_aliases, danbooru_tag_implications
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/db/schema.ts src/lib/server/db/index.ts drizzle/
git commit -m "feat: add danbooru_tags, tag_aliases, tag_implications, vec_danbooru"
```

---

### Task 2: JSONL Import — `sync-danbooru.ts`

**Files:**
- Create: `src/lib/server/knowledge/sync-danbooru.ts`
- Create: `src/routes/api/knowledge/danbooru/import/+server.ts`
- Create: `src/routes/api/knowledge/danbooru/status/+server.ts`

- [ ] **Step 1: Write the import function**

Create `src/lib/server/knowledge/sync-danbooru.ts`:

```typescript
import { db } from "../db";
import { danbooruTags, danbooruTagAliases, danbooruTagImplications } from "../db/schema";
import { eq } from "drizzle-orm";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { startSync, updateProgress, finishSync, failSync } from "./sync-status";

const DATA_DIR = "data/danbooru";

function findFiles(prefix: string): string[] {
  const dir = join(process.cwd(), DATA_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.includes(prefix) && f.endsWith(".json"))
    .map((f) => join(dir, f));
}

function readJsonLines<T>(files: string[]): T[] {
  const results: T[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf-8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed) results.push(JSON.parse(trimmed) as T);
    }
  }
  return results;
}

interface TagRow { name: string; post_count: string | number; }
interface WikiRow { title: string; body: string; other_names?: string; updated_at?: string; }
interface AliasRow { antecedent_name: string; consequent_name: string; }
interface ImplicationRow { antecedent_name: string; consequent_name: string; }

export async function importDanbooru() {
  if (!startSync("embedding")) throw new Error("Import already in progress");

  try {
    // --- Tags ---
    const tagsFiles = findFiles("tags");
    if (tagsFiles.length === 0) throw new Error("No tags JSONL found in data/danbooru/");

    updateProgress({ stage: "parsing", total: 0, done: 0 });
    const tags = new Map<string, number>();
    for (const r of readJsonLines<TagRow>(tagsFiles)) {
      tags.set(r.name, Number(r.post_count) || 0);
    }
    console.log(`[danbooru] Loaded ${tags.size} tags`);

    // --- Wiki pages ---
    const wikiFiles = findFiles("wiki");
    if (wikiFiles.length === 0) throw new Error("No wiki_pages JSONL found");

    const wikis = readJsonLines<WikiRow>(wikiFiles);
    console.log(`[danbooru] Loaded ${wikis.length} wiki pages`);

    // --- Join & upsert ---
    updateProgress({ stage: "importing", total: wikis.length, done: 0 });
    let inserted = 0, updated = 0;

    for (const wiki of wikis) {
      if (!tags.has(wiki.title)) continue;

      const existing = await db
        .select({ name: danbooruTags.name })
        .from(danbooruTags)
        .where(eq(danbooruTags.name, wiki.title));

      const data = {
        postCount: tags.get(wiki.title) ?? 0,
        body: wiki.body,
        otherNames: wiki.other_names || null,
        updatedAt: wiki.updated_at || new Date().toISOString(),
      };

      if (existing.length > 0) {
        await db.update(danbooruTags).set(data).where(eq(danbooruTags.name, wiki.title));
        updated++;
      } else {
        await db.insert(danbooruTags).values({ name: wiki.title, ...data, createdAt: new Date().toISOString() });
        inserted++;
      }

      if ((inserted + updated) % 1000 === 0) {
        updateProgress({ done: inserted + updated });
      }
    }

    // --- Aliases ---
    const aliasFiles = findFiles("alias");
    if (aliasFiles.length > 0) {
      const aliases = readJsonLines<AliasRow>(aliasFiles);
      // Clear and re-import
      await db.delete(danbooruTagAliases);
      for (const a of aliases) {
        await db.insert(danbooruTagAliases).values({
          antecedentName: a.antecedent_name,
          consequentName: a.consequent_name,
        });
      }
      console.log(`[danbooru] Loaded ${aliases.length} aliases`);
    }

    // --- Implications ---
    const implFiles = findFiles("implication");
    if (implFiles.length > 0) {
      const imps = readJsonLines<ImplicationRow>(implFiles);
      await db.delete(danbooruTagImplications);
      for (const i of imps) {
        await db.insert(danbooruTagImplications).values({
          antecedentName: i.antecedent_name,
          consequentName: i.consequent_name,
        });
      }
      console.log(`[danbooru] Loaded ${imps.length} implications`);
    }

    updateProgress({ done: wikis.length });
    finishSync();
    return { inserted, updated, total: inserted + updated };
  } catch (e: any) {
    failSync(e.message);
    throw e;
  }
}
```

- [ ] **Step 2: Create API endpoints**

Create directory structure and files:

`src/routes/api/knowledge/danbooru/import/+server.ts`:

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { importDanbooru } from "$lib/server/knowledge/sync-danbooru";
import { getSyncStatus } from "$lib/server/knowledge/sync-status";

export const POST: RequestHandler = async () => {
  if (getSyncStatus().running) {
    return json({ error: "Sync already in progress" }, { status: 409 });
  }
  importDanbooru().catch((e) => console.error("[danbooru import]", e));
  return json({ ok: true });
};
```

`src/routes/api/knowledge/danbooru/status/+server.ts`:

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { danbooruTags } from "$lib/server/db/schema";
import { sql } from "drizzle-orm";

export const GET: RequestHandler = async () => {
  const [total] = await db.select({ count: sql<number>`count(*)` }).from(danbooruTags);
  const [embedded] = await db
    .select({ count: sql<number>`count(*)` })
    .from(danbooruTags)
    .where(sql`${danbooruTags.embedding} IS NOT NULL`);

  return json({ total: total?.count ?? 0, embedded: embedded?.count ?? 0 });
};
```

- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/knowledge/sync-danbooru.ts src/routes/api/knowledge/danbooru/
git commit -m "feat: add danbooru JSONL import with SSE progress"
```

---

### Task 3: Extend embed-all.ts for danbooru

**Files:**
- Modify: `src/lib/server/knowledge/embed-all.ts`

- [ ] **Step 1: Add danbooru to Target and maps**

```typescript
type Target = "concepts" | "patterns" | "references" | "danbooru";

// Add to TABLE_MAP
danbooru: danbooruTags,

// Add to TABLE_NAMES
danbooru: "danbooru_tags",
```

- [ ] **Step 2: Add stripWikiMarkup and buildText case**

```typescript
case "danbooru":
  return `${r.name} ${stripWikiMarkup((r.body as string) || "").slice(0, 300)}`;
```

Add `stripWikiMarkup` from `danbooru.ts` — re-export or inline:

```typescript
function stripWikiMarkup(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\{\{([^}]+)\}\}/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^[#]+\s*/gm, "")
    .replace(/^h[1-6]\.\s*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
```

- [ ] **Step 3: Import danbooruTags**

```typescript
import { artConcepts, artPatterns, artReferences, danbooruTags } from "../db/schema";
```

- [ ] **Step 4: Verify TypeScript**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/knowledge/embed-all.ts
git commit -m "feat: add danbooru target to embed-all with wiki markup stripping"
```

---

### Task 4: Add 4 Danbooru tools

**Files:**
- Modify: `src/lib/server/agent/tools.ts`

- [ ] **Step 1: Import danbooru tables**

```typescript
import {
  artConcepts, artPatterns, artReferences,
  prompts, keywordStats, sessions, sessionMessages,
  danbooruTags, danbooruTagAliases, danbooruTagImplications,
} from "../db/schema";
```

- [ ] **Step 2: Add `search_danbooru_tags`**

```typescript
export const searchDanbooruTags = tool({
  description:
    "搜索 Danbooru 标签知识库。用自然语言描述视觉概念，返回匹配的标签名、描述和使用频率。标签名可直接用于 prompt。可选的 keyword 参数用于模糊匹配标签名。",
  inputSchema: z.object({
    query: z.string().describe("自然语言描述，如'soft cinematic lighting'"),
    keyword: z.string().optional().describe("可选的标签名关键词模糊匹配"),
    topic: z.string().optional().describe("可选，限定搜索范围到某个 topic"),
  }),
  execute: async ({ query, keyword, topic }) => {
    const queryEmbedding = await generateEmbedding(query);
    const rows = vecSearch("vec_danbooru", queryEmbedding, 20);

    if (rows.length === 0) {
      return "标签向量索引为空。请先生成 embedding。";
    }

    const scoreMap = new Map(rows.map((r) => [r.id, 1 - r.distance]));
    let names = rows.filter((r) => scoreMap.get(r.id)! > 0.3).map((r) => r.id);

    // Keyword fuzzy match: supplement with LIKE results
    if (keyword) {
      const kwResults = await db
        .select({ name: danbooruTags.name })
        .from(danbooruTags)
        .where(like(danbooruTags.name, `%${keyword.replace(/\s+/g, "_")}%`))
        .limit(20);
      for (const r of kwResults) {
        if (!names.includes(r.name)) names.push(r.name);
      }
    }

    if (names.length === 0) {
      return "未找到匹配的标签。尝试换一种描述方式。";
    }

    const tags = await db
      .select({
        name: danbooruTags.name,
        body: danbooruTags.body,
        postCount: danbooruTags.postCount,
      })
      .from(danbooruTags)
      .where(or(...names.slice(0, 20).map((n) => eq(danbooruTags.name, n))));

    // Get implications for matched tags
    const implRows = await db
      .select({ consequentName: danbooruTagImplications.consequentName })
      .from(danbooruTagImplications)
      .where(or(...tags.map((t) => eq(danbooruTagImplications.antecedentName, t.name))));

    const implicitTags = [...new Set(implRows.map((r) => r.consequentName))];

    return {
      tags: tags
        .map((t) => ({
          name: t.name,
          description: stripWikiBody(t.body || "").slice(0, 400),
          postCount: t.postCount,
          score: Math.round((scoreMap.get(t.name) ?? 0) * 10000) / 10000,
        }))
        .sort((a, b) => b.score - a.score),
      relatedTags: implicitTags.length > 0 ? implicitTags.slice(0, 10) : undefined,
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
```

- [ ] **Step 3: Add `list_danbooru_topics`**

```typescript
export const listDanbooruTopics = tool({
  description: "列出 Danbooru 标签库中可浏览的所有 topic。",
  execute: async () => {
    const topics = [
      { topic: "lighting", name: "光影技法" },
      { topic: "composition", name: "构图方式" },
      { topic: "colors", name: "色彩风格" },
      { topic: "aesthetic", name: "美学风格" },
      { topic: "background", name: "背景类型" },
      { topic: "posture", name: "姿态" },
      { topic: "gestures", name: "手势" },
      { topic: "focus", name: "焦点/景深" },
    ];
    return topics;
  },
});
```

- [ ] **Step 4: Add `browse_danbooru_tags`**

```typescript
export const browseDanbooruTags = tool({
  description:
    "浏览 Danbooru 标签库中某个 topic 下的标签分组。先看有什么分类，再深入了解具体标签。",
  inputSchema: z.object({
    topic: z
      .enum(["lighting", "composition", "colors", "aesthetic", "background", "posture", "gestures", "focus"])
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
```

- [ ] **Step 5: Add `get_danbooru_tag`**

```typescript
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

    if (tag.length === 0) return `Tag "${name}" not found.`;

    const [aliases, implications] = await Promise.all([
      db
        .select({ antecedentName: danbooruTagAliases.antecedentName })
        .from(danbooruTagAliases)
        .where(eq(danbooruTagAliases.consequentName, name)),
      db
        .select({ consequentName: danbooruTagImplications.consequentName })
        .from(danbooruTagImplications)
        .where(eq(danbooruTagImplications.antecedentName, name)),
    ]);

    const t = tag[0];
    return {
      name: t.name,
      description: stripWikiBody(t.body || "").slice(0, 400),
      postCount: t.postCount,
      otherNames: t.otherNames ? JSON.parse(t.otherNames) : [],
      aliases: aliases.map((a) => a.antecedentName),
      implies: implications.map((i) => i.consequentName),
    };
  },
});
```

- [ ] **Step 6: Register in allToolDefinitions**

```typescript
const allToolDefinitions = {
  // ... existing ...
  search_danbooru_tags: searchDanbooruTags,
  list_danbooru_topics: listDanbooruTopics,
  browse_danbooru_tags: browseDanbooruTags,
  get_danbooru_tag: getDanbooruTag,
};
```

- [ ] **Step 7: Verify TypeScript**

Run: `npx tsc --noEmit`

- [ ] **Step 8: Commit**

```bash
git add src/lib/server/agent/tools.ts
git commit -m "feat: add 4 danbooru tools — search, list, browse, get"
```

---

### Task 5: System Prompt — Danbooru guidance

**Files:**
- Create: `src/lib/server/agent/prompts/08-danbooru-guidance.md`
- Modify: `src/lib/server/agent/prompts/modules.json`

- [ ] **Step 1: Create guidance prompt**

Create `src/lib/server/agent/prompts/08-danbooru-guidance.md`:

```
## Danbooru 标签库使用指引

你有一个 Danbooru 标签知识库，包含数万个经过验证的视觉概念标签及其中文别名、英文描述。这些标签来自数千万张图片的标注，是构建提示词的重要参考。

可浏览的标签 topic：
- lighting（光影技法）- composition（构图方式）- colors（色彩风格）
- background（背景类型）- aesthetic（美学风格）- posture（姿态）
- gestures（手势）- focus（焦点/景深）

### 使用流程

1. **语义搜索** — 用户描述想要的视觉效果时，调用 `search_danbooru_tags`，用自然语言搜索匹配标签。返回的标签名可直接嵌入 prompt
2. **探索浏览** — 不确定有哪些方向可选时，调用 `list_danbooru_topics` 查看所有 topic，再 `browse_danbooru_tags` 浏览具体 topic 下的分组
3. **确认标签** — 需要了解标签含义时，调用 `get_danbooru_tag` 查看完整描述、别名和关联标签

### 关键规则

- 标签名使用下划线格式（如 `backlighting`, `depth_of_field`），嵌入 prompt 时保持原样
- 优先使用语义搜索找到的标签，它们经过大量图片验证
- 如果搜索结果不够精准，调整描述关键词重新搜索，或用 keyword 参数模糊匹配
- Danbooru 标签负责"关键词层面"，你的专业知识负责"结构层面"，两者互补
```

- [ ] **Step 2: Register in modules.json**

Add to `shared_modules`:

```json
{ "file": "08-danbooru-guidance.md", "enabled": true }
```

Add to `tools`:

```json
{ "name": "search_danbooru_tags", "enabled": true },
{ "name": "list_danbooru_topics", "enabled": true },
{ "name": "browse_danbooru_tags", "enabled": true },
{ "name": "get_danbooru_tag", "enabled": true }
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/agent/prompts/08-danbooru-guidance.md src/lib/server/agent/prompts/modules.json
git commit -m "feat: add danbooru guidance prompt and tool registration"
```

---

### Task 6: Frontend — Knowledge page Danbooru section

**Files:**
- Modify: `src/routes/knowledge/+page.svelte`

- [ ] **Step 1: Add UI block**

Add after existing import/embed sections on the knowledge page:

```svelte
<section class="danbooru-section">
  <h2>Danbooru 标签库</h2>
  <p class="hint">
    从 BigQuery 导出 JSONL 文件放到 <code>data/danbooru/</code>，然后导入。
    <a href="/docs/danbooru-import.md" target="_blank">导出指引 →</a>
  </p>
  <div class="status-row">
    <span>已导入: {danbooruStatus.total} 标签</span>
    <span>已向量化: {danbooruStatus.embedded}</span>
  </div>
  <div class="actions">
    <button on:click={importDanbooru} disabled={syncing}>导入标签</button>
    <button on:click={embedDanbooru} disabled={syncing || danbooruStatus.total === 0}>生成向量</button>
  </div>
  {#if progress && progress.source === 'embedding'}
    <div class="progress-bar">
      <div class="fill" style="width: {progress.percent}%"></div>
      <span>{progress.done} / {progress.total}</span>
    </div>
  {/if}
</section>
```

- [ ] **Step 2: Add script logic**

```typescript
let danbooruStatus = { total: 0, embedded: 0 };

async function loadDanbooruStatus() {
  const res = await fetch('/api/knowledge/danbooru/status');
  danbooruStatus = await res.json();
}

async function importDanbooru() {
  syncing = true;
  await fetch('/api/knowledge/danbooru/import', { method: 'POST' });
  syncing = false;
  await loadDanbooruStatus();
}

async function embedDanbooru() {
  syncing = true;
  await fetch('/api/knowledge/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target: 'danbooru' })
  });
  syncing = false;
  await loadDanbooruStatus();
}

onMount(() => { loadDanbooruStatus(); });
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/knowledge/+page.svelte
git commit -m "feat: add danbooru import UI to knowledge page"
```

---

### Task 7: Documentation

**Files:**
- Create: `docs/danbooru-import.md`

- [ ] **Step 1: Write guide**

```markdown
# Danbooru 标签库导入指引

## 导出 BigQuery 数据

1. 打开 [BigQuery 控制台](https://console.cloud.google.com/bigquery?project=danbooru1)
2. 依次执行 4 个 SQL 查询，每个查询完成后点「SAVE RESULTS → JSON (newline delimited)」

### SQL 查询

**Tags**
SELECT id, name, post_count, category, created_at, updated_at, is_deprecated, words
FROM danbooru1.danbooru_public.tags
WHERE category = 0 AND is_deprecated = false

**Wiki Pages**
SELECT id, title, body, other_names, is_locked, is_deleted, created_at, updated_at
FROM danbooru1.danbooru_public.wiki_pages
WHERE is_deleted = false AND body IS NOT NULL AND body != ''

**Tag Aliases**
SELECT id, antecedent_name, consequent_name, status, created_at, updated_at
FROM danbooru1.danbooru_public.tag_aliases
WHERE status = 'active'

**Tag Implications**
SELECT id, antecedent_name, consequent_name, status, created_at, updated_at
FROM danbooru1.danbooru_public.tag_implications
WHERE status = 'active'

## 导入流程

1. 将 4 个 JSON 文件放入项目根目录的 `data/danbooru/` 下
2. 打开知识库管理页面
3. 点击「导入标签」→ 等待完成 → 点击「生成向量」
4. 完成后 agent 即可使用 Danbooru 标签工具

## 更新数据

重复上述步骤。导入时会自动更新已有标签的描述和计数，新增缺失标签。
```

- [ ] **Step 2: Commit**

```bash
git add docs/danbooru-import.md
git commit -m "docs: add danbooru BigQuery export and import guide"
```

---

### Task 8: End-to-End Verification

- [ ] **Step 1: Place JSONL files**

```bash
mkdir -p data/danbooru
cp /home/narcissus/Downloads/bq-results-*.json data/danbooru/
```

- [ ] **Step 2: Start dev server, import via UI**

Click "导入标签", check console log for `[danbooru] Import complete`

- [ ] **Step 3: Verify data**

```bash
sqlite3 ladymuse.db "SELECT COUNT(*) FROM danbooru_tags;"
# Expected: ~50,000
```

- [ ] **Step 4: Generate embeddings**

Click "生成向量", wait for completion.

```bash
sqlite3 ladymuse.db "SELECT COUNT(*) FROM vec_danbooru_rowids;"
# Expected: ~50,000
```

- [ ] **Step 5: Test search tool**

Chat with agent: "find danbooru tags for soft cinematic lighting"
Expected: Returns tags like `backlighting`, `sidelighting` with descriptions and scores.

- [ ] **Step 6: Test browse tool**

Chat: "what topics does danbooru have" → should list 8 topics
Chat: "browse danbooru lighting tags" → should return grouped lighting tags

- [ ] **Step 7: Test detail tool**

Chat: "what does backlighting mean" → should return full description + aliases + implications

---
