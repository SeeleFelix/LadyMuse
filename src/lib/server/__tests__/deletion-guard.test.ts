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
    const result = await findProtectedPaths(testDb, [
      "plain.png",
      "rejected.png",
    ]);
    expect(result).toEqual([]);
  });

  it("flags paths with pick flag", async () => {
    await testDb
      .insert(imageAttributes)
      .values([{ relativePath: "picked.png", rating: 0, flag: "pick" }]);
    const result = await findProtectedPaths(testDb, ["picked.png"]);
    expect(result).toEqual([{ relativePath: "picked.png", reason: "pick" }]);
  });

  it("flags paths with rating > 0", async () => {
    await testDb
      .insert(imageAttributes)
      .values([{ relativePath: "rated.png", rating: 4, flag: null }]);
    const result = await findProtectedPaths(testDb, ["rated.png"]);
    expect(result).toEqual([{ relativePath: "rated.png", reason: "rating" }]);
  });

  it("ignores paths not present in the database", async () => {
    await testDb
      .insert(imageAttributes)
      .values([{ relativePath: "rated.png", rating: 3, flag: null }]);
    const result = await findProtectedPaths(testDb, ["rated.png", "ghost.png"]);
    expect(result).toEqual([{ relativePath: "rated.png", reason: "rating" }]);
  });
});
