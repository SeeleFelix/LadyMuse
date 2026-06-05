import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync, writeFileSync, utimesSync } from "node:fs";
import { randomBytes } from "node:crypto";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";
import {
  createTestPng,
  cleanupTestDir,
  SAMPLE_PROMPT_JSON,
} from "./metadata-extractor-fixtures";

// Test directory setup
let testDir: string;
let testDb: Database.Database;
let testDbClient: ReturnType<typeof drizzle>;

function createTestDir(): string {
  const randomId = randomBytes(8).toString("hex");
  const dir = `/tmp/test-file-sync-${randomId}`;
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupTestDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

// Mock the db module with a factory that returns our test db client
vi.mock("../db", () => ({
  db: vi.fn(),
}));

// Import FileSyncService after mocking is set up
import { FileSyncService } from "../file-sync-service";

beforeEach(async () => {
  // Create test directory
  testDir = createTestDir();

  // Create in-memory test database
  testDb = new Database(":memory:");
  testDb.pragma("journal_mode = WAL");
  testDb.pragma("foreign_keys = ON");

  // Create schema
  testDb.exec(`
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
      cfg_scale REAL DEFAULT 0,
      seed TEXT,
      width INTEGER,
      height INTEGER,
      aspect_ratio TEXT,
      file_size INTEGER,
      file_format TEXT,
      color_space TEXT,
      has_alpha INTEGER DEFAULT 0,
      file_modified_at TEXT,
      is_missing INTEGER DEFAULT 0
    );
  `);

  testDbClient = drizzle(testDb, { schema });

  // Get the mocked db module and set it to return our test db client
  const dbModule = await import("../db");
  vi.spyOn(dbModule, "db", "get").mockReturnValue(testDbClient as any);
});

afterEach(() => {
  // Clean up test directory
  if (testDir) {
    cleanupTestDir(testDir);
  }

  // Close test database
  if (testDb) {
    testDb.close();
  }
});

describe("FileSyncService", () => {
  describe("broadcast and subscribe", () => {
    it("broadcast - subscribers receive events", () => {
      const service = new FileSyncService(testDir);

      const events: Array<{ type: string; path: string }> = [];
      const unsubscribe = service.subscribe((event) => {
        events.push(event);
      });

      service.broadcast({ type: "add", path: "test.png" });

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: "add", path: "test.png" });

      unsubscribe();
    });

    it("subscribe - multiple subscribers all receive events", () => {
      const service = new FileSyncService(testDir);

      const events1: Array<{ type: string; path: string }> = [];
      const events2: Array<{ type: string; path: string }> = [];

      service.subscribe((event) => events1.push(event));
      service.subscribe((event) => events2.push(event));

      service.broadcast({ type: "delete", path: "gone.png" });

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
      expect(events1[0]).toEqual({ type: "delete", path: "gone.png" });
      expect(events2[0]).toEqual({ type: "delete", path: "gone.png" });
    });

    it("subscribe - unsubscribe removes subscriber", () => {
      const service = new FileSyncService(testDir);

      const events: Array<{ type: string; path: string }> = [];
      const unsubscribe = service.subscribe((event) => events.push(event));

      unsubscribe();

      service.broadcast({ type: "add", path: "test.png" });

      expect(events).toHaveLength(0);
    });
  });

  describe("debounce", () => {
    it("debounce - rapid handleFileAdded calls result in single broadcast", async () => {
      const service = new FileSyncService(testDir, { debounceMs: 100 });

      const events: Array<{ type: string; path: string }> = [];
      service.subscribe((event) => events.push(event));

      // Create test file
      const filePath = join(testDir, "rapid.png");
      createTestPng(filePath);

      // Rapidly call handleFileAdded multiple times for the same file
      // In production, chokidar might emit multiple events for the same file
      for (let i = 0; i < 5; i++) {
        // @ts-expect-error - accessing private method for test
        service.handleFileAdded(filePath);
      }

      // Wait for debounce to complete (100ms debounce + small buffer)
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should only have ONE "add" event, not 5
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: "add", path: "rapid.png" });
    });

    it("debounce - different files are tracked separately", async () => {
      const service = new FileSyncService(testDir, { debounceMs: 100 });

      const events: Array<{ type: string; path: string }> = [];
      service.subscribe((event) => events.push(event));

      // Create two different files
      const file1 = join(testDir, "file1.png");
      const file2 = join(testDir, "file2.png");
      createTestPng(file1);
      createTestPng(file2);

      // Rapidly call for both files
      for (let i = 0; i < 3; i++) {
        // @ts-expect-error - accessing private method for test
        service.handleFileAdded(file1);
        // @ts-expect-error - accessing private method for test
        service.handleFileAdded(file2);
      }

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should have exactly 2 events (one per file)
      expect(events).toHaveLength(2);

      const paths = events.map((e) => e.path).sort();
      expect(paths).toEqual(["file1.png", "file2.png"]);
    });

    it("debounce - handleFileChanged also debounces", async () => {
      const service = new FileSyncService(testDir, { debounceMs: 100 });

      const events: Array<{ type: string; path: string }> = [];
      service.subscribe((event) => events.push(event));

      // Create test file and add it to DB first
      const filePath = join(testDir, "modify.png");
      createTestPng(filePath);

      // Insert into DB so handleFileChanged processes it
      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "modify.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileSize: 1000,
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      // Rapidly call handleFileChanged multiple times
      // Add a tiny bit of spacing to simulate rapid but not instantaneous events
      for (let i = 0; i < 4; i++) {
        // @ts-expect-error - accessing private method for test
        service.handleFileChanged(filePath);
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      // Wait for debounce (longer since we added delays)
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should only have ONE "modify" event (debounced from 4 calls)
      const modifyEvents = events.filter((e) => e.type === "modify");
      expect(modifyEvents).toHaveLength(1);
      expect(modifyEvents[0]).toEqual({ type: "modify", path: "modify.png" });
    });

    it("debounce - handleFileDeleted also debounces", async () => {
      const service = new FileSyncService(testDir, { debounceMs: 100 });

      const events: Array<{ type: string; path: string }> = [];
      service.subscribe((event) => events.push(event));

      // Insert record for a "deleted" file
      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "deleted.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileSize: 1000,
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filePath = join(testDir, "deleted.png");

      // Rapidly call handleFileDeleted multiple times
      for (let i = 0; i < 3; i++) {
        // @ts-expect-error - accessing private method for test
        service.handleFileDeleted(filePath);
      }

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should only have ONE "delete" event
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: "delete", path: "deleted.png" });
    });
  });

  describe("handleFileAdded", () => {
    it("handleFileAdded - creates database record with metadata", async () => {
      const service = new FileSyncService(testDir);

      // Create test PNG with metadata
      const filePath = join(testDir, "new-image.png");
      createTestPng(filePath, {
        width: 1024,
        height: 1536,
        textChunks: [{ keyword: "prompt", text: SAMPLE_PROMPT_JSON }],
      });

      // @ts-expect-error - calling private method for test
      service.handleFileAdded(filePath);

      // Wait for debounce to complete
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Verify record was created
      const records = await testDbClient
        .select()
        .from(schema.imageAttributes)
        .where(eq(schema.imageAttributes.relativePath, "new-image.png"));

      expect(records).toHaveLength(1);
      const record = records[0];

      expect(record.relativePath).toBe("new-image.png");
      expect(record.width).toBe(1024);
      expect(record.height).toBe(1536);
      expect(record.aspectRatio).toBe("portrait");
      expect(record.fileFormat).toBe("PNG");
      expect(record.isMissing).toBe(false);
      expect(record.extractedModels).toContain("anima-xl.safetensors");
      expect(record.extractedLoras).toContain("detail_enhancer.safetensors");
      expect(record.extractedSamplers).toContain("dpmpp_2m");
      expect(record.extractedSchedulers).toContain("karras");
      expect(record.steps).toBe(30);
      expect(record.cfgScale).toBe(7.0);
      expect(record.seed).toBe("1234567890");
    });

    it("handleFileAdded - ignores unsupported formats", async () => {
      const service = new FileSyncService(testDir);

      // Create a non-image file
      const filePath = join(testDir, "document.txt");
      writeFileSync(filePath, "not an image");

      // @ts-expect-error - calling private method for test
      await service.handleFileAdded(filePath);

      // Verify no record was created
      const records = await testDbClient
        .select()
        .from(schema.imageAttributes)
        .where(eq(schema.imageAttributes.relativePath, "document.txt"));

      expect(records).toHaveLength(0);
    });

    it("handleFileAdded - ignores files starting with underscore", async () => {
      const service = new FileSyncService(testDir);

      // Create file starting with underscore
      const filePath = join(testDir, "_hidden.png");
      createTestPng(filePath);

      // @ts-expect-error - calling private method for test
      await service.handleFileAdded(filePath);

      // Verify no record was created
      const records = await testDbClient
        .select()
        .from(schema.imageAttributes)
        .where(eq(schema.imageAttributes.relativePath, "_hidden.png"));

      expect(records).toHaveLength(0);
    });

    it("handleFileAdded - broadcasts add event", async () => {
      const service = new FileSyncService(testDir);

      const events: Array<{ type: string; path: string }> = [];
      service.subscribe((event) => events.push(event));

      // Create test file
      const filePath = join(testDir, "broadcast-test.png");
      createTestPng(filePath);

      // @ts-expect-error - calling private method for test
      await service.handleFileAdded(filePath);

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 600));

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: "add", path: "broadcast-test.png" });
    });
  });

  describe("handleFileChanged", () => {
    it("handleFileChanged - updates metadata for existing file", async () => {
      const service = new FileSyncService(testDir);

      // Create initial file
      const filePath = join(testDir, "modify-test.png");
      createTestPng(filePath, { width: 512, height: 512 });

      // Insert initial record
      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "modify-test.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileSize: 1000,
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      // Wait a bit to ensure different mtime
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Modify file (update mtime)
      const newTime = new Date();
      utimesSync(filePath, newTime, newTime);

      // @ts-expect-error - calling private method for test
      await service.handleFileChanged(filePath);

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 600));

      const records = await testDbClient
        .select()
        .from(schema.imageAttributes)
        .where(eq(schema.imageAttributes.relativePath, "modify-test.png"));

      expect(records).toHaveLength(1);
      const record = records[0];
      expect(record.width).toBe(512);
      expect(record.height).toBe(512);
      expect(record.aspectRatio).toBe("square");
      expect(record.isMissing).toBe(false);
    });

    it("handleFileChanged - broadcasts modify event", async () => {
      const service = new FileSyncService(testDir);

      const events: Array<{ type: string; path: string }> = [];
      service.subscribe((event) => events.push(event));

      // Create test file and add it first (so it exists in DB)
      const filePath = join(testDir, "modify-broadcast.png");
      createTestPng(filePath);

      // @ts-expect-error - calling private method for test
      service.handleFileAdded(filePath);

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Clear the add event
      events.length = 0;

      // Now trigger change event
      // @ts-expect-error - calling private method for test
      service.handleFileChanged(filePath);

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 600));

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: "modify",
        path: "modify-broadcast.png",
      });
    });
  });

  describe("handleFileDeleted", () => {
    it("handleFileDeleted - marks isMissing = true", async () => {
      const service = new FileSyncService(testDir);

      // Create a record for a file
      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "deleted-file.png",
        width: 1024,
        height: 768,
        aspectRatio: "landscape",
        fileFormat: "PNG",
        fileSize: 5000,
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      // @ts-expect-error - calling private method for test
      await service.handleFileDeleted(join(testDir, "deleted-file.png"));

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 600));

      const records = await testDbClient
        .select()
        .from(schema.imageAttributes)
        .where(eq(schema.imageAttributes.relativePath, "deleted-file.png"));

      expect(records).toHaveLength(1);
      expect(records[0].isMissing).toBe(true);
    });

    it("handleFileDeleted - broadcasts delete event", async () => {
      const service = new FileSyncService(testDir);

      const events: Array<{ type: string; path: string }> = [];
      service.subscribe((event) => events.push(event));

      // @ts-expect-error - calling private method for test
      await service.handleFileDeleted(join(testDir, "gone.png"));

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 600));

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: "delete", path: "gone.png" });
    });
  });

  describe("reconcileOnStartup", () => {
    it("reconcileOnStartup - creates records for files on disk", async () => {
      const service = new FileSyncService(testDir);

      // Create test files
      createTestPng(join(testDir, "file1.png"), {
        width: 1920,
        height: 1080,
      });
      createTestPng(join(testDir, "file2.png"), {
        width: 512,
        height: 512,
      });

      // @ts-expect-error - calling private method for test
      await service.reconcileOnStartup();

      // Wait for upserts to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const allRecords = await testDbClient
        .select()
        .from(schema.imageAttributes)
        .orderBy(schema.imageAttributes.relativePath);

      expect(allRecords).toHaveLength(2);
      expect(allRecords[0].relativePath).toBe("file1.png");
      expect(allRecords[0].isMissing).toBe(false);
      expect(allRecords[1].relativePath).toBe("file2.png");
      expect(allRecords[1].isMissing).toBe(false);
    });

    it("reconcileOnStartup - marks missing files as isMissing = true", async () => {
      const service = new FileSyncService(testDir);

      // Insert a record for a file that doesn't exist on disk
      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "ghost.png",
        width: 800,
        height: 600,
        aspectRatio: "landscape",
        fileFormat: "PNG",
        fileSize: 3000,
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      // Create a file that does exist
      createTestPng(join(testDir, "real.png"));

      // @ts-expect-error - calling private method for test
      await service.reconcileOnStartup();

      // Wait for operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const ghostRecord = await testDbClient
        .select()
        .from(schema.imageAttributes)
        .where(eq(schema.imageAttributes.relativePath, "ghost.png"));

      expect(ghostRecord).toHaveLength(1);
      expect(ghostRecord[0].isMissing).toBe(true);

      const realRecord = await testDbClient
        .select()
        .from(schema.imageAttributes)
        .where(eq(schema.imageAttributes.relativePath, "real.png"));

      expect(realRecord).toHaveLength(1);
      expect(realRecord[0].isMissing).toBe(false);
    });

    it("reconcileOnStartup - handles subdirectories", async () => {
      const service = new FileSyncService(testDir);

      // Create subdirectory
      const subdir = join(testDir, "subfolder");
      mkdirSync(subdir, { recursive: true });

      // Create files in subdirectory
      createTestPng(join(subdir, "nested.png"), { width: 800, height: 600 });

      // @ts-expect-error - calling private method for test
      await service.reconcileOnStartup();

      // Wait for operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const records = await testDbClient
        .select()
        .from(schema.imageAttributes)
        .where(eq(schema.imageAttributes.relativePath, "subfolder/nested.png"));

      expect(records).toHaveLength(1);
      expect(records[0].isMissing).toBe(false);
    });

    it("reconcileOnStartup - ignores underscore-prefixed files", async () => {
      const service = new FileSyncService(testDir);

      // Create normal file
      createTestPng(join(testDir, "normal.png"));

      // Create underscore file
      createTestPng(join(testDir, "_hidden.png"));

      // @ts-expect-error - calling private method for test
      await service.reconcileOnStartup();

      // Wait for operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const allRecords = await testDbClient
        .select()
        .from(schema.imageAttributes);

      expect(allRecords).toHaveLength(1);
      expect(allRecords[0].relativePath).toBe("normal.png");
    });
  });

  describe("runPeriodicValidation", () => {
    it("runPeriodicValidation - marks stale missing files", async () => {
      const service = new FileSyncService(testDir);

      // Insert a record for a file with old mtime (5+ minutes ago)
      const oldTime = new Date(Date.now() - 6 * 60 * 1000).toISOString();
      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "stale-missing.png",
        width: 1024,
        height: 768,
        aspectRatio: "landscape",
        fileFormat: "PNG",
        fileSize: 4000,
        fileModifiedAt: oldTime,
        isMissing: false,
      });

      // @ts-expect-error - calling private method for test
      await service.runPeriodicValidation();

      // Wait for operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const records = await testDbClient
        .select()
        .from(schema.imageAttributes)
        .where(eq(schema.imageAttributes.relativePath, "stale-missing.png"));

      expect(records).toHaveLength(1);
      expect(records[0].isMissing).toBe(true);
    });

    it("runPeriodicValidation - skips recently modified files", async () => {
      const service = new FileSyncService(testDir);

      // Insert a record for a file with recent mtime (within 5 minutes)
      const recentTime = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "recent.png",
        width: 1024,
        height: 768,
        aspectRatio: "landscape",
        fileFormat: "PNG",
        fileSize: 4000,
        fileModifiedAt: recentTime,
        isMissing: false,
      });

      // @ts-expect-error - calling private method for test
      await service.runPeriodicValidation();

      // Wait for operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const records = await testDbClient
        .select()
        .from(schema.imageAttributes)
        .where(eq(schema.imageAttributes.relativePath, "recent.png"));

      expect(records).toHaveLength(1);
      // Should not be marked as missing since it's within the check window
      expect(records[0].isMissing).toBe(false);
    });
  });
});
