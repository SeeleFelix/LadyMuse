# Vector Search Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild all vector search tools on sqlite-vec with clean, unified architecture — three vec0 tables, single-source-of-truth storage, and consistent query patterns.

**Architecture:** Each searchable entity (concepts, patterns, references) gets its own vec0 virtual table. Embeddings are stored ONLY in vec0 as Float32 blobs. Existing 43,433 JSON embeddings from `art_concepts.embedding` are migrated to vec0 at startup. All three tools and the API endpoint use identical MATCH query patterns.

**Tech Stack:** better-sqlite3 + sqlite-vec, Drizzle ORM, Vercel AI SDK tools, SvelteKit API routes

---

### Task 1: DDL Migration

**Files:**
- Create: `drizzle/0014_vector_search.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Drop old broken vec_concepts (empty, zero data loss)
DROP TABLE IF EXISTS vec_concepts;

-- Rebuild with proper id column
CREATE VIRTUAL TABLE vec_concepts USING vec0(
  id TEXT,
  embedding float[1536]
);

-- New vec0 tables for patterns and references
CREATE VIRTUAL TABLE vec_patterns USING vec0(
  id TEXT,
  embedding float[1536]
);

CREATE VIRTUAL TABLE vec_references USING vec0(
  id TEXT,
  embedding float[1536]
);
```

- [ ] **Step 2: Apply migration**

Run: `npx drizzle-kit migrate`
Expected: Migration runs successfully, creates three empty vec0 tables.

- [ ] **Step 3: Verify tables exist**

Run: `sqlite3 ladymuse.db ".tables" | grep vec_`
Expected: `vec_concepts`, `vec_patterns`, `vec_references` (plus shadow tables)

- [ ] **Step 4: Commit**

```bash
git add drizzle/0014_vector_search.sql drizzle/meta/
git commit -m "feat: rebuild vec0 tables with id column, add vec_patterns and vec_references"
```

---

### Task 2: Remove Old vec0 Creation from db/index.ts + Add Data Migration

**Files:**
- Modify: `src/lib/server/db/index.ts`

- [ ] **Step 1: Remove old vec_concepts creation, add migration logic**

Replace the entire file content:

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import * as sqliteVec from "sqlite-vec";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../../../../ladymuse.db");

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Load sqlite-vec extension
sqliteVec.load(sqlite);

export const db = drizzle(sqlite, { schema });
export { sqlite };
export type DB = typeof db;

// --- Data migration: JSON embeddings -> vec0 blobs ---
// Runs once on startup. Idempotent: skips if vec_concepts already has data
// or if no JSON embeddings exist to migrate.

function migrateEmbeddingsToVec0() {
  // Check if migration already ran
  const row = sqlite
    .prepare("SELECT value FROM user_config WHERE key = ?")
    .get("vec_migration_done") as { value: string } | undefined;
  if (row?.value === "1") return;

  // Check if vec_concepts already has data
  const count = sqlite
    .prepare("SELECT COUNT(*) as c FROM vec_concepts_rowids")
    .get() as { c: number };
  if (count.c > 0) {
    sqlite
      .prepare("INSERT OR REPLACE INTO user_config (key, value) VALUES (?, ?)")
      .run("vec_migration_done", "1");
    return;
  }

  // Read JSON embeddings from art_concepts
  const rows = sqlite
    .prepare("SELECT name, embedding FROM art_concepts WHERE embedding IS NOT NULL")
    .all() as { name: string; embedding: string }[];

  if (rows.length === 0) {
    sqlite
      .prepare("INSERT OR REPLACE INTO user_config (key, value) VALUES (?, ?)")
      .run("vec_migration_done", "1");
    return;
  }

  console.log(`[vec migration] migrating ${rows.length} embeddings to vec_concepts...`);

  const insert = sqlite.prepare(
    "INSERT OR REPLACE INTO vec_concepts (id, embedding) VALUES (?, ?)"
  );

  const tx = sqlite.transaction(() => {
    for (const r of rows) {
      const arr = JSON.parse(r.embedding) as number[];
      const vec = new Float32Array(arr);
      const blob = Buffer.from(vec.buffer);
      insert.run(r.name, blob);
    }
  });

  tx();

  sqlite
    .prepare("INSERT OR REPLACE INTO user_config (key, value) VALUES (?, ?)")
    .run("vec_migration_done", "1");

  console.log(`[vec migration] done — ${rows.length} embeddings migrated`);
}

