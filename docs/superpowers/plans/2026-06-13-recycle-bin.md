# Recycle Bin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a recycle bin: deletions move files into `<outputDir>/.trash/<id>/` and copy their DB row into a new `trashed_images` table, so they can be restored. Restoring to an occupied path auto-renames. Permanent delete and empty-trash are deliberate, unprotected actions.

**Architecture:** Independent `trashed_images` table (the active `image_attributes` table is untouched). A `TrashService` class owns move/copy/restore orchestration. The chokidar watcher and the gallery file walker both learn to ignore `.trash`. Four new SSE event types (`trash`, `restore`, `purge`, `empty`) drive the frontend store.

**Tech Stack:** SvelteKit, Drizzle ORM (SQLite/better-sqlite3), chokidar, vitest, Svelte 5 runes.

**Spec:** `docs/superpowers/specs/2026-06-13-gallery-trash-and-deletion-protection-design.md` §2.

**Depends on:** Deletion Protection plan (`2026-06-13-deletion-protection.md`) — the protection guard already gates entry to trash; this plan changes the delete mechanism from hard-delete to soft-delete-to-trash.

---

## File Structure

- **Modify** `src/lib/server/db/schema.ts` — add `trashedImages` table.
- **Create** `drizzle/0018_trashed_images.sql` — via `drizzle-kit generate`.
- **Modify** `src/lib/server/file-sync-service.ts` — ignore `.trash`, guard spurious delete broadcasts, add 4 broadcast helpers + extend `FileEvent`.
- **Modify** `src/lib/server/comfyui-browser.ts` — skip `.trash` in `collectImageFiles`.
- **Create** `src/lib/server/trash-service.ts` — `TrashService` class with soft-delete / restore / purge / empty / list.
- **Create** `src/lib/server/__tests__/trash-service.test.ts` — integration tests (temp dir + in-memory DB).
- **Modify** `src/routes/api/comfyui/delete/+server.ts` — soft-delete via `TrashService` instead of `unlinkSync`.
- **Create** `src/routes/api/comfyui/trash/+server.ts` — `GET` list.
- **Create** `src/routes/api/comfyui/trash/restore/+server.ts` — `POST` restore.
- **Create** `src/routes/api/comfyui/trash/purge/+server.ts` — `POST` purge one.
- **Create** `src/routes/api/comfyui/trash/empty/+server.ts` — `POST` empty all.
- **Modify** `src/lib/stores/gallery-store.svelte.ts` — extend client `FileEvent`, add `viewMode`/`trashCount`/trash-list state, handle new events.
- **Modify** `src/lib/components/gallery/GalleryToolbar.svelte` — trash entry button + count.
- **Create** `src/lib/components/gallery/TrashView.svelte` — trash grid with restore/purge per card + empty button.

---

### Task 1: Add `trashed_images` table (schema + migration)

**Files:**
- Modify: `src/lib/server/db/schema.ts`
- Create: `drizzle/0018_*.sql` (generated)
- Backup: `ladymuse.db`

- [ ] **Step 1: Add the table to the schema**

In `src/lib/server/db/schema.ts`, after the `imageAttributes` definition (ends ~line 295) and before `imageTags`, add:

```typescript
export const trashedImages = sqliteTable("trashed_images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  originalRelativePath: text("original_relative_path").notNull(),
  trashPath: text("trash_path").notNull(),
  rating: integer("rating").default(0),
  flag: text("flag"),
  colorLabel: text("color_label"),
  metadataJson: text("metadata_json"),
  width: integer("width"),
  height: integer("height"),
  fileFormat: text("file_format"),
  aspectRatio: text("aspect_ratio"),
  deletedAt: text("deleted_at").notNull().default(now),
});
```

- [ ] **Step 2: Back up the database**

```bash
cp ladymuse.db "ladymuse.db.bak.$(date +%Y%m%d%H%M%S)"
```

- [ ] **Step 3: Generate the migration**

Run: `npx drizzle-kit generate`
Expected: a new file `drizzle/0018_<some_name>.sql` containing a `CREATE TABLE \`trashed_images\` (...)` statement. Note the exact filename for the next step.

- [ ] **Step 4: Apply the migration**

Run: `npx drizzle-kit migrate`
Expected: the migration applies cleanly. Verify:

```bash
sqlite3 ladymuse.db ".schema trashed_images"
```

Expected output shows the `trashed_images` table with all columns.

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/db/schema.ts drizzle/0018_*.sql drizzle/meta/
git commit -m "feat: add trashed_images table for recycle bin"
```

---

### Task 2: Ignore `.trash` everywhere files are scanned

**Files:**
- Modify: `src/lib/server/file-sync-service.ts` — `shouldIgnore`, `reconcileOnStartup` walk, and guard `handleFileDeleted`.
- Modify: `src/lib/server/comfyui-browser.ts` — `collectImageFiles` walk.

Without this, moving a file into `.trash/` is seen by chokidar as a new image, and trash files leak into the gallery listing.

- [ ] **Step 1: Extend `shouldIgnore` in FileSyncService**

In `src/lib/server/file-sync-service.ts`, find `shouldIgnore` (~line 133):

```typescript
  private shouldIgnore(filename: string): boolean {
    const basename = filename.split("/").pop() ?? filename;
    return basename.startsWith("_");
  }
