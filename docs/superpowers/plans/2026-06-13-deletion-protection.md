# Deletion Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent accidental deletion of curated images (those with `flag = 'pick'` or `rating > 0`) by rejecting delete requests that include them, before any file or DB mutation occurs.

**Architecture:** Extract the protection check into a pure, testable server-side helper (`deletion-guard.ts`) that queries `image_attributes`. The delete endpoint accepts an array of paths, calls the guard, and returns `409` with the offending list if any path is protected — otherwise proceeds with the existing hard-delete. The frontend sends the full selection in one request and surfaces a toast on rejection.

**Tech Stack:** SvelteKit server routes, Drizzle ORM (SQLite/better-sqlite3), vitest.

**Spec:** `docs/superpowers/specs/2026-06-13-gallery-trash-and-deletion-protection-design.md` §3.

---

## File Structure

- **Create** `src/lib/server/deletion-guard.ts` — `findProtectedPaths(db, paths)`: queries which paths are curated and returns them with reasons.
- **Create** `src/lib/server/__tests__/deletion-guard.test.ts` — in-memory SQLite test matching the `gallery-query-service.test.ts` pattern.
- **Modify** `src/routes/api/comfyui/delete/+server.ts` — accept `{ relative_paths: string[] }`, enforce guard, batch hard-delete.
- **Modify** `src/routes/generations/+page.svelte:278-293` (`confirmDelete`) — send array, handle 409.

---

### Task 1: Deletion-guard helper

**Files:**
- Create: `src/lib/server/deletion-guard.ts`
- Test: `src/lib/server/__tests__/deletion-guard.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/server/__tests__/deletion-guard.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { inArray } from "drizzle-orm";

vi.mock("../db", () => ({ db: vi.fn() }));

import { findProtectedPaths } from "../deletion-guard";
import { imageAttributes } from "../db/schema";

let testDb: ReturnType<typeof drizzle>;

beforeEach(() => {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(`
    CREATE TABLE image_attributes (
      relative_path TEXT PRIMARY KEY,
      rating INTEGER DEFAULT 0,
      color_label TEXT,
      flag TEXT,
      notes TEXT,
      stack_id INTEGER,
      metadata_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      extracted_models TEXT,
      extracted_loras TEXT,
      extracted_samplers TEXT,
      extracted_schedulers TEXT,
      positive_prompt TEXT,
      negative_prompt TEXT,
      steps INTEGER DEFAULT 0,
      cfg_scale real DEFAULT 0,
      seed TEXT,
      width INTEGER,
      height INTEGER,
      aspect_ratio TEXT,
      file_size INTEGER,
      file_format TEXT,
      color_space TEXT,
      has_alpha INTEGER DEFAULT false,
      file_modified_at TEXT,
      is_missing INTEGER DEFAULT false
    );
  `);
  testDb = drizzle(sqlite);
});

describe("findProtectedPaths", () => {
  it("returns empty list when no paths are curated", async () => {
    await testDb.insert(imageAttributes).values([
      { relativePath: "plain.png", rating: 0, flag: null },
      { relativePath: "rejected.png", rating: 0, flag: "reject" },
    ]);
    const result = await findProtectedPaths(testDb, ["plain.png", "rejected.png"]);
    expect(result).toEqual([]);
  });

  it("flags paths with pick flag", async () => {
    await testDb.insert(imageAttributes).values([
      { relativePath: "picked.png", rating: 0, flag: "pick" },
    ]);
    const result = await findProtectedPaths(testDb, ["picked.png"]);
    expect(result).toEqual([{ relativePath: "picked.png", reason: "pick" }]);
  });

  it("flags paths with rating > 0", async () => {
    await testDb.insert(imageAttributes).values([
      { relativePath: "rated.png", rating: 4, flag: null },
    ]);
    const result = await findProtectedPaths(testDb, ["rated.png"]);
    expect(result).toEqual([{ relativePath: "rated.png", reason: "rating" }]);
  });

  it("ignores paths not present in the database", async () => {
    await testDb.insert(imageAttributes).values([
      { relativePath: "rated.png", rating: 3, flag: null },
    ]);
    const result = await findProtectedPaths(testDb, ["rated.png", "ghost.png"]);
    expect(result).toEqual([{ relativePath: "rated.png", reason: "rating" }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/__tests__/deletion-guard.test.ts`
Expected: FAIL — `Cannot find module '../deletion-guard'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/server/deletion-guard.ts`:

```typescript
import { inArray } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";
import { imageAttributes } from "./db/schema";

export interface ProtectedPath {
  relativePath: string;
  reason: "pick" | "rating";
}

type DbClient = ReturnType<typeof drizzle>;

/**
 * Return the subset of `paths` that are curated (pick flag or non-zero rating)
 * and therefore must not be deleted. Order follows the query result.
 */
export async function findProtectedPaths(
  db: DbClient,
  paths: string[],
): Promise<ProtectedPath[]> {
  if (paths.length === 0) return [];

  const rows = await db
    .select({
      relativePath: imageAttributes.relativePath,
      flag: imageAttributes.flag,
      rating: imageAttributes.rating,
    })
    .from(imageAttributes)
    .where(inArray(imageAttributes.relativePath, paths));

  const protectedPaths: ProtectedPath[] = [];
  for (const row of rows) {
    if (row.flag === "pick") {
      protectedPaths.push({ relativePath: row.relativePath, reason: "pick" });
    } else if ((row.rating ?? 0) > 0) {
      protectedPaths.push({ relativePath: row.relativePath, reason: "rating" });
    }
  }
  return protectedPaths;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/__tests__/deletion-guard.test.ts`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/deletion-guard.ts src/lib/server/__tests__/deletion-guard.test.ts
