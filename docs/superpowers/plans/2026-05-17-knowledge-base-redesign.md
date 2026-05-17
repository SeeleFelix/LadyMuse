# 知识库重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前杂乱的 artTechniques/styles 知识库重构为三层结构（概念/模式/参考），用 Getty AAT + Wikipedia 作为权威数据源，5 个专业工具，embedding 语义搜索。

**Architecture:** 新建 `src/lib/server/knowledge/` 模块（embedding + 同步脚本 + 目录生成），修改 schema.ts 新增 3 张表，修改 tools.ts 替换旧工具，修改 system-prompt.ts 注入知识库目录。

**Tech Stack:** Drizzle ORM (SQLite), OpenAI-compatible Embeddings API (via OpenRouter), N-Triples parser, MediaWiki API

---

## 文件规划

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/lib/server/db/schema.ts` | 修改 | 新增 art_concepts, art_patterns, art_references 表定义 |
| `src/lib/server/knowledge/embedding.ts` | 新建 | embedding 生成、余弦相似度搜索 |
| `src/lib/server/knowledge/directory.ts` | 新建 | 从 DB 查询生成概念目录 + 模式清单文本 |
| `src/lib/server/knowledge/sync-aat.ts` | 新建 | Getty AAT N-Triples 下载、解析、筛选、入库 |
| `src/lib/server/knowledge/sync-wikipedia.ts` | 新建 | Wikipedia 分类遍历、摘要获取、入库 |
| `src/lib/server/agent/system-prompt.ts` | 修改 | buildSystemPrompt 注入知识库目录 |
| `src/lib/server/agent/tools.ts` | 修改 | 删除 knowledge_search, discover_visual_concepts；新增 5 个工具 |
| `src/lib/server/agent/prompts/modules.json` | 修改 | 更新工具配置列表 |

---

### Task 1: 新增数据库表定义

**Files:**
- Modify: `src/lib/server/db/schema.ts`

- [ ] **Step 1: 在 schema.ts 末尾添加三张新表定义**

```typescript
// 知识库 — 概念
export const artConcepts = sqliteTable("art_concepts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  nameZh: text("name_zh"),
  category: text("category").notNull(),
  subCategory: text("sub_category"),
  visualDescription: text("visual_description"),
  tags: text("tags"),
  tagUsage: text("tag_usage"),
  naturalLanguage: text("natural_language"),
  nlUsage: text("nl_usage"),
  relatedConcepts: text("related_concepts"),
  source: text("source").notNull().default("manual"),
  sourceId: text("source_id"),
  qualityVerified: integer("quality_verified").default(0),
  embedding: text("embedding"),
  createdAt: text("created_at").default("(datetime('now'))"),
  updatedAt: text("updated_at").default("(datetime('now'))"),
});

// 知识库 — 模式
export const artPatterns = sqliteTable("art_patterns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  intent: text("intent"),
  structureOrder: text("structure_order"),
  compositionRules: text("composition_rules"),
  conflicts: text("conflicts"),
  involvesDimensions: text("involves_dimensions"),
  involvesConcepts: text("involves_concepts"),
  embedding: text("embedding"),
  qualityVerified: integer("quality_verified").default(0),
  createdAt: text("created_at").default("(datetime('now'))"),
  updatedAt: text("updated_at").default("(datetime('now'))"),
});

// 知识库 — 参考
export const artReferences = sqliteTable("art_references", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  intent: text("intent"),
  positivePrompt: text("positive_prompt").notNull(),
  negativePrompt: text("negative_prompt"),
  paramsJson: text("params_json"),
  appliedConcepts: text("applied_concepts"),
  appliedPattern: text("applied_pattern"),
  deviations: text("deviations"),
  takeaway: text("takeaway"),
  verified: integer("verified").default(0),
  source: text("source").default("manual"),
  embedding: text("embedding"),
  createdAt: text("created_at").default("(datetime('now'))"),
  updatedAt: text("updated_at").default("(datetime('now'))"),
});
```

- [ ] **Step 2: 验证表创建成功**

```bash
cd /home/narcissus/Workspace/LadyMuse && npx drizzle-kit generate
```

Expected: 生成 migration 文件，无报错。

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/db/schema.ts
git commit -m "feat: add art_concepts, art_patterns, art_references tables"
```

---

### Task 2: Embedding 工具模块

**Files:**
- Create: `src/lib/server/knowledge/embedding.ts`

- [ ] **Step 1: 创建 embedding.ts**

```typescript
import { getConfig } from "../config";

const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/embeddings";

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = await getConfig("openrouter_api_key");
  if (!apiKey) throw new Error("OpenRouter API key not configured");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!res.ok) {
    throw new Error(`Embedding API error: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  return json.data[0].embedding;
}

