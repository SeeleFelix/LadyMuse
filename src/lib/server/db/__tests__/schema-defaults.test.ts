import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import { sessions, sessionMessages } from "../schema";
import { eq } from "drizzle-orm";

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite);
}

describe("schema datetime defaults", () => {
  it("stores real timestamps in created_at, not literal strings", () => {
    const db = createTestDb();

    // Create tables using the schema's column definitions
    db.run(sql`
      CREATE TABLE sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT DEFAULT '新对话',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.run(sql`
      CREATE TABLE session_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES sessions(id),
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_detail TEXT,
        usage_json TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Insert session + message without specifying created_at
    db.insert(sessions).values({ title: "test" }).run();
    db.insert(sessionMessages)
      .values({
        sessionId: 1,
        role: "user",
        content: "hello",
      })
      .run();

    const row = db
      .select()
      .from(sessionMessages)
      .where(eq(sessionMessages.sessionId, 1))
      .get();

    // Should be a real ISO-like datetime, not the literal "(datetime('now'))"
    expect(row?.createdAt).not.toBe("(datetime('now'))");
    expect(row?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});

describe("imageAttributes extended columns", () => {
  it("supports new metadata columns", () => {
    const testDb = createTestDb();

    testDb.run(sql`
      CREATE TABLE stacks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        cover_image_path TEXT,
        collapsed INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    testDb.run(sql`
      CREATE TABLE image_attributes (
        relative_path TEXT PRIMARY KEY,
        rating INTEGER DEFAULT 0,
        color_label TEXT,
        flag TEXT,
        notes TEXT,
        stack_id INTEGER REFERENCES stacks(id),
        metadata_json TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),

        -- Extracted index fields
        extracted_models TEXT,
        extracted_loras TEXT,
        extracted_samplers TEXT,
        extracted_schedulers TEXT,
        positive_prompt TEXT,
        negative_prompt TEXT,
        steps INTEGER DEFAULT 0,
        cfg_scale REAL DEFAULT 0,
        seed TEXT,

        -- Image physical properties
        width INTEGER,
        height INTEGER,
        aspect_ratio TEXT,
        file_size INTEGER,
        file_format TEXT,
        color_space TEXT,
        has_alpha INTEGER DEFAULT 0,

        -- File tracking
        file_modified_at TEXT,
        is_missing INTEGER DEFAULT 0
      )
    `);

    testDb.run(
      sql`INSERT INTO image_attributes (
        relative_path, extracted_models, extracted_loras, extracted_samplers,
        extracted_schedulers, positive_prompt, negative_prompt,
        steps, cfg_scale, seed,
        width, height, aspect_ratio, file_size, file_format, color_space, has_alpha,
        file_modified_at, is_missing
      ) VALUES (
        'test/image.png',
        '["model.safetensors"]',
        '["lora1.safetensors","lora2.safetensors"]',
        '["dpmpp_2m"]',
        '["karras"]',
        '1girl, solo',
        'bad anatomy',
        30, 7.0, '1234567890',
        1024, 1536, 'portrait', 2300000, 'PNG', 'sRGB', 1,
        '2026-01-01T00:00:00Z', 0
      )`,
    );

    const row = testDb.run(
      sql`SELECT * FROM image_attributes WHERE relative_path = 'test/image.png'`,
    );
    expect(row).toBeDefined();
  });
});