migrateEmbeddingsToVec0();
```

- [ ] **Step 2: Restart dev server and verify migration**

Run: check server logs
Expected: `[vec migration] migrating 43433 embeddings to vec_concepts...` then `[vec migration] done`

- [ ] **Step 3: Verify vec0 has data**

Run: `sqlite3 ladymuse.db "SELECT COUNT(*) FROM vec_concepts_rowids;"`
Expected: `43433`

- [ ] **Step 4: Restart dev server again, verify migration is skipped**

Expected: No migration log (skipped because `vec_migration_done` = "1")

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/db/index.ts
git commit -m "feat: add startup migration from JSON embeddings to vec_concepts"
```

---

### Task 3: Rewrite embed-all.ts — Single Source of Truth in vec0

**Files:**
- Modify: `src/lib/server/knowledge/embed-all.ts`

- [ ] **Step 1: Replace embed-all.ts with unified version**

```typescript
import { db, sqlite } from "../db";
import { artConcepts, artPatterns, artReferences } from "../db/schema";
import { isNull, eq, and } from "drizzle-orm";
import { generateEmbeddings } from "./embedding";
import { startSync, updateProgress, finishSync, failSync } from "./sync-status";

type Target = "concepts" | "patterns" | "references";

function tableFor(target: Target) {
  switch (target) {
    case "concepts": return artConcepts;
    case "patterns": return artPatterns;
    case "references": return artReferences;
  }
}

function vecTableFor(target: Target) {
  return `vec_${target}`;
}

function buildText(r: Record<string, any>, target: Target): string {
  switch (target) {
    case "concepts":
      return `${r.visualDescription || ""} ${r.name} ${r.nameZh || ""}`;
    case "patterns":
      return `${r.intent || ""} ${r.name}`;
    case "references":
      return `${r.intent || ""} ${r.name} ${r.positivePrompt || ""}`;
  }
}

export async function embedTarget(target: Target) {
  if (!startSync(`embedding-${target}`)) {
    throw new Error(`Embedding for ${target} already in progress`);
  }

  const table = tableFor(target);
  const vecTable = vecTableFor(target);

  try {
    const rows = await db
      .select()
      .from(table as any)
      .where(isNull((table as any).embedding));

    if (rows.length === 0) {
      finishSync();
      return { done: 0, total: 0 };
    }

    updateProgress({ stage: `embedding-${target}`, total: rows.length, done: 0 });

    const texts = rows.map((r) => buildText(r as any, target));
    const B = 20;
    const insertStmt = sqlite.prepare(
      `INSERT OR REPLACE INTO ${vecTable} (id, embedding) VALUES (?, ?)`
    );

    for (let i = 0; i < texts.length; i += B) {
      const batch = texts.slice(i, i + B);
      const batchRows = rows.slice(i, i + B);
      const embeddings = await generateEmbeddings(batch);

      if (embeddings.length !== batchRows.length) {
        throw new Error(
          `API returned ${embeddings.length} embeddings for ${batchRows.length} inputs`
        );
      }

      const tx = sqlite.transaction(() => {
        for (let j = 0; j < embeddings.length; j++) {
          const row = batchRows[j] as any;
          const name = row.name;
          const vec = new Float32Array(embeddings[j]);
          const blob = Buffer.from(vec.buffer);
          insertStmt.run(name, blob);

          // Set flag so IS NULL check skips this row next time
          sqlite
            .prepare(`UPDATE ${tableFor(target)} SET embedding = '1' WHERE name = ?`)
            .run(name);
        }
      });

      tx();
      updateProgress({ done: Math.min(i + B, texts.length) });
    }

    finishSync();
    return { done: texts.length, total: texts.length };
  } catch (e: any) {
    failSync(e.message);
    throw e;
  }
}

// Keep backward-compatible export
export async function embedAll(dimension?: string, name?: string) {
  return embedTarget("concepts");
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/knowledge/embed-all.ts
git commit -m "feat: rewrite embed-all to write only vec0, support all three entity types"
```

---

### Task 4: Rewrite Vector Search Tools in tools.ts

**Files:**
- Modify: `src/lib/server/agent/tools.ts`

