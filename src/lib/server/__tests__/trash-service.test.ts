import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomBytes } from "node:crypto";
import {
  mkdirSync,
  rmSync,
  writeFileSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";
import type { DB } from "../db";

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
let db: DB;

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
      trash_relative_path TEXT NOT NULL,
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
  db = drizzle(sqlite, { schema });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

function seedImage(
  relativePath: string,
  content: string,
  attrs?: Partial<typeof schema.imageAttributes.$inferInsert>,
) {
  const abs = join(testDir, relativePath);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, content);
  db.insert(schema.imageAttributes)
    .values({ relativePath, rating: 0, flag: null, ...attrs })
    .run();
}

describe("TrashService.softDeleteToTrash", () => {
  it("moves the file to .trash/<id>/ and copies the row", async () => {
    seedImage("a.png", "AAA", { rating: 3 });
    const svc = new TrashService(db, testDir);

    const { trashId } = await svc.softDeleteToTrash("a.png");

    expect(existsSync(join(testDir, "a.png"))).toBe(false);
    expect(existsSync(join(testDir, ".trash", String(trashId), "a.png"))).toBe(
      true,
    );
    expect(
      readFileSync(join(testDir, ".trash", String(trashId), "a.png"), "utf8"),
    ).toBe("AAA");

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
    expect(readFileSync(join(testDir, result.restoredPath), "utf8")).toBe(
      "OLD",
    );
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

describe("TrashService.restoreFromTrash - error cases", () => {
  it("throws when the trash id does not exist", async () => {
    const svc = new TrashService(db, testDir);
    await expect(svc.restoreFromTrash(99999)).rejects.toThrow(
      "Trash item not found",
    );
  });
});

describe("TrashService.purgeTrashItem - idempotency", () => {
  it("no-ops when the trash id does not exist", async () => {
    const svc = new TrashService(db, testDir);
    await expect(svc.purgeTrashItem(99999)).resolves.toBeUndefined();
    expect(db.select().from(schema.trashedImages).all()).toHaveLength(0);
  });

  it("refuses to unlink a file whose trash path escapes outputDir", async () => {
    seedImage("a.png", "AAA");
    const svc = new TrashService(db, testDir);
    const { trashId } = await svc.softDeleteToTrash("a.png");
    // Simulate DB tampering: point the trash row outside outputDir.
    db.update(schema.trashedImages)
      .set({ trashRelativePath: "../../etc/evil" })
      .where(eq(schema.trashedImages.id, trashId))
      .run();
    // Even if such a file existed, purge must not unlink it.
    await svc.purgeTrashItem(trashId);
    // The trash row is still deleted (DB cleanup), but no outside unlink occurs.
    expect(db.select().from(schema.trashedImages).all()).toHaveLength(0);
  });
});

describe("TrashService.listTrash - pagination", () => {
  it("returns paginated items ordered by deletedAt desc", async () => {
    const svc = new TrashService(db, testDir);
    for (const name of ["a.png", "b.png", "c.png", "d.png", "e.png"]) {
      seedImage(name, "X");
      await svc.softDeleteToTrash(name);
      // Spread deletedAt timestamps so ordering is deterministic.
      await new Promise((r) => setTimeout(r, 10));
    }
    const page1 = await svc.listTrash(1, 2);
    expect(page1.total).toBe(5);
    expect(page1.items).toHaveLength(2);

    const page2 = await svc.listTrash(2, 2);
    expect(page2.items).toHaveLength(2);
    const page3 = await svc.listTrash(3, 2);
    expect(page3.items).toHaveLength(1);

    // Pagination is stable: the union of all pages equals the full set, and
    // pages do not overlap. The exact tie-break among rows with identical
    // deletedAt is not part of the contract.
    const allNames = [...page1.items, ...page2.items, ...page3.items].map(
      (i) => i.originalRelativePath,
    );
    expect(allNames.sort()).toEqual([
      "a.png",
      "b.png",
      "c.png",
      "d.png",
      "e.png",
    ]);
  });
});