git commit -m "feat: add deletion-guard helper to detect curated images"
```

---

### Task 2: Wire the guard into the delete endpoint

**Files:**
- Modify: `src/routes/api/comfyui/delete/+server.ts`

- [ ] **Step 1: Replace the endpoint body**

The endpoint switches from singular `relative_path` to an array `relative_paths`, calls the guard first, and returns `409` if any path is protected. Replace the entire file content:

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import {
  imageAttributes,
  imageTags,
  collectionImages,
} from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { resolveImagePath, clearCache } from "$lib/server/comfyui-browser";
import { unlinkSync } from "node:fs";
import { broadcastDeletion } from "$lib/server/file-sync-service";
import { findProtectedPaths } from "$lib/server/deletion-guard";

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { relative_paths } = body as { relative_paths?: string[] };

  if (!Array.isArray(relative_paths) || relative_paths.length === 0) {
    return json(
      { error: "relative_paths (string[]) is required" },
      { status: 400 },
    );
  }

  // Reject the whole batch if any path is curated.
  const protectedPaths = await findProtectedPaths(db, relative_paths);
  if (protectedPaths.length > 0) {
    return json({ error: "protected", protected: protectedPaths }, { status: 409 });
  }

  let deleted = 0;
  for (const relativePath of relative_paths) {
    const absPath = await resolveImagePath(relativePath);
    if (!absPath) continue;

    try {
      unlinkSync(absPath);
      clearCache();
    } catch (e: any) {
      return json(
        { error: `Failed to delete file: ${e.message}` },
        { status: 500 },
      );
    }

    await db.delete(imageTags).where(eq(imageTags.relativePath, relativePath));
    await db
      .delete(collectionImages)
      .where(eq(collectionImages.relativePath, relativePath));
    await db
      .delete(imageAttributes)
      .where(eq(imageAttributes.relativePath, relativePath));

    broadcastDeletion(relativePath);
    deleted++;
  }

  return json({ success: true, deleted });
};
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: No errors. (The `db` param to `findProtectedPaths` resolves to the app's drizzle instance.)

- [ ] **Step 3: Manual verification**

Run the dev server: `npm run dev`. In another terminal, confirm the guard fires:

```bash
# Insert a curated row for testing (adjust path to a real file you can spare):
curl -s http://localhost:5173/api/comfyui/delete \
  -H 'Content-Type: application/json' \
  -d '{"relative_paths":["<a-real-protected-path>"]}'
# Expected: {"error":"protected","protected":[{"relativePath":"...","reason":"pick"}]}  (HTTP 409)

curl -s http://localhost:5173/api/comfyui/delete \
  -H 'Content-Type: application/json' \
  -d '{"relative_paths":[]}'
# Expected: {"error":"relative_paths (string[]) is required"}  (HTTP 400)
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/api/comfyui/delete/+server.ts
git commit -m "feat: enforce deletion protection and batch delete in delete endpoint"
```

---

### Task 3: Frontend sends array and handles 409

**Files:**
- Modify: `src/routes/generations/+page.svelte` — the `confirmDelete` function (lines ~278-293).

- [ ] **Step 1: Replace `confirmDelete`**

Find the existing `confirmDelete` function (sends one fetch per path in a loop) and replace it with a single batched request plus 409 handling. Locate this code block:

```typescript
  async function confirmDelete() {
    if (!deleteConfirm) return;
    let deleted = 0;
    for (const path of deleteConfirm.paths) {
      const res = await fetch("/api/comfyui/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relative_path: path }),
      });
      if (res.ok) deleted++;
    }
    showToast(`已删除 ${deleted} 张图片`, "success");
    store.deselectAll();
    store.refresh();
    deleteConfirm = null;
  }
```

Replace with:

```typescript
  async function confirmDelete() {
    if (!deleteConfirm) return;
    const res = await fetch("/api/comfyui/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relative_paths: deleteConfirm.paths }),
    });

    if (res.status === 409) {
      const body = await res.json();
      const count = body.protected?.length ?? 0;
      const names = (body.protected ?? [])
        .map((p: { relativePath: string }) => p.relativePath.split("/").pop())
        .join(", ");
      showToast(
        `${count} 张图片受保护（pick/评分）未删除：${names}。请先取消标记。`,
        "error",
      );
      deleteConfirm = null;
      return;
    }

    if (!res.ok) {
      showToast("删除失败", "error");
      deleteConfirm = null;
      return;
    }

    const body = await res.json();
    showToast(`已删除 ${body.deleted} 张图片`, "success");
    store.deselectAll();
    store.refresh();
    deleteConfirm = null;
  }
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 3: Manual verification**

In the running app (`npm run dev`):
1. Mark an image as `pick` (via context menu or detail panel).
2. Select it (and optionally others) and choose delete.
3. Confirm the toast reports the protected image and that **nothing was deleted**.
4. Clear the pick flag on that image, retry delete — it should succeed.

- [ ] **Step 4: Commit**

```bash
git add src/routes/generations/+page.svelte
git commit -m "feat: send batched delete and surface protection errors in gallery"
```