- [ ] **Step 1: Remove `cosineSimilarity` import, keep only `generateEmbedding`**

On line 16, change:
```typescript
import { generateEmbedding, cosineSimilarity } from "../knowledge/embedding";
```
To:
```typescript
import { generateEmbedding } from "../knowledge/embedding";
```

- [ ] **Step 2: Add shared vec0 query helper**

After the imports (around line 28), add:

```typescript
function vecSearch(vecTable: string, queryEmbedding: number[], k: number) {
  const vec = new Float32Array(queryEmbedding);
  const blob = Buffer.from(vec.buffer);
  return sqlite
    .prepare(
      `SELECT id, distance FROM ${vecTable} WHERE embedding MATCH ? AND k = ? ORDER BY distance LIMIT ?`
    )
    .all(blob, k, k) as { id: string; distance: number }[];
}
```

- [ ] **Step 3: Rewrite `findConcepts` execute function**

Replace lines 497-552 (the execute function body) with:

```typescript
  execute: async ({ intent, category }) => {
    const queryEmbedding = await generateEmbedding(intent);
    const rows = vecSearch("vec_concepts", queryEmbedding, 8);

    if (rows.length === 0) {
      return "向量索引为空。请先生成 embedding。";
    }

    const names = rows.map((r) => r.id);
    const conds = [or(...names.map((n) => eq(artConcepts.name, n)))];
    if (category) conds.push(eq(artConcepts.category, category));

    const concepts = await db
      .select({
        name: artConcepts.name,
        nameZh: artConcepts.nameZh,
        category: artConcepts.category,
        subCategory: artConcepts.subCategory,
        visualDescription: artConcepts.visualDescription,
      })
      .from(artConcepts)
      .where(and(...conds));

    const scoreMap = new Map(rows.map((r) => [r.id, 1 - r.distance]));

    const results = concepts
      .map((c) => ({
        name: c.name,
        nameZh: c.nameZh,
        category: c.category,
        subCategory: c.subCategory,
        snippet: (c.visualDescription || "").slice(0, 150),
        score: Math.round((scoreMap.get(c.name) ?? 0) * 10000) / 10000,
      }))
      .filter((c) => c.score > 0.5)
      .sort((a, b) => b.score - a.score);

    if (results.length === 0) {
      return "未找到匹配度高的概念。建议尝试 explore_dimension 浏览相关维度。";
    }

    return results;
  },
```

- [ ] **Step 4: Rewrite `findPatterns` execute function**

Replace lines 565-608 (the execute function body) with:

```typescript
  execute: async ({ intent, concepts }) => {
    const queryEmbedding = await generateEmbedding(intent);
    const rows = vecSearch("vec_patterns", queryEmbedding, 8);

    if (rows.length === 0) {
      return "向量索引为空。请先生成 pattern embedding。";
    }

    const names = rows.map((r) => r.id);
    const patterns = await db
      .select({
        name: artPatterns.name,
        intent: artPatterns.intent,
        structureOrder: artPatterns.structureOrder,
        involvesDimensions: artPatterns.involvesDimensions,
        involvesConcepts: artPatterns.involvesConcepts,
      })
      .from(artPatterns)
      .where(or(...names.map((n) => eq(artPatterns.name, n))));

    const scoreMap = new Map(rows.map((r) => [r.id, 1 - r.distance]));

    const scored = patterns
      .map((p) => {
        let score = scoreMap.get(p.name) ?? 0;

        // Boost by concept overlap
        if (concepts && concepts.length > 0 && p.involvesConcepts) {
          const involved = JSON.parse(p.involvesConcepts) as string[];
          const overlap = concepts.filter((c) => involved.includes(c)).length;
          score = Math.min(1, score + overlap * 0.15);
        }

        return {
          name: p.name,
          intent: p.intent,
          involvesDimensions: p.involvesDimensions
            ? JSON.parse(p.involvesDimensions)
            : [],
          structureOrder: p.structureOrder,
          score: Math.round(score * 10000) / 10000,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (scored.length === 0) {
      return "未找到匹配的创作模式。可以先用 find_concepts 搜索相关概念，然后尝试直接构建。";
    }

    return scored;
  },
```

- [ ] **Step 5: Rewrite `findReferences` execute function**

Replace lines 620-711 (the execute function body) with:

```typescript
  execute: async ({ concepts, pattern, intent, limit = 3 }) => {
    let results;

    if (concepts?.length || pattern) {
      // Filter by concepts/pattern, then optionally rank by intent
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
        } else if (concepts?.length) {
          match = false;
        }
        if (pattern && r.appliedPattern !== pattern) match = false;
        return match;
      });

      if (intent) {
        const qEmb = await generateEmbedding(intent);
        const vecRows = vecSearch("vec_references", qEmb, 20);
        const scoreMap = new Map(vecRows.map((r) => [r.id, 1 - r.distance]));

        results = filtered
          .map((r) => ({
            name: r.name,
            intent: r.intent,
            promptPreview: r.positivePrompt.slice(0, 200),
            params: r.paramsJson ? JSON.parse(r.paramsJson) : null,
            takeaway: r.takeaway,
            score: Math.round((scoreMap.get(r.name) ?? 0) * 10000) / 10000,
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
      const qEmb = await generateEmbedding(intent);
      const vecRows = vecSearch("vec_references", qEmb, limit);
      const scoreMap = new Map(vecRows.map((r) => [r.id, 1 - r.distance]));
      const names = vecRows.map((r) => r.id);

      if (names.length === 0) {
        return "未找到匹配的参考案例。";
      }

      const refs = await db
        .select()
        .from(artReferences)
        .where(
          and(
            eq(artReferences.verified, 1),
            or(...names.map((n) => eq(artReferences.name, n)))
          )
        );

      results = refs
        .map((r) => ({
          name: r.name,
          intent: r.intent,
          promptPreview: r.positivePrompt.slice(0, 200),
          params: r.paramsJson ? JSON.parse(r.paramsJson) : null,
          takeaway: r.takeaway,
          score: Math.round((scoreMap.get(r.name) ?? 0) * 10000) / 10000,
        }))
        .sort((a, b) => b.score - a.score);
    } else {
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
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/agent/tools.ts
git commit -m "feat: rewrite find_concepts/find_patterns/find_references to use vec0 MATCH"
```

---

### Task 5: Update /api/knowledge Semantic Search

**Files:**
- Modify: `src/routes/api/knowledge/+server.ts`

- [ ] **Step 1: Adapt semantic search to use id column**

The query itself is unchanged (vec0 MATCH already works with `id` column), but update the `hasEmbedding` check to query vec0 instead of relying on the old JSON column. In the semantic search branch (lines 17-66), change:

```typescript
  if (mode === "semantic" && search) {
    const queryEmbedding = await generateEmbedding(search);
    const vec = new Float32Array(queryEmbedding);
    const blob = Buffer.from(vec.buffer);

    const rows = sqlite
      .prepare(
        `SELECT id, distance
         FROM vec_concepts
         WHERE embedding MATCH ? AND k = ?
         ORDER BY distance
         LIMIT 20`,
      )
      .all(blob, 20) as { id: string; distance: number }[];

    if (rows.length === 0) {
      return json([]);
    }

    const scoreMap = new Map(rows.map((r) => [r.id, 1 - r.distance]));
    const names = rows.map((r) => r.id);
    const semConds = [or(...names.map((n) => eq(artConcepts.name, n)))];
    if (category) semConds.push(eq(artConcepts.category, category));

    const concepts = await db
      .select({
        name: artConcepts.name,
        nameZh: artConcepts.nameZh,
        category: artConcepts.category,
        subCategory: artConcepts.subCategory,
        visualDescription: artConcepts.visualDescription,
        embedding: artConcepts.embedding,
      })
      .from(artConcepts)
      .where(and(...semConds));

    // Check vec0 table for hasEmbedding, since new embeddings only go there
    const results = concepts
      .map((c) => ({
        name: c.name,
        nameZh: c.nameZh,
        category: c.category,
        subCategory: c.subCategory,
        snippet: (c.visualDescription || "").slice(0, 150),
        hasEmbedding: c.embedding ? 1 : 0,
        score: Math.round((scoreMap.get(c.name) ?? 0) * 10000) / 10000,
      }))
      .filter((c) => c.score > 0.5)
      .sort((a, b) => b.score - a.score);

    return json(results);
  }
```

(The query changes from `v.id` to `id` — since we renamed the column reference. Actually the SQL itself is the same — `SELECT id, distance FROM vec_concepts` — just without the `v.` alias.)