export async function generateEmbeddings(
  texts: string[],
): Promise<number[][]> {
  const apiKey = await getConfig("openrouter_api_key");
  if (!apiKey) throw new Error("OpenRouter API key not configured");

  // Batch up to 20 per request
  const batchSize = 20;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: batch,
      }),
    });

    if (!res.ok) {
      throw new Error(`Embedding API error: ${res.status} ${await res.text()}`);
    }

    const json = await res.json();
    for (const item of json.data) {
      results[item.index + i] = item.embedding;
    }
  }

  return results;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/knowledge/embedding.ts
git commit -m "feat: add embedding generation and cosine similarity utilities"
```

---

### Task 3: 知识库目录生成器

**Files:**
- Create: `src/lib/server/knowledge/directory.ts`

- [ ] **Step 1: 创建 directory.ts**

```typescript
import { db } from "../db";
import { artConcepts, artPatterns } from "../db/schema";
import { sql } from "drizzle-orm";

export async function buildKnowledgeDirectory(): Promise<string> {
  // 概念：按 category → sub_category 分组
  const concepts = await db
    .select({
      category: artConcepts.category,
      subCategory: artConcepts.subCategory,
      name: artConcepts.name,
    })
    .from(artConcepts)
    .orderBy(artConcepts.category, artConcepts.subCategory, artConcepts.name);

  // 按 category → sub_category 分组
  const grouped: Record<string, Record<string, string[]>> = {};
  for (const c of concepts) {
    const cat = c.category;
    const sub = c.subCategory || "other";
    if (!grouped[cat]) grouped[cat] = {};
    if (!grouped[cat][sub]) grouped[cat][sub] = [];
    grouped[cat][sub].push(c.name);
  }

  // 维度名中文映射
  const dimNames: Record<string, string> = {
    lighting: "光影",
    composition: "构图",
    color: "色彩",
    texture: "质感",
    setting: "场景",
    subject: "主体",
    style: "风格",
    technical: "技术",
  };

  let dir = "## 知识库目录\n\n";
  for (const [cat, subs] of Object.entries(grouped)) {
    const catName = dimNames[cat] || cat;
    dir += `### ${catName} (${cat})\n`;
    for (const [sub, names] of Object.entries(subs)) {
      dir += `  ${sub}: ${names.join(", ")}\n`;
    }
    dir += "\n";
  }

  // 模式清单
  const patterns = await db
    .select({ name: artPatterns.name, intent: artPatterns.intent })
    .from(artPatterns)
    .orderBy(artPatterns.name);

  if (patterns.length > 0) {
    dir += "### 创作模式 (patterns)\n";
    for (const p of patterns) {
      const intent = p.intent ? ` — ${p.intent}` : "";
      dir += `  ${p.name}${intent}\n`;
    }
  }

  return dir;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/knowledge/directory.ts
git commit -m "feat: add knowledge directory builder"
```

---

### Task 4: 系统提示词注入知识库目录

**Files:**
- Modify: `src/lib/server/agent/system-prompt.ts`

- [ ] **Step 1: 修改 buildSystemPrompt 函数**

在 `src/lib/server/agent/system-prompt.ts` 顶部添加 import：

```typescript
import { buildKnowledgeDirectory } from "../knowledge/directory";
```

修改 `buildSystemPrompt` 函数：

```typescript
export async function buildSystemPrompt(): Promise<string> {
  const targetModelId = (await getConfig("target_image_model")) || "zit";
  const outputLang = (await getConfig("output_language")) || "zh";
  const promptStyle = (await getConfig("prompt_style")) || "hybrid";

  const profile = getModelProfile(targetModelId) || getDefaultProfile();

  const modules = await loadPromptModules(targetModelId);
  const directory = await buildKnowledgeDirectory();

  return `${modules}\n\n${directory}\n\n${buildSuffix(profile, promptStyle, outputLang)}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/agent/system-prompt.ts
git commit -m "feat: inject knowledge directory into system prompt"
```

---

### Task 5: Getty AAT 同步脚本

**Files:**
- Create: `src/lib/server/knowledge/sync-aat.ts`

- [ ] **Step 1: 创建 sync-aat.ts — AAT 层级路径到维度的映射配置**

```typescript
// AAT 层级路径前缀 → 我们的维度
// 匹配规则：概念的层级路径以指定前缀开头即归入对应维度
const AAT_HIERARCHY_MAPPING: Record<string, string> = {
  // 光影
  "Associated Concepts Facet > ... > light-related concepts": "lighting",
  "Physical Attributes Facet > ... > light": "lighting",
  // 构图
  "Associated Concepts Facet > ... > form and composition concepts": "composition",
  "Associated Concepts Facet > ... > perspective": "composition",
  // 色彩
  "Physical Attributes Facet > Color": "color",
  // 质感
  "Physical Attributes Facet > ... > texture": "texture",
  "Materials Facet > ... > texture": "texture",
  // 场景
  "Objects Facet > Built Environment": "setting",
  "Objects Facet > Settlements and Landscapes": "setting",
  // 主体 — AAT 没有直接对应，需 Wikipedia 补充
  // 风格
  "Styles and Periods Facet": "style",
  // 技术
  "Activities Facet > Processes and Techniques": "technical",
};
```

- [ ] **Step 2: 实现 N-Triples 下载和解析**

```typescript
import JSZip from "jszip";
import { db } from "../db";
import { artConcepts } from "../db/schema";
import { eq } from "drizzle-orm";
import { generateEmbeddings } from "./embedding";

const AAT_FULL_URL = "https://vocab.getty.edu/dataset/aat/full.zip";

// SKOS + GVP 谓词常量
const PREF_LABEL = "http://www.w3.org/2004/02/skos/core#prefLabel";
const SCOPE_NOTE = "http://www.w3.org/2004/02/skos/core#scopeNote";
const ALT_LABEL = "http://www.w3.org/2004/02/skos/core#altLabel";
const RELATED = "http://www.w3.org/2004/02/skos/core#related";
const BROADER = "http://www.w3.org/2004/02/skos/core#broader";
const BROADER_PREFERRED = "http://vocab.getty.edu/ontology#broaderPreferred";
const PREF_LABEL_XL = "http://www.w3.org/2008/05/skos-xl#prefLabel";
const LITERAL_FORM = "http://www.w3.org/2008/05/skos-xl#literalForm";
const IN_SCHEME = "http://www.w3.org/2004/02/skos/core#inScheme";
const AAT_SCHEME = "http://vocab.getty.edu/aat/";

interface AatConcept {
  uri: string;
  prefLabel: string;
  prefLabelZh?: string;
  scopeNote?: string;
  altLabels: string[];
  hierarchyPath: string;
  relatedUris: string[];
}

async function downloadAndParse(): Promise<AatConcept[]> {
  const res = await fetch(AAT_FULL_URL);
  if (!res.ok) throw new Error(`Failed to download AAT: ${res.status}`);

  const buffer = await res.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  // 找到第一个 .nt 或 .ntriples 文件
  const ntFile = Object.values(zip.files).find(
    (f) => f.name.endsWith(".nt") || f.name.endsWith(".ntriples"),
  );
  if (!ntFile) throw new Error("No N-Triples file found in AAT archive");

  const text = await ntFile.async("string");
  const triples = parseNtriples(text);
  return groupIntoConcepts(triples);
}

function parseNtriples(text: string): Triple[] {
  const triples: Triple[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^<(.+?)>\s+<(.+?)>\s+(.+?)\s*\.$/);
    if (!match) continue;
    const [, subject, predicate, objectRaw] = match;
    let object: TripleObject;
    if (objectRaw.startsWith("<")) {
      object = { type: "uri", value: objectRaw.slice(1, -1) };
    } else {
      // Literal: 去除引号和语言标记
      const value = objectRaw
        .replace(/^"|"(@\w+)?$/g, "")
        .replace(/^"(.*)"$/, "$1");
      object = { type: "literal", value };
    }
    triples.push({ subject, predicate, object });
  }
  return triples;
}

interface Triple {
  subject: string;
  predicate: string;
  object: TripleObject;
}

interface TripleObject {
  type: "uri" | "literal";
  value: string;
}

function groupIntoConcepts(triples: Triple[]): AatConcept[] {
  // 按 subject URI 分组
  const bySubject = new Map<string, Triple[]>();
  for (const t of triples) {
    if (!bySubject.has(t.subject)) bySubject.set(t.subject, []);
    bySubject.get(t.subject)!.push(t);
  }

  // 只保留属于 AAT scheme 的概念
  const aatSubjects = new Set(
    triples
      .filter((t) => t.predicate === IN_SCHEME && t.object.value === AAT_SCHEME)
      .map((t) => t.subject),
  );

  const concepts: AatConcept[] = [];
  for (const [uri, ts] of bySubject) {
    if (!aatSubjects.has(uri)) continue;

    const prefLabel = ts.find(
      (t) => t.predicate === PREF_LABEL && t.object.type === "literal",
    )?.object.value;
    if (!prefLabel) continue;

    const scopeNote = ts.find(
      (t) => t.predicate === SCOPE_NOTE && t.object.type === "literal",
    )?.object.value;

    const altLabels = ts
      .filter((t) => t.predicate === ALT_LABEL && t.object.type === "literal")
      .map((t) => t.object.value);

    const relatedUris = ts
      .filter((t) => t.predicate === RELATED && t.object.type === "uri")
      .map((t) => t.object.value);

    const hierarchyPath = buildHierarchyPath(uri, bySubject);

    concepts.push({
      uri,
      prefLabel,
      scopeNote,
      altLabels,
      hierarchyPath,
      relatedUris,
    });
  }
  return concepts;
}

function buildHierarchyPath(
  uri: string,
  bySubject: Map<string, Triple[]>,
): string {
  // 通过 gvp:broaderPreferred 递归回溯构建层级路径
  const pathParts: string[] = [];
  const visited = new Set<string>();
  let current = uri;

  while (current && !visited.has(current)) {
    visited.add(current);
    const ts = bySubject.get(current);
    if (!ts) break;

    // 取当前节点的 prefLabel
    const label = ts.find(
      (t) => t.predicate === PREF_LABEL && t.object.type === "literal",
    )?.object.value;
    if (label) pathParts.unshift(label);

    // 找 broaderPreferred 父节点
    const broader = ts.find(
      (t) =>
        (t.predicate === BROADER_PREFERRED || t.predicate === BROADER) &&
        t.object.type === "uri",
    );
    current = broader?.object.value || "";
  }

  return pathParts.join(" > ");
}

function mapToDimension(hierarchyPath: string): string {
  for (const [prefix, dim] of Object.entries(AAT_HIERARCHY_MAPPING)) {
    if (hierarchyPath.startsWith(prefix)) return dim;
  }
  return "other";
}
```

- [ ] **Step 3: 实现同步主函数**

```typescript
export async function syncAat(): Promise<{ inserted: number; updated: number }> {
  const concepts = await downloadAndParse();

  // 筛选：只保留能映射到我们 8 个维度的概念
  const relevant = concepts.filter((c) => {
    const dim = mapToDimension(c.hierarchyPath);
    return dim !== "other";
  });

  let inserted = 0;
  let updated = 0;

  // 需要 embedding 的文本列表
  const embeddingTexts: string[] = [];
  const embeddingTargets: { name: string }[] = [];

  for (const c of relevant) {
    const category = mapToDimension(c.hierarchyPath);
    const subCategory = extractSubCategory(c.hierarchyPath);
    const scopeNote = c.scopeNote || "";
    const isThin = scopeNote.length < 50;

    // 检查是否已存在
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

    // 收集需要生成 embedding 的条目
    embeddingTexts.push(`${scopeNote} ${c.altLabels.join(" ")} ${c.prefLabel}`);
    embeddingTargets.push({ name: c.prefLabel });
  }

  // 批量生成 embedding
  if (embeddingTexts.length > 0) {
    const embeddings = await generateEmbeddings(embeddingTexts);
    for (let i = 0; i < embeddings.length; i++) {
      await db
        .update(artConcepts)
        .set({ embedding: JSON.stringify(embeddings[i]) })
        .where(eq(artConcepts.name, embeddingTargets[i].name));
    }
  }

  return { inserted, updated };
}

function extractSubCategory(hierarchyPath: string): string {
  // 取层级路径最后一级作为子分类
  const parts = hierarchyPath.split(" > ");
  return parts[parts.length - 1] || "";
}

function extractNameFromUri(uri: string): string {
  // 从 http://vocab.getty.edu/aat/300123456 提取概念名
  // 需通过已有的概念表反查
  return uri.split("/").pop() || uri;
}
```

- [ ] **Step 4: 添加依赖并验证**

```bash
cd /home/narcissus/Workspace/LadyMuse && npm install jszip
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/knowledge/sync-aat.ts package.json package-lock.json
git commit -m "feat: add Getty AAT N-Triples sync script"
```

---

### Task 6: Wikipedia 同步脚本

**Files:**
- Create: `src/lib/server/knowledge/sync-wikipedia.ts`

- [ ] **Step 1: 创建 sync-wikipedia.ts — Wikipedia 分类映射**

```typescript
// Wikipedia 分类 → 维度映射
const WIKIPEDIA_CATEGORY_MAPPING: Record<string, { category: string; subCategory: string }> = {
  "Category:Photographic_techniques": { category: "technical", subCategory: "photography" },
  "Category:Photographic_lighting": { category: "lighting", subCategory: "photographic" },
  "Category:Composition_in_visual_art": { category: "composition", subCategory: "" },
  "Category:Color": { category: "color", subCategory: "" },
  "Category:Color_theory": { category: "color", subCategory: "theory" },
  "Category:Painting_techniques": { category: "technical", subCategory: "painting" },
  "Category:Art_movements": { category: "style", subCategory: "" },
  "Category:Art_genres": { category: "style", subCategory: "genre" },
  "Category:Visual_arts_media": { category: "texture", subCategory: "media" },
  "Category:Artistic_techniques": { category: "technical", subCategory: "" },
  "Category:Light": { category: "lighting", subCategory: "natural" },
  "Category:Perspective_(graphical)": { category: "composition", subCategory: "perspective" },
};

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const DELAY_MS = 200;
```

- [ ] **Step 2: 实现 Wikipedia API 调用**

```typescript
interface WikiPage {
  pageid: number;
  title: string;
  extract: string;
}

async function getCategoryMembers(categoryTitle: string): Promise<string[]> {
  const members: string[] = [];
  let cmcontinue: string | undefined;

  do {
    const params = new URLSearchParams({
      action: "query",
      list: "categorymembers",
      cmtitle: categoryTitle,
      cmtype: "page",
      cmlimit: "500",
      format: "json",
      origin: "*",
    });
    if (cmcontinue) params.set("cmcontinue", cmcontinue);

    const res = await fetch(`${WIKIPEDIA_API}?${params}`);
    const data = await res.json();
    const cm = data.query?.categorymembers || [];
    for (const m of cm) members.push(m.title);
    cmcontinue = data.continue?.cmcontinue;
  } while (cmcontinue);

  return members;
}

async function getPageSummary(title: string): Promise<WikiPage | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url);

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Wikipedia API error for ${title}: ${res.status}`);

  const data = await res.json();
  return {
    pageid: data.pageid,
    title: data.title,
    extract: data.extract || "",
  };
}