```

Replace with:

```typescript
  private shouldIgnore(filename: string): boolean {
    const basename = filename.split("/").pop() ?? filename;
    if (basename.startsWith("_")) return true;
    // Never track files inside the recycle bin.
    if (filename.split("/").includes(".trash")) return true;
    return false;
  }
```

- [ ] **Step 2: Skip `.trash` in `reconcileOnStartup`**

In the same file, find the `walk` function inside `reconcileOnStartup` (~line 229-256). Locate the loop body that skips `_`:

```typescript
      for (const entry of entries) {
        if (entry.name.startsWith("_")) continue;
```

Replace with:

```typescript
      for (const entry of entries) {
        if (entry.name.startsWith("_")) continue;
        if (entry.name === ".trash") continue;
```

- [ ] **Step 3: Guard the spurious delete broadcast**

When the trash service hard-deletes a row and renames the file, chokidar later fires `unlink` for the old path. `handleFileDeleted` must not broadcast a `delete` for a row that no longer exists. Find `handleFileDeleted` (~line 157):

```typescript
    this.debounceEvent("delete", filename, async () => {
      await db
        .update(imageAttributes)
        .set({ isMissing: true, updatedAt: new Date().toISOString() })
        .where(eq(imageAttributes.relativePath, filename));
      this.broadcast({ type: "delete", path: filename });
    });
```

Replace with:

```typescript
    this.debounceEvent("delete", filename, async () => {
      const existing = await db
        .select({ relativePath: imageAttributes.relativePath })
        .from(imageAttributes)
        .where(eq(imageAttributes.relativePath, filename))
        .limit(1);
      if (existing.length === 0) return;
      await db
        .update(imageAttributes)
        .set({ isMissing: true, updatedAt: new Date().toISOString() })
        .where(eq(imageAttributes.relativePath, filename));
      this.broadcast({ type: "delete", path: filename });
    });
```

- [ ] **Step 4: Skip `.trash` in the gallery walker**

In `src/lib/server/comfyui-browser.ts`, find the `walk` function inside `collectImageFiles` (~line 49-71). Locate:

```typescript
      for (const entry of entries) {
        if (
          entry.name.startsWith("_") &&
          !entry.name.endsWith(".png") &&
          !entry.name.endsWith(".jpg")
        )
          continue;
```

Replace with:

```typescript
      for (const entry of entries) {
        if (entry.name === ".trash") continue;
        if (
          entry.name.startsWith("_") &&
          !entry.name.endsWith(".png") &&
          !entry.name.endsWith(".jpg")
        )
          continue;
```

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/file-sync-service.ts src/lib/server/comfyui-browser.ts
git commit -m "fix: ignore .trash dir in file watcher and gallery walker"
```

---

### Task 3: Extend `FileEvent` and add broadcast helpers

**Files:**
- Modify: `src/lib/server/file-sync-service.ts` — `FileEvent` type + 4 broadcast helpers.

- [ ] **Step 1: Replace the `FileEvent` type**

In `src/lib/server/file-sync-service.ts`, find (~line 12):

```typescript
export type FileEvent = { type: "add" | "delete" | "modify"; path: string };
```

Replace with a discriminated union:

```typescript
export type FileEvent =
  | { type: "add" | "delete" | "modify"; path: string }
  | { type: "trash"; path: string; trashId: number }
  | { type: "restore"; path: string; renamed: boolean }
  | { type: "purge"; trashId: number }
  | { type: "empty" };
```

- [ ] **Step 2: Add broadcast helpers**

At the end of the file (after `broadcastDeletion`, ~line 344), add:

```typescript
export function broadcastTrash(path: string, trashId: number): void {
  instancePromise?.then((instance) => {
    instance?.broadcast({ type: "trash", path, trashId });
  });
}

export function broadcastRestore(path: string, renamed: boolean): void {
  instancePromise?.then((instance) => {
    instance?.broadcast({ type: "restore", path, renamed });
  });
}

export function broadcastPurge(trashId: number): void {
  instancePromise?.then((instance) => {
    instance?.broadcast({ type: "purge", trashId });
  });
}

export function broadcastEmpty(): void {
  instancePromise?.then((instance) => {
    instance?.broadcast({ type: "empty" });
  });
}
```

- [ ] **Step 3: Type-check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/file-sync-service.ts
git commit -m "feat: extend FileEvent with trash/restore/purge/empty and broadcast helpers"
```

---

### Task 4: `TrashService` (soft-delete, restore, purge, empty, list)

**Files:**
- Create: `src/lib/server/trash-service.ts`
- Test: `src/lib/server/__tests__/trash-service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/server/__tests__/trash-service.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema";

vi.mock("../comfyui-browser", () => ({ clearCache: vi.fn() }));
vi.mock("../file-sync-service", () => ({
  broadcastTrash: vi.fn(),
  broadcastRestore: vi.fn(),
  broadcastPurge: vi.fn(),
  broadcastEmpty: vi.fn(),
}));

import { TrashService } from "../trash-service";

let testDir: string;
let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

beforeEach(() => {
  const id = randomBytes(8).toString("hex");
  testDir = `/tmp/test-trash-${id}`;
  mkdirSync(testDir, { recursive: true });

  sqlite = new Database(":memory:");
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
    CREATE TABLE trashed_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_relative_path TEXT NOT NULL,
      trash_path TEXT NOT NULL,
      rating INTEGER DEFAULT 0,
      flag TEXT,
      color_label TEXT,
      metadata_json TEXT,
      width INTEGER,
      height INTEGER,
      file_format TEXT,
      aspect_ratio TEXT,
      deleted_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE image_tags ( relative_path TEXT NOT NULL, tag_id INTEGER NOT NULL );
    CREATE TABLE collection_images ( collection_id INTEGER NOT NULL, relative_path TEXT NOT NULL, sort_order INTEGER DEFAULT 0, added_at TEXT DEFAULT (datetime('now')) );
  `);
  db = drizzle(sqlite);
});

function seedImage(relativePath: string, content: string, attrs?: Partial<typeof schema.imageAttributes.$inferInsert>) {
  const abs = join(testDir, relativePath);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, content);
  db.insert(schema.imageAttributes).values({
    relativePath,
    rating: 0,
    flag: null,
    ...attrs,
  }).run();
}

describe("TrashService.softDeleteToTrash", () => {
  it("moves the file to .trash/<id>/ and copies the row", async () => {
    seedImage("a.png", "AAA", { rating: 3 });
    const svc = new TrashService(db, testDir);

    const { trashId } = await svc.softDeleteToTrash("a.png");

    expect(existsSync(join(testDir, "a.png"))).toBe(false);
    expect(existsSync(join(testDir, ".trash", String(trashId), "a.png"))).toBe(true);
    expect(readFileSync(join(testDir, ".trash", String(trashId), "a.png"), "utf8")).toBe("AAA");

    const trashed = db.select().from(schema.trashedImages).all();
    expect(trashed).toHaveLength(1);
    expect(trashed[0].rating).toBe(3);
    expect(trashed[0].originalRelativePath).toBe("a.png");

    const active = db.select().from(schema.imageAttributes).all();
    expect(active).toHaveLength(0);
  });
});

describe("TrashService.restoreFromTrash", () => {
  it("restores to the original path when free", async () => {
    seedImage("a.png", "AAA", { rating: 3 });
    const svc = new TrashService(db, testDir);
    const { trashId } = await svc.softDeleteToTrash("a.png");

    const result = await svc.restoreFromTrash(trashId);

    expect(result.renamed).toBe(false);
    expect(result.restoredPath).toBe("a.png");
    expect(existsSync(join(testDir, "a.png"))).toBe(true);
    const active = db.select().from(schema.imageAttributes).all();
    expect(active[0].rating).toBe(3);
    expect(db.select().from(schema.trashedImages).all()).toHaveLength(0);
  });

  it("renames when the original path is occupied", async () => {
    seedImage("a.png", "OLD", { rating: 3 });
    const svc = new TrashService(db, testDir);
    const { trashId } = await svc.softDeleteToTrash("a.png");
    // Re-create a different file at the same path.
    seedImage("a.png", "NEW");

    const result = await svc.restoreFromTrash(trashId);

    expect(result.renamed).toBe(true);
    expect(result.restoredPath.startsWith("a_restored_")).toBe(true);
    expect(existsSync(join(testDir, "a.png"))).toBe(true);
    expect(readFileSync(join(testDir, "a.png"), "utf8")).toBe("NEW");
    expect(existsSync(join(testDir, result.restoredPath))).toBe(true);
    expect(readFileSync(join(testDir, result.restoredPath), "utf8")).toBe("OLD");
  });
});

describe("TrashService.purgeTrashItem", () => {
  it("deletes the file and the trash row", async () => {
    seedImage("a.png", "AAA");
    const svc = new TrashService(db, testDir);
    const { trashId } = await svc.softDeleteToTrash("a.png");
    const trashFile = join(testDir, ".trash", String(trashId), "a.png");
    expect(existsSync(trashFile)).toBe(true);

    await svc.purgeTrashItem(trashId);

    expect(existsSync(trashFile)).toBe(false);
    expect(db.select().from(schema.trashedImages).all()).toHaveLength(0);
  });
});

describe("TrashService.emptyTrash", () => {
  it("removes all trash items", async () => {
    seedImage("a.png", "AAA");
    seedImage("b.png", "BBB");
    const svc = new TrashService(db, testDir);
    await svc.softDeleteToTrash("a.png");
    await svc.softDeleteToTrash("b.png");
    expect(db.select().from(schema.trashedImages).all()).toHaveLength(2);

    const { count } = await svc.emptyTrash();

    expect(count).toBe(2);
    expect(db.select().from(schema.trashedImages).all()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/__tests__/trash-service.test.ts`
Expected: FAIL — `Cannot find module '../trash-service'`.

- [ ] **Step 3: Implement `TrashService`**

Create `src/lib/server/trash-service.ts`:

```typescript
import { eq, desc, sql } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";
import {
  join,
  dirname,
  basename,
  extname,
  resolve,
} from "node:path";
import {
  mkdirSync,
  renameSync,
  unlinkSync,
  existsSync,
  readdirSync,
} from "node:fs";
import {
  imageAttributes,
  trashedImages,
  imageTags,
  collectionImages,
} from "./db/schema";
import { clearCache } from "./comfyui-browser";
import {
  broadcastTrash,
  broadcastRestore,
  broadcastPurge,
  broadcastEmpty,
} from "./file-sync-service";

type DbClient = ReturnType<typeof drizzle>;

export interface TrashListItem {
  id: number;
  originalRelativePath: string;
  rating: number;
  flag: string | null;
  colorLabel: string | null;
  width: number | null;
  height: number | null;
  aspectRatio: string | null;
  fileFormat: string | null;
  deletedAt: string;
}

export interface TrashListResult {
  items: TrashListItem[];
  total: number;
}

/**
 * TrashService moves image files into <outputDir>/.trash/<id>/ and mirrors their
 * image_attributes row into trashed_images, so deleted images can be restored.
 * The active image_attributes table is never flagged — it is hard-deleted on
 * trash and re-inserted on restore.
 */
export class TrashService {
  constructor(
    private db: DbClient,
    private outputDir: string,
  ) {}

  async softDeleteToTrash(
    relativePath: string,
  ): Promise<{ trashId: number }> {
    const absSource = resolve(this.outputDir, relativePath);
    if (!absSource.startsWith(resolve(this.outputDir))) {
      throw new Error("Invalid path");
    }
    if (!existsSync(absSource)) {
      throw new Error("Source file does not exist");
    }

    const rows = await this.db
      .select()
      .from(imageAttributes)
      .where(eq(imageAttributes.relativePath, relativePath))
      .limit(1);
    const attr = rows[0];
    if (!attr) throw new Error("No image_attributes row for path");

    const inserted = await this.db
      .insert(trashedImages)
      .values({
        originalRelativePath: relativePath,
        trashPath: "", // filled after we know the id
        rating: attr.rating ?? 0,
        flag: attr.flag,
        colorLabel: attr.colorLabel,
        metadataJson: attr.metadataJson,
        width: attr.width,
        height: attr.height,
        fileFormat: attr.fileFormat,
        aspectRatio: attr.aspectRatio,
      })
      .returning({ id: trashedImages.id });
    const trashId = inserted[0].id;

    const trashDir = join(this.outputDir, ".trash", String(trashId));
    mkdirSync(trashDir, { recursive: true });
    const fileBasename = basename(relativePath);
    const trashPath = join(".trash", String(trashId), fileBasename);
    renameSync(absSource, join(this.outputDir, trashPath));

    await this.db
      .update(trashedImages)
      .set({ trashPath })
      .where(eq(trashedImages.id, trashId));

    await this.db
      .delete(imageTags)
      .where(eq(imageTags.relativePath, relativePath));
    await this.db
      .delete(collectionImages)
      .where(eq(collectionImages.relativePath, relativePath));
    await this.db
      .delete(imageAttributes)
      .where(eq(imageAttributes.relativePath, relativePath));

    clearCache();
    broadcastTrash(relativePath, trashId);
    return { trashId };
  }

  async restoreFromTrash(
    trashId: number,
  ): Promise<{ restoredPath: string; renamed: boolean }> {
    const rows = await this.db
      .select()
      .from(trashedImages)
      .where(eq(trashedImages.id, trashId))
      .limit(1);
    const item = rows[0];
    if (!item) throw new Error("Trash item not found");

    const originalAbs = resolve(this.outputDir, item.originalRelativePath);
    const occupied = existsSync(originalAbs);
    let targetRelativePath = item.originalRelativePath;

    if (occupied) {
      const dir = dirname(item.originalRelativePath);
      const name = basename(item.originalRelativePath, extname(item.originalRelativePath));
      const ext = extname(item.originalRelativePath);
      const ts = new Date()
        .toISOString()
        .replace(/[-:T]/g, "")
        .slice(0, 14);
      const renamed = dir
        ? `${dir}/${name}_restored_${ts}${ext}`
        : `${name}_restored_${ts}${ext}`;
      targetRelativePath = renamed;
    }

    const targetAbs = resolve(this.outputDir, targetRelativePath);
    mkdirSync(dirname(targetAbs), { recursive: true });
    renameSync(resolve(this.outputDir, item.trashPath), targetAbs);

    await this.db
      .insert(imageAttributes)
      .values({
        relativePath: targetRelativePath,
        rating: item.rating ?? 0,
        flag: item.flag,
        colorLabel: item.colorLabel,
        metadataJson: item.metadataJson,
        width: item.width,
        height: item.height,
        fileFormat: item.fileFormat,
        aspectRatio: item.aspectRatio,
      })
      .onConflictDoUpdate({
        target: imageAttributes.relativePath,
        set: {
          rating: item.rating ?? 0,
          flag: item.flag,
          colorLabel: item.colorLabel,
          metadataJson: item.metadataJson,
          width: item.width,
          height: item.height,
          fileFormat: item.fileFormat,
          aspectRatio: item.aspectRatio,
          isMissing: false,
        },
      });

    await this.db.delete(trashedImages).where(eq(trashedImages.id, trashId));

    broadcastRestore(targetRelativePath, occupied);
    return { restoredPath: targetRelativePath, renamed: occupied };
  }

  async purgeTrashItem(trashId: number): Promise<void> {
    const rows = await this.db
      .select()
      .from(trashedImages)
      .where(eq(trashedImages.id, trashId))
      .limit(1);
    const item = rows[0];
    if (!item) return;

    const abs = resolve(this.outputDir, item.trashPath);
    if (abs.startsWith(resolve(this.outputDir)) && existsSync(abs)) {
      unlinkSync(abs);
    }
    await this.db.delete(trashedImages).where(eq(trashedImages.id, trashId));
    broadcastPurge(trashId);
  }

  async emptyTrash(): Promise<{ count: number }> {
    const all = await this.db.select().from(trashedImages).all();
    for (const item of all) {
      const abs = resolve(this.outputDir, item.trashPath);
      if (abs.startsWith(resolve(this.outputDir)) && existsSync(abs)) {
        unlinkSync(abs);
      }
    }
    await this.db.delete(trashedImages).run();
    broadcastEmpty();
    return { count: all.length };
  }

  async listTrash(page: number, pageSize: number): Promise<TrashListResult> {
    const total = (await this.db.select({ c: sql<number>`count(*)` }).from(trashedImages))[0]?.c ?? 0;
    const offset = (page - 1) * pageSize;
    const rows = await this.db
      .select({
        id: trashedImages.id,
        originalRelativePath: trashedImages.originalRelativePath,
        rating: trashedImages.rating,
        flag: trashedImages.flag,
        colorLabel: trashedImages.colorLabel,
        width: trashedImages.width,
        height: trashedImages.height,
        aspectRatio: trashedImages.aspectRatio,
        fileFormat: trashedImages.fileFormat,
        deletedAt: trashedImages.deletedAt,
      })
      .from(trashedImages)
      .orderBy(desc(trashedImages.deletedAt))
      .limit(pageSize)
      .offset(offset);
    return { items: rows as TrashListItem[], total };
  }

  async count(): Promise<number> {
    const row = (await this.db.select({ c: sql<number>`count(*)` }).from(trashedImages))[0];
    return row?.c ?? 0;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/__tests__/trash-service.test.ts`
Expected: PASS — all tests pass.

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/trash-service.ts src/lib/server/__tests__/trash-service.test.ts
git commit -m "feat: add TrashService for soft-delete, restore, purge, and list"
```

---

### Task 5: Delete endpoint soft-deletes via TrashService

**Files:**
- Modify: `src/routes/api/comfyui/delete/+server.ts`

The endpoint already enforces protection (from the deletion-protection plan). Now it moves files to trash instead of unlinking.

- [ ] **Step 1: Replace the delete loop body**

In `src/routes/api/comfyui/delete/+server.ts`, replace the `for` loop that does `unlinkSync` + DB deletes with a `TrashService` call. The full updated file:

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { findProtectedPaths } from "$lib/server/deletion-guard";
import { TrashService } from "$lib/server/trash-service";
import { getOutputDir } from "$lib/server/comfyui-browser";

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { relative_paths } = body as { relative_paths?: string[] };

  if (!Array.isArray(relative_paths) || relative_paths.length === 0) {
    return json(
      { error: "relative_paths (string[]) is required" },
      { status: 400 },
    );
  }

  const protectedPaths = await findProtectedPaths(db, relative_paths);
  if (protectedPaths.length > 0) {
    return json({ error: "protected", protected: protectedPaths }, { status: 409 });
  }

  const outputDir = await getOutputDir();
  if (!outputDir) {
    return json({ error: "Output directory not configured" }, { status: 500 });
  }
  const trash = new TrashService(db, outputDir);

  let trashed = 0;
  for (const relativePath of relative_paths) {
    try {
      await trash.softDeleteToTrash(relativePath);
      trashed++;
    } catch (e: any) {
      return json({ error: `Failed to trash: ${e.message}` }, { status: 500 });
    }
  }

  return json({ success: true, trashed });
};
```

- [ ] **Step 2: Update the frontend toast wording**

In `src/routes/generations/+page.svelte`, the `confirmDelete` success branch (from the deletion-protection plan) currently reads `已删除 ${body.deleted} 张图片`. The response key changed from `deleted` to `trashed`. Update:

Find:
```typescript
    const body = await res.json();
    showToast(`已删除 ${body.deleted} 张图片`, "success");
```

Replace with:
```typescript
    const body = await res.json();
    showToast(`已移入回收站 ${body.trashed} 张图片`, "success");
```

- [ ] **Step 3: Type-check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 4: Manual verification**

`npm run dev`. Select a non-curated image, delete it. Confirm:
- It disappears from the gallery.
- The file now exists at `<outputDir>/.trash/1/<name>`.
- A row exists in `trashed_images` (`sqlite3 ladymuse.db "SELECT id, original_relative_path FROM trashed_images"`).

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/comfyui/delete/+server.ts src/routes/generations/+page.svelte
git commit -m "feat: soft-delete images to recycle bin instead of hard-deleting"
```

---

### Task 6: Trash list / restore / purge / empty endpoints

**Files:**
- Create: `src/routes/api/comfyui/trash/+server.ts`
- Create: `src/routes/api/comfyui/trash/restore/+server.ts`
- Create: `src/routes/api/comfyui/trash/purge/+server.ts`
- Create: `src/routes/api/comfyui/trash/empty/+server.ts`

- [ ] **Step 1: Create the list endpoint**

Create `src/routes/api/comfyui/trash/+server.ts`:

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { TrashService } from "$lib/server/trash-service";
import { getOutputDir } from "$lib/server/comfyui-browser";

export const GET: RequestHandler = async ({ url }) => {
  const outputDir = await getOutputDir();
  if (!outputDir) return json({ error: "Not configured" }, { status: 500 });
  const trash = new TrashService(db, outputDir);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "50");
  const result = await trash.listTrash(page, pageSize);
  return json(result);
};
```

- [ ] **Step 2: Create the restore endpoint**

Create `src/routes/api/comfyui/trash/restore/+server.ts`:

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { TrashService } from "$lib/server/trash-service";
import { getOutputDir } from "$lib/server/comfyui-browser";

export const POST: RequestHandler = async ({ request }) => {
  const { id } = await request.json();
  if (typeof id !== "number") {
    return json({ error: "id (number) is required" }, { status: 400 });
  }
  const outputDir = await getOutputDir();
  if (!outputDir) return json({ error: "Not configured" }, { status: 500 });
  const trash = new TrashService(db, outputDir);
  try {
    const result = await trash.restoreFromTrash(id);
    return json(result);
  } catch (e: any) {
    return json({ error: e.message }, { status: 404 });
  }
};
```

- [ ] **Step 3: Create the purge endpoint**

Create `src/routes/api/comfyui/trash/purge/+server.ts`:

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { TrashService } from "$lib/server/trash-service";
import { getOutputDir } from "$lib/server/comfyui-browser";

export const POST: RequestHandler = async ({ request }) => {
  const { id } = await request.json();
  if (typeof id !== "number") {
    return json({ error: "id (number) is required" }, { status: 400 });
  }
  const outputDir = await getOutputDir();
  if (!outputDir) return json({ error: "Not configured" }, { status: 500 });
  const trash = new TrashService(db, outputDir);
  await trash.purgeTrashItem(id);
  return json({ success: true });
};
```

- [ ] **Step 4: Create the empty endpoint**

Create `src/routes/api/comfyui/trash/empty/+server.ts`:

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { TrashService } from "$lib/server/trash-service";
import { getOutputDir } from "$lib/server/comfyui-browser";

export const POST: RequestHandler = async () => {
  const outputDir = await getOutputDir();
  if (!outputDir) return json({ error: "Not configured" }, { status: 500 });
  const trash = new TrashService(db, outputDir);
  const { count } = await trash.emptyTrash();
  return json({ success: true, purged: count });
};
```

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 6: Manual verification**

With a trashed item from Task 5 present:

```bash
# List
curl -s 'http://localhost:5173/api/comfyui/trash?page=1&pageSize=50' | head
# Restore
curl -s http://localhost:5173/api/comfyui/trash/restore -H 'Content-Type: application/json' -d '{"id":1}'
# Confirm file is back at original path and gone from .trash
```

- [ ] **Step 7: Commit**

```bash
git add src/routes/api/comfyui/trash/
git commit -m "feat: add trash list, restore, purge, and empty endpoints"
```

---

### Task 7: Frontend store — events, viewMode, trashCount, trash list

**Files:**
- Modify: `src/lib/stores/gallery-store.svelte.ts` — `FileEvent` type, `handleSSEEvent`, new state + actions.

- [ ] **Step 1: Extend the client `FileEvent` type**

In `src/lib/stores/gallery-store.svelte.ts`, find the client-side type (~line 138):

```typescript
export interface FileEvent {
  type: "add" | "delete" | "modify";
  path: string;
}
```

Replace with a discriminated union mirroring the server:

```typescript
export type FileEvent =
  | { type: "add" | "delete" | "modify"; path: string }
  | { type: "trash"; path: string; trashId: number }
  | { type: "restore"; path: string; renamed: boolean }
  | { type: "purge"; trashId: number }
  | { type: "empty" };
```

- [ ] **Step 2: Add trash state**

Near the other `let` state declarations (around `activeImage` at line 179), add:

```typescript
  let viewMode = $state<"gallery" | "trash">("gallery");
  let trashCount = $state(0);
  let trashImages = $state<TrashListItem[]>([]);
  let trashPagination = $state({ page: 1, pageSize: 50, total: 0 });
```

And add an **exported** interface at module scope (top-level, outside the factory function, next to wherever `ImageResult` is declared) so `TrashView.svelte` can import it:

```typescript
export interface TrashListItem {
  id: number;
  originalRelativePath: string;
  rating: number;
  flag: string | null;
  colorLabel: string | null;
  width: number | null;
  height: number | null;
  aspectRatio: string | null;
  fileFormat: string | null;
  deletedAt: string;
}
```

- [ ] **Step 3: Add trash data-loading functions**

Add these functions inside the store factory (near `loadPage`):

```typescript
  async function loadTrashCount() {
    try {
      const res = await fetch("/api/comfyui/trash?page=1&pageSize=1");
      if (res.ok) {
        const body = await res.json();
        trashCount = body.total ?? 0;
      }
    } catch {
      // ignore — count is cosmetic
    }
  }

  async function loadTrashPage(page = 1) {
    const res = await fetch(
      `/api/comfyui/trash?page=${page}&pageSize=${trashPagination.pageSize}`,
    );
    if (res.ok) {
      const body = await res.json();
      trashImages = body.items ?? [];
      trashPagination = { ...trashPagination, page, total: body.total ?? 0 };
      trashCount = body.total ?? 0;
    }
  }

  function setViewMode(mode: "gallery" | "trash") {
    viewMode = mode;
    if (mode === "trash") loadTrashPage(1);
  }
```

Call `loadTrashCount()` once during store initialization (after the existing initial load).

- [ ] **Step 4: Extend `handleSSEEvent`**

Replace the existing `handleSSEEvent` (lines ~410-426) with:

```typescript
  function handleSSEEvent(event: FileEvent) {
    if (event.type === "delete") {
      images = images.filter((img) => img.relativePath !== event.path);
      _removeSelection(event.path);
      if (activeImage?.relativePath === event.path) {
        activeImage = images[0] ?? null;
      }
      pagination.total = Math.max(0, pagination.total - 1);
    } else if (event.type === "trash") {
      // Soft-delete: identical gallery removal, plus a trash-count bump.
      images = images.filter((img) => img.relativePath !== event.path);
      _removeSelection(event.path);
      if (activeImage?.relativePath === event.path) {
        activeImage = images[0] ?? null;
      }
      pagination.total = Math.max(0, pagination.total - 1);
      trashCount += 1;
      if (viewMode === "trash") loadTrashPage(trashPagination.page);
    } else if (event.type === "restore") {
      trashCount = Math.max(0, trashCount - 1);
      if (viewMode === "gallery") {
        if (_refreshTimer) clearTimeout(_refreshTimer);
        _refreshTimer = setTimeout(() => {
          _refreshTimer = null;
          untrack(() => loadPage());
        }, 500);
      }
      if (viewMode === "trash") loadTrashPage(trashPagination.page);
    } else if (event.type === "purge") {
      trashCount = Math.max(0, trashCount - 1);
      if (viewMode === "trash") loadTrashPage(trashPagination.page);
    } else if (event.type === "empty") {
      trashCount = 0;
      trashImages = [];
      trashPagination = { ...trashPagination, total: 0 };
    } else {
      // add / modify: debounce into a single reload
      if (_refreshTimer) clearTimeout(_refreshTimer);
      _refreshTimer = setTimeout(() => {
        _refreshTimer = null;
        untrack(() => loadPage());
      }, 500);
    }
  }
```

- [ ] **Step 5: Expose new state and actions in the returned object**

Find the store's `return { ... }` (near the end of the factory) and add:

```typescript
    viewMode,
    trashCount,
    trashImages,
    trashPagination,
    setViewMode,
    loadTrashPage,
    loadTrashCount,
```

- [ ] **Step 6: Type-check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/stores/gallery-store.svelte.ts
git commit -m "feat: add trash view state and SSE handling to gallery store"
```

---

### Task 8: Trash entry button + TrashView component

**Files:**
- Modify: `src/lib/components/gallery/GalleryToolbar.svelte` — trash button + count.
- Create: `src/lib/components/gallery/TrashView.svelte` — grid with restore/purge/empty.
- Modify: `src/lib/components/gallery/LibraryView.svelte` — render `TrashView` when `viewMode === "trash"`.
- Modify: `src/routes/generations/+page.svelte` — wire restore/purge/empty + restore-rename toast.

- [ ] **Step 1: Add a trash button to the toolbar**

In `src/lib/components/gallery/GalleryToolbar.svelte`, add props and a button. In the props destructure (top of `<script>`), add `onopentrash` and `trashCount`:

```typescript
  let {
    viewMode,
    searchQuery,
    sortOption,
    totalImages,
    trashCount = 0,
    onviewmodechange,
    onsearchchange,
    onsortchange,
    onrefresh,
    onopentrash,
  }: {
    // ...existing prop types...
    trashCount?: number;
    onopentrash?: () => void;
  } = $props();
```

In the right-actions block (~line 120-147), insert a trash button before the Refresh button:

```svelte
  <!-- Right actions -->
  <div class="ml-auto flex items-center gap-2">
    <!-- Trash -->
    <button
      onclick={() => onopentrash?.()}
      class="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-600 hover:text-amber-300 transition-colors flex items-center gap-1"
      title="回收站"
    >
      回收站
      {#if trashCount > 0}
        <span class="rounded-full bg-amber-500/20 px-1.5 text-[10px] text-amber-300">
          {trashCount}
        </span>
      {/if}
    </button>

    <!-- Image count -->
    <span class="text-xs text-zinc-500">{totalImages} 张图片</span>
    <!-- Refresh button (unchanged) -->
```

- [ ] **Step 2: Create `TrashView.svelte`**

Create `src/lib/components/gallery/TrashView.svelte`:

```svelte
<script lang="ts">
  import type { TrashListItem } from "$lib/stores/gallery-store.svelte";

  let {
    items = [],
    onrestore,
    onpurge,
    onempty,
    onback,
  }: {
    items: TrashListItem[];
    onrestore: (id: number) => void;
    onpurge: (id: number) => void;
    onempty: () => void;
    onback: () => void;
  } = $props();

  let confirmEmpty = $state(false);
</script>

<div class="flex h-full flex-col gap-3 p-4">
  <div class="flex items-center gap-3">
    <button
      onclick={onback}
      class="rounded border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:text-zinc-100"
    >
      ← 返回图库
    </button>
    <h2 class="text-sm font-medium text-zinc-200">回收站 ({items.length})</h2>
    <div class="ml-auto">
      {#if confirmEmpty}
        <span class="mr-2 text-xs text-red-400">确认清空？此操作不可撤销</span>
        <button
          onclick={() => {
            onempty();
            confirmEmpty = false;
          }}
          class="mr-1 rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20"
        >确认清空</button
        >
        <button
          onclick={() => (confirmEmpty = false)}
          class="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400"
        >取消</button
        >
      {:else}
        <button
          onclick={() => (confirmEmpty = true)}
          class="rounded border border-red-500/20 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10"
          disabled={items.length === 0}
        >清空回收站</button
        >
      {/if}
    </div>
  </div>

  {#if items.length === 0}
    <div class="flex flex-1 items-center justify-center text-sm text-zinc-600">
      回收站为空
    </div>
  {:else}
    <div class="grid flex-1 content-start gap-3 overflow-y-auto"
      style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));">
      {#each items as item (item.id)}
        <div class="group relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
          <img
            src="/api/comfyui/images/{encodeURIComponent('.trash/' + item.id + '/' + item.originalRelativePath.split('/').pop())}"
            alt=""
            class="aspect-square w-full object-cover opacity-60"
            loading="lazy"
          />
          <div class="p-2">
            <div class="truncate text-xs text-zinc-300" title={item.originalRelativePath}>
              {item.originalRelativePath.split("/").pop()}
            </div>
            <div class="text-[10px] text-zinc-600">
              {new Date(item.deletedAt).toLocaleString()}
            </div>
          </div>
          <div class="flex gap-1 p-2 pt-0">
            <button
              onclick={() => onrestore(item.id)}
              class="flex-1 rounded border border-emerald-500/20 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/10"
            >恢复</button
            >
            <button
              onclick={() => onpurge(item.id)}
              class="flex-1 rounded border border-red-500/20 px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/10"
            >彻底删除</button
            >
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
```

The thumbnail URL points at the file's location inside `.trash/<id>/`. The existing image-serving route's `resolveImagePath` permits this because `.trash/...` resolves under `outputDir` and contains no `..`.

- [ ] **Step 3: Render `TrashView` from `LibraryView`**

In `src/lib/components/gallery/LibraryView.svelte`, import `TrashView` and render it when `store.viewMode === "trash"`. Add to the `<script>` imports:

```typescript
  import TrashView from "./TrashView.svelte";
```

Wrap the existing gallery grid in a conditional and add the trash view. Find where the grid/`VirtualGrid` is rendered and change the top-level structure to:

```svelte
{#if store.viewMode === "trash"}
  <TrashView
    items={store.trashImages}
    onrestore={(id) => ontrashaction("restore", id)}
    onpurge={(id) => ontrashaction("purge", id)}
    onempty={() => ontrashaction("empty")}
    onback={() => store.setViewMode("gallery")}
  />
{:else}
  <!-- existing gallery grid markup unchanged -->
{/if}
```

If `LibraryView` does not already forward callbacks up to the page, add an `ontrashaction` prop of type `(action: "restore" | "purge" | "empty", id?: number) => void` and pass it through from the page.

- [ ] **Step 4: Wire trash actions in the page**

In `src/routes/generations/+page.svelte`, pass the new toolbar prop and a trash-action handler.

First, find where `GalleryToolbar` is rendered inside `LibraryView` (or on the page) and add `trashCount` + `onopentrash`:

```svelte
  <GalleryToolbar
    viewMode={store.viewMode}
    searchQuery={store.filters.text?.positivePrompt ?? ""}
    sortOption={store.sortOrder}
    totalImages={store.pagination.total}
    trashCount={store.trashCount}
    onviewmodechange={handleViewModeChange}
    onsearchchange={handleSearchChange}
    onsortchange={handleSortChange}
    onrefresh={() => store.refresh()}
    onopentrash={() => store.setViewMode("trash")}
  />
```

Then add a trash-action handler in the `<script>`:

```typescript
  async function handleTrashAction(
    action: "restore" | "purge" | "empty",
    id?: number,
  ) {
    if (action === "restore" && id != null) {
      const res = await fetch("/api/comfyui/trash/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        const body = await res.json();
        if (body.renamed) {
          showToast(`已恢复为 ${body.restoredPath.split("/").pop()}（原路径被占用）`, "info");
        } else {
          showToast("已恢复", "success");
        }
      }
    } else if (action === "purge" && id != null) {
      const res = await fetch("/api/comfyui/trash/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) showToast("已彻底删除", "success");
    } else if (action === "empty") {
      const res = await fetch("/api/comfyui/trash/empty", { method: "POST" });
      if (res.ok) {
        const body = await res.json();
        showToast(`已清空 ${body.purged} 项`, "success");
      }
    }
  }
```

Pass `ontrashaction={handleTrashAction}` through to `LibraryView` (and confirm `LibraryView` forwards it to `TrashView`).

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 6: Manual end-to-end verification**

`npm run dev`. Walk through the full flow:
1. Delete a non-curated image → it leaves the gallery, trash count increments.
2. Click the trash button → `TrashView` shows the item with its thumbnail.
3. Click 恢复 → item returns to the gallery (and to disk at the original path); trash count decrements.
4. Delete again, then 彻底删除 → file gone from `.trash`, row gone from `trashed_images`.
5. Delete two items, click 清空回收站 → all gone, count zero.
6. Restore-rename: delete `a.png`, create a new file at the same path on disk (`touch`/copy), then restore the trashed one → it returns as `a_restored_<ts>.png` and the toast reports the rename.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/gallery/GalleryToolbar.svelte \
        src/lib/components/gallery/TrashView.svelte \
        src/lib/components/gallery/LibraryView.svelte \
        src/routes/generations/+page.svelte
git commit -m "feat: add recycle bin UI with restore, purge, and empty-trash"
```