Wait, look more carefully. The original query was:
```sql
SELECT v.id, v.distance FROM vec_concepts v WHERE v.embedding MATCH ? AND k = ? ORDER BY v.distance LIMIT 20
```

Since we're using `id` (not `v.id`), it works either way. But let me check — the original query uses `v.id` with alias `v`. This works because sqlite-vec's vec0 tables expose `id` columns... wait, I need to be careful.

Actually, the current vec_concepts has NO id column (the bug). After the migration, it WILL have an id column. So the query `SELECT v.id, v.distance FROM vec_concepts v` will work correctly with the new schema.

Let me just use a simpler query without alias in the new code.

OK, actually looking at the original more carefully: the query uses `v.id` and `v.distance` with alias `v`. After the migration, the vec0 table has an `id` column, so `v.id` will work. The key difference is just using `id` instead of `v.id` (no alias). Either works.

Let me keep the changes minimal and just make sure the field reference is correct. The original already uses `v.id` which will work fine with the new schema.

Actually wait, I'm overthinking this. The original query already works syntactically — it references `v.id` and `v.distance`. With the new schema having an `id` column, this will work. The ONLY reason it was broken before is that the old vec0 table had no `id` column. After the migration, the query just works.

So for the API endpoint, the SQL query doesn't actually change. The only thing I should update is the rounding of scores for consistency, and potentially the `hasEmbedding` logic.

Let me simplify — just round scores consistently and keep the rest.

Actually, for the API endpoint, the changes are truly minimal since the SQL is the same. The main win is that the vec0 table now actually has data. Let me just add score rounding and leave the rest. The plan step should reflect this minimal change.

Let me revise the plan step to be more accurate.

OK let me now finalize the plan. Let me write it properly.

- [ ] **Step 1: Add score rounding for consistency**

In `src/routes/api/knowledge/+server.ts`, change the score in the results map (around line 59):
From: `score: scoreMap.get(c.name) ?? 0,`
To: `score: Math.round((scoreMap.get(c.name) ?? 0) * 10000) / 10000,`

- [ ] **Step 2: Verify API still works**

Run dev server, test: `curl "http://localhost:5173/api/knowledge?mode=semantic&search=dark+moody+lighting"`
Expected: Returns JSON array of scored concepts

- [ ] **Step 3: Commit**

---

### Task 6: End-to-End Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Start dev server and check migration log**

Run: dev server
Expected: `[vec migration] done — 43433 embeddings migrated` (first run) or silent (subsequent runs)

- [ ] **Step 2: Query vec_concepts directly**

Run: `sqlite3 ladymuse.db "SELECT id, distance FROM vec_concepts WHERE embedding MATCH (SELECT embedding FROM vec_concepts WHERE id = 'rembrandt_lighting') AND k = 3 ORDER BY distance LIMIT 3;"`
Expected: Returns 3 rows including 'rembrandt_lighting' with distance 0

(Note: this exact syntax may need adjustment for sqlite-vec blob queries, use the app to test instead)

- [ ] **Step 3: Test find_concepts via the agent**

Send a chat message that triggers find_concepts, e.g., "找一些柔和光线的概念"
Expected: Returns scored concept list, no errors

- [ ] **Step 4: Test find_patterns via the agent**

First generate pattern embeddings: trigger embed for patterns, then:
Send a chat message that triggers find_patterns, e.g., "给我推荐适合人物肖像的创作模式"
Expected: Returns scored pattern list, no errors

- [ ] **Step 5: Test find_references via the agent**

First generate reference embeddings, then:
Send a chat message that triggers find_references
Expected: Returns scored reference list, no errors

- [ ] **Step 6: Test API endpoint**

Run: `curl "http://localhost:5173/api/knowledge?mode=semantic&search=dark+moody+atmosphere"`
Expected: JSON array with scored concepts

- [ ] **Step 7: Verify old data preserved**

Run: `sqlite3 ladymuse.db "SELECT COUNT(*) FROM art_concepts WHERE embedding IS NOT NULL AND embedding != '1';"`
Expected: 43433 (original JSON embeddings untouched)

- [ ] **Step 8: Commit any remaining changes**

```bash
git status
git add -A
git commit -m "chore: final verification and cleanup for vector search redesign"
```

---