async function getChineseTitle(enTitle: string): Promise<string | null> {
  // 通过 Wikipedia 跨语言链接获取中文标题
  const params = new URLSearchParams({
    action: "query",
    prop: "langlinks",
    titles: enTitle,
    lllang: "zh",
    llprop: "autonym",
    format: "json",
    origin: "*",
  });

  const res = await fetch(`${WIKIPEDIA_API}?${params}`);
  const data = await res.json();
  const pages = data.query?.pages || {};
  for (const page of Object.values(pages) as any[]) {
    const ll = page.langlinks;
    if (ll && ll.length > 0) return ll[0]["*"];
  }
  return null;
}
```

- [ ] **Step 3: 实现同步主函数**

```typescript
import { db } from "../db";
import { artConcepts } from "../db/schema";
import { eq } from "drizzle-orm";
import { generateEmbeddings } from "./embedding";

export async function syncWikipedia(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const [wikiCat, mapping] of Object.entries(WIKIPEDIA_CATEGORY_MAPPING)) {
    console.log(`Processing: ${wikiCat}`);

    const titles = await getCategoryMembers(wikiCat);

    for (const title of titles) {
      // 跳过某些命名空间页面
      if (title.startsWith("List of") || title.startsWith("Glossary of") ||
          title.startsWith("Outline of") || title.startsWith("Index of")) {
        continue;
      }

      const summary = await getPageSummary(title);
      if (!summary || !summary.extract) {
        skipped++;
        continue;
      }

      const nameZh = await getChineseTitle(title);

      // 检查是否已存在
      const existing = await db
        .select({ id: artConcepts.id })
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
        // 合并 source
        const old = await db
          .select({ source: artConcepts.source })
          .from(artConcepts)
          .where(eq(artConcepts.id, existing[0].id));
        const oldSource = old[0]?.source || "";
        const newSource = oldSource.includes("wikipedia") ? oldSource : `${oldSource}+wikipedia`;

        await db
          .update(artConcepts)
          .set({
            ...data,
            source: newSource,
            // 保留 AAT 的数据（如果已存在）
            visualDescription: oldSource.includes("aat") ? old[0]?.visualDescription : summary.extract,
          })
          .where(eq(artConcepts.id, existing[0].id));

        skipped++;
      } else {
        await db.insert(artConcepts).values(data);
        inserted++;
      }

      // 延迟避免触发 API 限制
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  // 批量生成 embedding
  const all = await db
    .select({ name: artConcepts.name, visualDescription: artConcepts.visualDescription })
    .from(artConcepts)
    .where(eq(artConcepts.source, "wikipedia"));

  const texts = all.map((c) => c.visualDescription || "");
  const embeddings = await generateEmbeddings(texts);

  for (let i = 0; i < all.length; i++) {
    await db
      .update(artConcepts)
      .set({ embedding: JSON.stringify(embeddings[i]) })
      .where(eq(artConcepts.name, all[i].name));
  }

  return { inserted, skipped };
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/knowledge/sync-wikipedia.ts
git commit -m "feat: add Wikipedia category sync script"
```

---

### Task 7: 5 个新工具实现

**Files:**
- Modify: `src/lib/server/agent/tools.ts` (替换旧工具，新增 5 个)

- [ ] **Step 1: 删除旧工具 `knowledgeSearch` 和 `discoverVisualConcepts`**

在 tools.ts 中：删除 `knowledgeSearch` 函数（第 38-112 行），删除 `discoverVisualConcepts` 函数（第 458-519 行），删除 `danbooru-sync` 的 import。

- [ ] **Step 2: 添加新 import 和类型**

```typescript
import { db } from "../db";
import { artConcepts, artPatterns, artReferences } from "../db/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { generateEmbedding, cosineSimilarity } from "../knowledge/embedding";
```

- [ ] **Step 3: 实现 `explore_dimension`**

```typescript
export const exploreDimension = tool({
  description:
    "浏览一个视觉维度下有哪些艺术概念。当你想了解某个维度（如光影、构图、色彩）有哪些可用概念，或需要确定具体概念名时使用。category 必须是以下之一：lighting/composition/color/texture/setting/subject/style/technical。可选传 subCategory 缩小范围。",
  inputSchema: z.object({
    category: z
      .enum([
        "lighting",
        "composition",
        "color",
        "texture",
        "setting",
        "subject",
        "style",
        "technical",
      ])
      .describe("要浏览的维度"),
    subCategory: z.string().optional().describe("子分类，不传返回整个维度"),
  }),
  execute: async ({ category, subCategory }) => {
    const conditions = [eq(artConcepts.category, category)];
    const rows = await db
      .select({
        name: artConcepts.name,
        nameZh: artConcepts.nameZh,
        subCategory: artConcepts.subCategory,
      })
      .from(artConcepts)
      .where(and(...conditions))
      .limit(30);

    const filtered = subCategory
      ? rows.filter((r) => r.subCategory === subCategory)
      : rows;

    return filtered.map((r) => ({
      name: r.name,
      nameZh: r.nameZh,
      subCategory: r.subCategory,
    }));
  },
});
```

- [ ] **Step 4: 实现 `get_concept`**

```typescript
export const getConcept = tool({
  description:
    "获取一个艺术概念的完整信息（视觉效果描述、提示词标签/自然语言用法、关联概念）。给出精确概念名后调用。",
  inputSchema: z.object({
    name: z.string().describe("概念英文名或中文名"),
  }),
  execute: async ({ name }, { toolCallId }) => {
    // 先查英文名，再查中文名
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
      return `未找到概念 "${name}"。请使用 explore_dimension 浏览相关维度，或 find_concepts 模糊搜索。`;
    }

    const c = rows[0];

    // 获取关联概念的基本信息
    let relatedDetails: { name: string; nameZh: string | null }[] = [];
    if (c.relatedConcepts) {
      const relatedNames = JSON.parse(c.relatedConcepts) as string[];
      if (relatedNames.length > 0) {
        relatedDetails = await db
          .select({ name: artConcepts.name, nameZh: artConcepts.nameZh })
          .from(artConcepts)
          .where(
            or(...relatedNames.map((n) => eq(artConcepts.name, n))),
          )
          .limit(10);
      }
    }

    return {
      name: c.name,
      nameZh: c.nameZh,
      category: c.category,
      subCategory: c.subCategory,
      visualDescription: c.visualDescription,
      // 同时返回标签和自然语言两种形式，让模型自选
      tags: c.tags ? JSON.parse(c.tags) : [],
      tagUsage: c.tagUsage,
      naturalLanguage: c.naturalLanguage,
      nlUsage: c.nlUsage,
      relatedConcepts: relatedDetails,
      source: c.source,
    };
  },
});
```

- [ ] **Step 5: 实现 `find_concepts`（embedding 搜索）**

```typescript
export const findConcepts = tool({
  description:
    "用自然语言意图描述搜索匹配的艺术概念。当你不知道确切概念名、只有模糊方向时使用。如用户说'神秘黑暗的感觉'，搜索 matching 的视觉概念。",
  inputSchema: z.object({
    intent: z.string().describe("意图描述，如'柔和梦幻的光线'"),
  }),
  execute: async ({ intent }) => {
    // 生成查询 embedding
    const queryEmbedding = await generateEmbedding(intent);

    // 加载所有有 embedding 的概念
    const all = await db
      .select({
        name: artConcepts.name,
        nameZh: artConcepts.nameZh,
        category: artConcepts.category,
        subCategory: artConcepts.subCategory,
        visualDescription: artConcepts.visualDescription,
        embedding: artConcepts.embedding,
      })
      .from(artConcepts);

    // 计算余弦相似度
    const scored = all
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
      .slice(0, 8)
      .filter((c) => c.score > 0.5);

    if (scored.length === 0) {
      return "未找到相关概念。建议尝试使用 explore_dimension 浏览相关维度。";
    }

    return scored;
  },
});
```

- [ ] **Step 6: 实现 `find_patterns`**

```typescript
export const findPatterns = tool({
  description:
    "按意图搜索适用的创作模式。模式告诉你'先放什么后放什么、什么配什么效果好、什么不能一起用'。当用户有了大致方向、需要结构化指导时使用。",
  inputSchema: z.object({
    intent: z.string().describe("意图描述，如'暗调情绪感人物肖像'"),
    concepts: z.array(z.string()).optional().describe("已知的概念名列表，用于精确匹配"),
  }),
  execute: async ({ intent, concepts }) => {
    const queryEmbedding = await generateEmbedding(intent);

    const all = await db
      .select({
        name: artPatterns.name,
        intent: artPatterns.intent,
        structureOrder: artPatterns.structureOrder,
        involvesDimensions: artPatterns.involvesDimensions,
        involvesConcepts: artPatterns.involvesConcepts,
        embedding: artPatterns.embedding,
      })
      .from(artPatterns);

    const scored = all
      .filter((p) => p.embedding)
      .map((p) => {
        let score = cosineSimilarity(queryEmbedding, JSON.parse(p.embedding!));

        // 若传了 concepts，叠加概念重叠分
        if (concepts && concepts.length > 0 && p.involvesConcepts) {
          const involved = JSON.parse(p.involvesConcepts) as string[];
          const overlap = concepts.filter((c) => involved.includes(c)).length;
          score += overlap * 0.15; // 每个重叠概念 +0.15
        }

        return {
          name: p.name,
          intent: p.intent,
          involvesDimensions: p.involvesDimensions ? JSON.parse(p.involvesDimensions) : [],
          structureOrder: p.structureOrder,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (scored.length === 0) {
      return "未找到匹配的创作模式。可以先用 find_concepts 搜索相关概念，然后尝试直接构建。";
    }

    return scored;
  },
});
```

- [ ] **Step 7: 实现 `find_references`**

```typescript
export const findReferences = tool({
  description:
    "查找验证过的参考案例。按关联概念、模式或意图查找完整的提示词案例及其经验总结。",
  inputSchema: z.object({
    concepts: z.array(z.string()).optional().describe("关联的概念名"),
    pattern: z.string().optional().describe("关联的模式名"),
    intent: z.string().optional().describe("意图描述"),
    limit: z.number().optional().describe("返回数量，默认 3"),
  }),
  execute: async ({ concepts, pattern, intent, limit = 3 }) => {
    let results;

    if (concepts?.length || pattern) {
      // 精确关联过滤
      const all = await db
        .select()
        .from(artReferences)
        .where(eq(artReferences.verified, 1))
        .orderBy(desc(artReferences.createdAt))
        .limit(50);

      const filtered = all.filter((r) => {
        let match = true;
        if (concepts?.length && r.appliedConcepts) {
          const ac = JSON.parse(r.appliedConcepts) as string[];
          match = concepts.some((c) => ac.includes(c));
        }
        if (pattern && r.appliedPattern !== pattern) match = false;
        return match;
      });

      // 如有 intent，用 embedding 排
      if (intent) {
        const qEmb = await generateEmbedding(intent);
        results = filtered
          .filter((r) => r.embedding)
          .map((r) => ({
            name: r.name,
            intent: r.intent,
            promptPreview: r.positivePrompt.slice(0, 200),
            params: r.paramsJson ? JSON.parse(r.paramsJson) : null,
            takeaway: r.takeaway,
            score: cosineSimilarity(qEmb, JSON.parse(r.embedding!)),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
      } else {
        results = filtered.slice(0, limit).map((r) => ({
          name: r.name,
          intent: r.intent,
          promptPreview: r.positivePrompt.slice(0, 200),
          params: r.paramsJson ? JSON.parse(r.paramsJson) : null,
          takeaway: r.takeaway,
        }));
      }
    } else if (intent) {
      // 纯 embedding 搜索
      const qEmb = await generateEmbedding(intent);
      const all = await db.select().from(artReferences).where(eq(artReferences.verified, 1));

      results = all
        .filter((r) => r.embedding)
        .map((r) => ({
          name: r.name,
          intent: r.intent,
          promptPreview: r.positivePrompt.slice(0, 200),
          params: r.paramsJson ? JSON.parse(r.paramsJson) : null,
          takeaway: r.takeaway,
          score: cosineSimilarity(qEmb, JSON.parse(r.embedding!)),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } else {
      // 都不传，返回最新验证过的
      const rows = await db
        .select({
          name: artReferences.name,
          intent: artReferences.intent,
          positivePrompt: artReferences.positivePrompt,
          paramsJson: artReferences.paramsJson,
          takeaway: artReferences.takeaway,
        })
        .from(artReferences)
        .where(eq(artReferences.verified, 1))
        .orderBy(desc(artReferences.createdAt))
        .limit(limit);

      results = rows.map((r) => ({
        name: r.name,
        intent: r.intent,
        promptPreview: r.positivePrompt.slice(0, 200),
        params: r.paramsJson ? JSON.parse(r.paramsJson) : null,
        takeaway: r.takeaway,
      }));
    }

    if (!results || results.length === 0) {
      return "未找到匹配的参考案例。";
    }

    return results;
  },
});
```

- [ ] **Step 8: 更新 `allToolDefinitions` 和注册**

删除旧条目 `knowledge_search` 和 `discover_visual_concepts`，添加新工具：

```typescript
const allToolDefinitions = {
  explore_dimension: exploreDimension,
  get_concept: getConcept,
  find_concepts: findConcepts,
  find_patterns: findPatterns,
  find_references: findReferences,
  search_my_prompts: searchMyPrompts,
  save_prompt: savePrompt,
  get_user_profile: getUserProfile,
  update_user_profile: updateUserProfile,
  save_session_summary: saveSessionSummary,
  present_options: presentOptions,
  search_civitai_models: searchCivitaiModels,
  search_civitai_prompts: searchCivitaiPrompts,
  search_civitai_tags: searchCivitaiTags,
  web_search: webSearch,
};
```

- [ ] **Step 9: Commit**

```bash
git add src/lib/server/agent/tools.ts
git commit -m "feat: replace old knowledge tools with 5 new knowledge tools"
```

---

### Task 8: 更新工具配置和清理

**Files:**
- Modify: `src/lib/server/agent/prompts/modules.json`

- [ ] **Step 1: 更新 modules.json 中的 tools 配置**

将 `modules.json` 的 `tools` 数组替换为：

```json
{
  "tools": [
    { "name": "explore_dimension", "enabled": true },
    { "name": "get_concept", "enabled": true },
    { "name": "find_concepts", "enabled": true },
    { "name": "find_patterns", "enabled": true },
    { "name": "find_references", "enabled": true },
    { "name": "search_my_prompts", "enabled": true },
    { "name": "save_prompt", "enabled": true },
    { "name": "get_user_profile", "enabled": true },
    { "name": "update_user_profile", "enabled": true },
    { "name": "save_session_summary", "enabled": false },
    { "name": "search_civitai_models", "enabled": false },
    { "name": "search_civitai_prompts", "enabled": true },
    { "name": "search_civitai_tags", "enabled": false },
    { "name": "web_search", "enabled": true },
    { "name": "present_options", "enabled": true }
  ]
}
```

- [ ] **Step 2: 清理 tools.ts 中不再使用的 import**

删除以下不再使用的 import：
- `{ artTechniques, styles }` from schema（knowledgeSearch 用的）
- `{ getTagsByTopic, type DanbooruTopic }` from danbooru-sync
- `buildMultiWordFilter` 函数（如果没有其他地方用）

- [ ] **Step 3: 验证编译**

```bash
cd /home/narcissus/Workspace/LadyMuse && npx tsc --noEmit
```

Expected: 无类型错误。

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/agent/prompts/modules.json src/lib/server/agent/tools.ts
git commit -m "chore: update tool config, remove deprecated knowledge tools"
```

---

### Task 9: 端到端验证

- [ ] **Step 1: 启动开发服务器**

```bash
cd /home/narcissus/Workspace/LadyMuse && npm run dev
```

- [ ] **Step 2: 发起一次聊天，检查工具调用**

发送消息："我想画一幅有神秘氛围的雨中肖像"，观察：
1. 系统提示词是否包含知识库目录
2. AI 是否调用了 `explore_dimension` 或 `find_concepts`
3. 工具返回的数据结构是否正确

- [ ] **Step 3: 检查 embedding 搜索**

确认 AI 能调 `find_concepts` 并返回有 score 的语义结果。

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: end-to-end validation complete"
```
