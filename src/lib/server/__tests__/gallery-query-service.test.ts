import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { randomBytes } from "node:crypto";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema";
import {
  createTestPng,
  cleanupTestDir,
  SAMPLE_PROMPT_JSON,
} from "./metadata-extractor-fixtures";
import { upsertImageMetadata } from "../metadata-extractor";
import type { SortOption } from "../gallery-query-types";

// Test directory setup
let testDir: string;
let testDb: Database.Database;
let testDbClient: ReturnType<typeof drizzle>;

function createTestDir(): string {
  const randomId = randomBytes(8).toString("hex");
  const dir = `/tmp/test-gallery-query-${randomId}`;
  mkdirSync(dir, { recursive: true });
  return dir;
}

// Mock the db module with a factory that returns our test db client
vi.mock("../db", () => ({
  db: vi.fn(),
}));

// Import GalleryQueryService after mocking is set up
import { GalleryQueryService } from "../gallery-query-service";
import type { FilterCriteria } from "../gallery-query-types";

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

    CREATE TABLE tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE
    );

    CREATE TABLE image_tags (
      relative_path TEXT NOT NULL,
      tag_id INTEGER NOT NULL
    );

    CREATE TABLE collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      cover_image_path TEXT,
      is_smart INTEGER DEFAULT 0,
      smart_criteria TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE collection_images (
      collection_id INTEGER NOT NULL,
      relative_path TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      added_at TEXT DEFAULT (datetime('now'))
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

describe("GalleryQueryService", () => {
  describe("Basic query", () => {
    it("basic query - no filters, default sort, returns images", async () => {
      const service = new GalleryQueryService();

      // Create test images
      createTestPng(join(testDir, "image1.png"), {
        width: 1024,
        height: 1536,
        textChunks: [{ keyword: "prompt", text: SAMPLE_PROMPT_JSON }],
      });
      createTestPng(join(testDir, "image2.png"), {
        width: 512,
        height: 512,
      });
      createTestPng(join(testDir, "image3.png"), {
        width: 1920,
        height: 1080,
      });

      // Insert metadata into DB
      await upsertImageMetadata("image1.png", join(testDir, "image1.png"));
      await upsertImageMetadata("image2.png", join(testDir, "image2.png"));
      await upsertImageMetadata("image3.png", join(testDir, "image3.png"));

      // Query without filters
      const result = await service.query();

      expect(result.images).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(false);
      expect(result.hasLess).toBe(false);
      // Default sort is created_at desc, but all have same timestamp so sort by path desc
      const paths = result.images.map((i) => i.relativePath).sort();
      expect(paths).toEqual(["image1.png", "image2.png", "image3.png"]);
    });

    it("basic query - returns image with all expected fields", async () => {
      const service = new GalleryQueryService();

      // Create test image
      const filePath = join(testDir, "detailed.png");
      createTestPng(filePath, {
        width: 1024,
        height: 1536,
        textChunks: [{ keyword: "prompt", text: SAMPLE_PROMPT_JSON }],
      });

      await upsertImageMetadata("detailed.png", filePath);

      const result = await service.query();
      const image = result.images[0];

      // Verify all expected fields are present
      expect(image.relativePath).toBe("detailed.png");
      expect(image.width).toBe(1024);
      expect(image.height).toBe(1536);
      expect(image.aspectRatio).toBe("portrait");
      expect(image.fileFormat).toBe("PNG");
      expect(image.extractedModels).toContain("anima-xl.safetensors");
      expect(image.extractedLoras).toContain("detail_enhancer.safetensors");
      expect(image.extractedSamplers).toContain("dpmpp_2m");
      expect(image.extractedSchedulers).toContain("karras");
      expect(image.steps).toBe(30);
      expect(image.cfgScale).toBe(7.0);
      expect(image.seed).toBe("1234567890");
      expect(image.positivePrompt).toContain("1girl");
      expect(image.negativePrompt).toContain("bad anatomy");
      expect(image.isMissing).toBe(false);
    });
  });

  describe("Generation params filter", () => {
    it("generation params - filter by models", async () => {
      const service = new GalleryQueryService();

      // Create images with different models
      const model1Json = JSON.stringify({
        "1": {
          class_type: "CheckpointLoaderSimple",
          inputs: { ckpt_name: "model-a.safetensors" },
        },
      });
      const model2Json = JSON.stringify({
        "1": {
          class_type: "CheckpointLoaderSimple",
          inputs: { ckpt_name: "model-b.safetensors" },
        },
      });

      createTestPng(join(testDir, "model-a.png"), {
        textChunks: [{ keyword: "prompt", text: model1Json }],
      });
      createTestPng(join(testDir, "model-b.png"), {
        textChunks: [{ keyword: "prompt", text: model2Json }],
      });

      await upsertImageMetadata("model-a.png", join(testDir, "model-a.png"));
      await upsertImageMetadata("model-b.png", join(testDir, "model-b.png"));

      const filters: FilterCriteria = {
        generation: { models: ["model-a.safetensors"] },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("model-a.png");
      expect(result.total).toBe(1);
    });

    it("generation params - filter by loras", async () => {
      const service = new GalleryQueryService();

      const lora1Json = JSON.stringify({
        "5": {
          class_type: "LoraLoader",
          inputs: { lora_name: "style-a.safetensors" },
        },
      });
      const lora2Json = JSON.stringify({
        "5": {
          class_type: "LoraLoader",
          inputs: { lora_name: "style-b.safetensors" },
        },
      });

      createTestPng(join(testDir, "with-lora-a.png"), {
        textChunks: [{ keyword: "prompt", text: lora1Json }],
      });
      createTestPng(join(testDir, "with-lora-b.png"), {
        textChunks: [{ keyword: "prompt", text: lora2Json }],
      });

      await upsertImageMetadata(
        "with-lora-a.png",
        join(testDir, "with-lora-a.png"),
      );
      await upsertImageMetadata(
        "with-lora-b.png",
        join(testDir, "with-lora-b.png"),
      );

      const filters: FilterCriteria = {
        generation: { loras: ["style-a.safetensors"] },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("with-lora-a.png");
    });

    it("generation params - filter by steps range", async () => {
      const service = new GalleryQueryService();

      // Insert records with different steps directly
      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "20steps.png",
        steps: 20,
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "40steps.png",
        steps: 40,
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        generation: { stepsMin: 25, stepsMax: 35 },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(0);
      expect(result.total).toBe(0);

      // Should include 40steps when range is 25-50
      const filters2: FilterCriteria = {
        generation: { stepsMin: 25, stepsMax: 50 },
      };
      const result2 = await service.query(filters2);

      expect(result2.images).toHaveLength(1);
      expect(result2.images[0].relativePath).toBe("40steps.png");
    });

    it("generation params - filter by CFG scale range", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "cfg5.png",
        cfgScale: 5.5,
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "cfg9.png",
        cfgScale: 9.5,
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        generation: { cfgMin: 7.0, cfgMax: 8.0 },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(0);

      const filters2: FilterCriteria = {
        generation: { cfgMin: 5.0, cfgMax: 10.0 },
      };
      const result2 = await service.query(filters2);

      expect(result2.images).toHaveLength(2);
    });

    it("generation params - filter by seed", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "seed-a.png",
        seed: "1234567890",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "seed-b.png",
        seed: "0987654321",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        generation: { seed: "1234567890" },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("seed-a.png");
    });

    it("generation params - filter by samplers", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "euler.png",
        extractedSamplers: JSON.stringify(["euler"]),
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "dpmpp.png",
        extractedSamplers: JSON.stringify(["dpmpp_2m"]),
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        generation: { samplers: ["euler"] },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("euler.png");
    });

    it("generation params - filter by schedulers", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "karras.png",
        extractedSchedulers: JSON.stringify(["karras"]),
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "normal.png",
        extractedSchedulers: JSON.stringify(["normal"]),
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        generation: { schedulers: ["karras"] },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("karras.png");
    });
  });

  describe("User marks filter", () => {
    it("user marks - filter by rating range", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "rated5.png",
        rating: 5,
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "rated3.png",
        rating: 3,
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "rated1.png",
        rating: 1,
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        user: { ratingMin: 4, ratingMax: 5 },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("rated5.png");
    });

    it("user marks - filter by color labels", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "red.png",
        colorLabel: "red",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "blue.png",
        colorLabel: "blue",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "nocolor.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        user: { colorLabels: ["red", "blue"] },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(2);
      const paths = result.images.map((i) => i.relativePath).sort();
      expect(paths).toEqual(["blue.png", "red.png"]);
    });

    it("user marks - filter by flags", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "favorite.png",
        flag: "favorite",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "rejected.png",
        flag: "reject",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        user: { flags: ["favorite"] },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("favorite.png");
    });

    it("user marks - filter by hasFlag", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "flagged.png",
        flag: "pick",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "unflagged.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      // Has flag
      const filters1: FilterCriteria = {
        user: { hasFlag: true },
      };
      const result1 = await service.query(filters1);
      expect(result1.images).toHaveLength(1);
      expect(result1.images[0].relativePath).toBe("flagged.png");

      // No flag
      const filters2: FilterCriteria = {
        user: { hasFlag: false },
      };
      const result2 = await service.query(filters2);
      expect(result2.images).toHaveLength(1);
      expect(result2.images[0].relativePath).toBe("unflagged.png");
    });

    it("user marks - filter by notes contains", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "portrait.png",
        notes: "Great lighting, good composition",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "landscape.png",
        notes: "Needs work",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        user: { notesContains: "lighting" },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("portrait.png");
    });

    it("user marks - filter by tagIds", async () => {
      const service = new GalleryQueryService();

      // Create tags
      await testDbClient.insert(schema.tags).values({
        id: 1,
        name: "portrait",
        slug: "portrait",
      });
      await testDbClient.insert(schema.tags).values({
        id: 2,
        name: "landscape",
        slug: "landscape",
      });
      await testDbClient.insert(schema.tags).values({
        id: 3,
        name: "nature",
        slug: "nature",
      });

      // Create images
      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "img1.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });
      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "img2.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });
      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "img3.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      // Tag images
      await testDbClient.insert(schema.imageTags).values({
        relativePath: "img1.png",
        tagId: 1,
      });
      await testDbClient.insert(schema.imageTags).values({
        relativePath: "img1.png",
        tagId: 3,
      });
      await testDbClient.insert(schema.imageTags).values({
        relativePath: "img2.png",
        tagId: 2,
      });

      const filters: FilterCriteria = {
        user: { tagIds: [1, 3] },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("img1.png");
      // Verify tags are populated
      expect(result.images[0].tags).toHaveLength(2);
      expect(result.images[0].tags.map((t) => t.name).sort()).toEqual([
        "nature",
        "portrait",
      ]);
    });

    it("user marks - filter by hasTags", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.tags).values({
        id: 1,
        name: "tagged",
        slug: "tagged",
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "has-tags.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });
      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "no-tags.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageTags).values({
        relativePath: "has-tags.png",
        tagId: 1,
      });

      // Has tags
      const filters1: FilterCriteria = {
        user: { hasTags: true },
      };
      const result1 = await service.query(filters1);
      expect(result1.images).toHaveLength(1);
      expect(result1.images[0].relativePath).toBe("has-tags.png");

      // No tags
      const filters2: FilterCriteria = {
        user: { hasTags: false },
      };
      const result2 = await service.query(filters2);
      expect(result2.images).toHaveLength(1);
      expect(result2.images[0].relativePath).toBe("no-tags.png");
    });
  });

  describe("Text search filter", () => {
    it("text search - filter by positive prompt", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "cat.png",
        positivePrompt: "a cute cat, fluffy fur",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "dog.png",
        positivePrompt: "a playful dog, running",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        text: { positivePrompt: "cat" },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("cat.png");
    });

    it("text search - filter by negative prompt", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "clean.png",
        negativePrompt: "blurry, low quality",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "other.png",
        negativePrompt: "watermark, text",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        text: { negativePrompt: "blurry" },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("clean.png");
    });

    it("text search - filter by both positive and negative prompts", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "match.png",
        positivePrompt: "beautiful landscape",
        negativePrompt: "blurry, low quality",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "partial.png",
        positivePrompt: "beautiful landscape",
        negativePrompt: "watermark",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "nomatch.png",
        positivePrompt: "portrait",
        negativePrompt: "blurry, low quality",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        text: {
          positivePrompt: "landscape",
          negativePrompt: "blurry",
        },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("match.png");
    });
  });

  describe("Time filter", () => {
    it("time filter - filter by createdAfter", async () => {
      const service = new GalleryQueryService();

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "today.png",
        createdAt: now.toISOString(),
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: now.toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "yesterday.png",
        createdAt: yesterday.toISOString(),
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: yesterday.toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "old.png",
        createdAt: twoDaysAgo.toISOString(),
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: twoDaysAgo.toISOString(),
        isMissing: false,
      });

      const cutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12 hours ago
      const filters: FilterCriteria = {
        time: { createdAfter: cutoff.toISOString() },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("today.png");
    });

    it("time filter - filter by createdBefore", async () => {
      const service = new GalleryQueryService();

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "today.png",
        createdAt: now.toISOString(),
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: now.toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "yesterday.png",
        createdAt: yesterday.toISOString(),
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: yesterday.toISOString(),
        isMissing: false,
      });

      const cutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12 hours ago
      const filters: FilterCriteria = {
        time: { createdBefore: cutoff.toISOString() },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("yesterday.png");
    });

    it("time filter - filter by date range", async () => {
      const service = new GalleryQueryService();

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "today.png",
        createdAt: now.toISOString(),
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: now.toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "yesterday.png",
        createdAt: yesterday.toISOString(),
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: yesterday.toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "old.png",
        createdAt: twoDaysAgo.toISOString(),
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: twoDaysAgo.toISOString(),
        isMissing: false,
      });

      const start = new Date(now.getTime() - 36 * 60 * 60 * 1000); // 36 hours ago
      const end = new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6 hours ago
      const filters: FilterCriteria = {
        time: {
          createdAfter: start.toISOString(),
          createdBefore: end.toISOString(),
        },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("yesterday.png");
    });

    it("time filter - filter by modifiedAfter/modifiedBefore", async () => {
      const service = new GalleryQueryService();

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "recent-mod.png",
        updatedAt: now.toISOString(),
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: now.toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "old-mod.png",
        updatedAt: yesterday.toISOString(),
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: yesterday.toISOString(),
        isMissing: false,
      });

      const cutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      const filters: FilterCriteria = {
        time: { modifiedAfter: cutoff.toISOString() },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("recent-mod.png");
    });
  });

  describe("Folder filter", () => {
    it("folder filter - filter by path prefix", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "portraits/beautiful.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "portraits/cute.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "landscenes/mountain.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        folder: { pathPrefix: "portraits/" },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(2);
      const paths = result.images.map((i) => i.relativePath).sort();
      expect(paths).toEqual(["portraits/beautiful.png", "portraits/cute.png"]);
    });

    it("folder filter - exclude specific paths", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "good/image1.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "good/image2.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "bad/image1.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        folder: {
          pathPrefix: "good/",
          excludePaths: ["good/image2.png"],
        },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("good/image1.png");
    });
  });

  describe("Properties filter", () => {
    it("properties - filter by dimensions", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "small.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "large.png",
        width: 2048,
        height: 2048,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "medium.png",
        width: 1024,
        height: 1024,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        properties: { widthMin: 800, widthMax: 1500 },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("medium.png");
    });

    it("properties - filter by aspect ratio", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "portrait.png",
        width: 1024,
        height: 1536,
        aspectRatio: "2:3",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "landscape.png",
        width: 1920,
        height: 1080,
        aspectRatio: "16:9",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "square.png",
        width: 1024,
        height: 1024,
        aspectRatio: "1:1",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      // Portrait
      const filters1: FilterCriteria = {
        properties: { aspectRatios: ["portrait"] },
      };
      const result1 = await service.query(filters1);
      expect(result1.images).toHaveLength(1);
      expect(result1.images[0].relativePath).toBe("portrait.png");

      // Landscape
      const filters2: FilterCriteria = {
        properties: { aspectRatios: ["landscape"] },
      };
      const result2 = await service.query(filters2);
      expect(result2.images).toHaveLength(1);
      expect(result2.images[0].relativePath).toBe("landscape.png");

      // Square
      const filters3: FilterCriteria = {
        properties: { aspectRatios: ["square"] },
      };
      const result3 = await service.query(filters3);
      expect(result3.images).toHaveLength(1);
      expect(result3.images[0].relativePath).toBe("square.png");
    });

    it("properties - filter by file format", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "image.png",
        fileFormat: "PNG",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "image.jpg",
        fileFormat: "JPG",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "image.webp",
        fileFormat: "WebP",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        properties: { fileFormats: ["PNG", "JPG"] },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(2);
      const paths = result.images.map((i) => i.relativePath).sort();
      expect(paths).toEqual(["image.jpg", "image.png"]);
    });

    it("properties - filter by file size range", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "small.png",
        fileSize: 100_000,
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "large.png",
        fileSize: 5_000_000,
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "medium.png",
        fileSize: 1_000_000,
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        properties: { fileSizeMin: 500_000, fileSizeMax: 2_000_000 },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("medium.png");
    });

    it("properties - filter by hasAlpha", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "with-alpha.png",
        hasAlpha: true,
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "no-alpha.png",
        hasAlpha: false,
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "null-alpha.png",
        hasAlpha: null,
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      // Has alpha
      const filters1: FilterCriteria = {
        properties: { hasAlpha: true },
      };
      const result1 = await service.query(filters1);
      expect(result1.images).toHaveLength(1);
      expect(result1.images[0].relativePath).toBe("with-alpha.png");

      // No alpha (includes false and null)
      const filters2: FilterCriteria = {
        properties: { hasAlpha: false },
      };
      const result2 = await service.query(filters2);
      expect(result2.images).toHaveLength(2);
    });

    it("properties - filter by isMissing", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "missing.png",
        isMissing: true,
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "present.png",
        isMissing: false,
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
      });

      // Show only missing
      const filters1: FilterCriteria = {
        properties: { isMissing: true },
      };
      const result1 = await service.query(filters1);
      expect(result1.images).toHaveLength(1);
      expect(result1.images[0].relativePath).toBe("missing.png");

      // Show only present
      const filters2: FilterCriteria = {
        properties: { isMissing: false },
      };
      const result2 = await service.query(filters2);
      expect(result2.images).toHaveLength(1);
      expect(result2.images[0].relativePath).toBe("present.png");
    });

    it("properties - default excludes missing files", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "missing.png",
        isMissing: true,
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "present.png",
        isMissing: false,
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
      });

      // Without any filter, should exclude missing files by default
      const result = await service.query();

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("present.png");
    });
  });

  describe("Sort options", () => {
    beforeEach(async () => {
      // Create test data for sorting tests
      const now = new Date();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "z-last.png",
        createdAt: new Date(now.getTime() - 1000).toISOString(),
        width: 1920,
        height: 1080,
        aspectRatio: "16:9",
        fileSize: 3_000_000,
        fileFormat: "PNG",
        fileModifiedAt: now.toISOString(),
        isMissing: false,
        rating: 3,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "a-first.png",
        createdAt: new Date(now.getTime() - 3000).toISOString(),
        width: 512,
        height: 512,
        aspectRatio: "1:1",
        fileSize: 500_000,
        fileFormat: "PNG",
        fileModifiedAt: now.toISOString(),
        isMissing: false,
        rating: 5,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "m-middle.png",
        createdAt: new Date(now.getTime() - 2000).toISOString(),
        width: 1024,
        height: 768,
        aspectRatio: "4:3",
        fileSize: 1_500_000,
        fileFormat: "PNG",
        fileModifiedAt: now.toISOString(),
        isMissing: false,
        rating: 4,
      });
    });

    it("sort - by created_at ascending", async () => {
      const service = new GalleryQueryService();

      const sort: SortOption = { field: "created_at", direction: "asc" };
      const result = await service.query(undefined, sort);

      expect(result.images).toHaveLength(3);
      expect(result.images[0].relativePath).toBe("a-first.png"); // Oldest
      expect(result.images[2].relativePath).toBe("z-last.png"); // Newest
    });

    it("sort - by created_at descending (default)", async () => {
      const service = new GalleryQueryService();

      const sort: SortOption = { field: "created_at", direction: "desc" };
      const result = await service.query(undefined, sort);

      expect(result.images).toHaveLength(3);
      expect(result.images[0].relativePath).toBe("z-last.png"); // Newest
      expect(result.images[2].relativePath).toBe("a-first.png"); // Oldest
    });

    it("sort - by rating ascending", async () => {
      const service = new GalleryQueryService();

      const sort: SortOption = { field: "rating", direction: "asc" };
      const result = await service.query(undefined, sort);

      expect(result.images).toHaveLength(3);
      expect(result.images[0].relativePath).toBe("z-last.png"); // Rating 3
      expect(result.images[1].relativePath).toBe("m-middle.png"); // Rating 4
      expect(result.images[2].relativePath).toBe("a-first.png"); // Rating 5
    });

    it("sort - by rating descending", async () => {
      const service = new GalleryQueryService();

      const sort: SortOption = { field: "rating", direction: "desc" };
      const result = await service.query(undefined, sort);

      expect(result.images).toHaveLength(3);
      expect(result.images[0].relativePath).toBe("a-first.png"); // Rating 5
      expect(result.images[2].relativePath).toBe("z-last.png"); // Rating 3
    });

    it("sort - by file_size ascending", async () => {
      const service = new GalleryQueryService();

      const sort: SortOption = { field: "file_size", direction: "asc" };
      const result = await service.query(undefined, sort);

      expect(result.images).toHaveLength(3);
      expect(result.images[0].relativePath).toBe("a-first.png"); // 500KB
      expect(result.images[1].relativePath).toBe("m-middle.png"); // 1.5MB
      expect(result.images[2].relativePath).toBe("z-last.png"); // 3MB
    });

    it("sort - by width descending", async () => {
      const service = new GalleryQueryService();

      const sort: SortOption = { field: "width", direction: "desc" };
      const result = await service.query(undefined, sort);

      expect(result.images).toHaveLength(3);
      expect(result.images[0].relativePath).toBe("z-last.png"); // 1920
      expect(result.images[1].relativePath).toBe("m-middle.png"); // 1024
      expect(result.images[2].relativePath).toBe("a-first.png"); // 512
    });

    it("sort - by height ascending", async () => {
      const service = new GalleryQueryService();

      const sort: SortOption = { field: "height", direction: "asc" };
      const result = await service.query(undefined, sort);

      expect(result.images).toHaveLength(3);
      expect(result.images[0].relativePath).toBe("a-first.png"); // 512
      expect(result.images[1].relativePath).toBe("m-middle.png"); // 768
      expect(result.images[2].relativePath).toBe("z-last.png"); // 1080
    });

    it("sort - by filename ascending", async () => {
      const service = new GalleryQueryService();

      const sort: SortOption = { field: "filename", direction: "asc" };
      const result = await service.query(undefined, sort);

      expect(result.images).toHaveLength(3);
      expect(result.images[0].relativePath).toBe("a-first.png");
      expect(result.images[1].relativePath).toBe("m-middle.png");
      expect(result.images[2].relativePath).toBe("z-last.png");
    });

    it("sort - by filename descending", async () => {
      const service = new GalleryQueryService();

      const sort: SortOption = { field: "filename", direction: "desc" };
      const result = await service.query(undefined, sort);

      expect(result.images).toHaveLength(3);
      expect(result.images[0].relativePath).toBe("z-last.png");
      expect(result.images[1].relativePath).toBe("m-middle.png");
      expect(result.images[2].relativePath).toBe("a-first.png");
    });
  });

  describe("Cursor pagination", () => {
    beforeEach(async () => {
      // Create 25 images for pagination testing
      const now = new Date();
      const baseTime = now.getTime();

      for (let i = 1; i <= 25; i++) {
        const createdAt = new Date(baseTime - i * 1000).toISOString();
        await testDbClient.insert(schema.imageAttributes).values({
          relativePath: `image-${String(i).padStart(2, "0")}.png`,
          createdAt,
          width: 512,
          height: 512,
          aspectRatio: "square",
          fileFormat: "PNG",
          fileModifiedAt: createdAt,
          isMissing: false,
        });
      }
    });

    it("pagination - next page with cursor", async () => {
      const service = new GalleryQueryService();

      // First page with pageSize 10
      const page1 = await service.query(undefined, undefined, { pageSize: 10 });

      expect(page1.images).toHaveLength(10);
      expect(page1.total).toBe(25);
      expect(page1.hasMore).toBe(true);
      expect(page1.hasLess).toBe(false);
      expect(page1.nextCursor).not.toBeNull();
      expect(page1.prevCursor).toBeNull();

      // Second page using nextCursor
      const page2 = await service.query(undefined, undefined, {
        pageSize: 10,
        cursor: page1.nextCursor!,
        direction: "next",
      });

      expect(page2.images).toHaveLength(10);
      // Total reflects items matching cursor condition (remaining items)
      expect(page2.total).toBeLessThan(25);
      expect(page2.total).toBeGreaterThan(10);
      expect(page2.hasMore).toBe(true);
      expect(page2.hasLess).toBe(true);
      expect(page2.nextCursor).not.toBeNull();
      expect(page2.prevCursor).not.toBeNull();

      // Verify images are different
      const page1Paths = new Set(page1.images.map((i) => i.relativePath));
      const page2Paths = new Set(page2.images.map((i) => i.relativePath));
      const intersection = [...page1Paths].filter((x) => page2Paths.has(x));
      expect(intersection).toHaveLength(0);
    });

    it("pagination - previous page with cursor", async () => {
      const service = new GalleryQueryService();

      // Get first page
      const page1 = await service.query(undefined, undefined, { pageSize: 10 });

      // Get second page
      const page2 = await service.query(undefined, undefined, {
        pageSize: 10,
        cursor: page1.nextCursor!,
        direction: "next",
      });

      // Go back to first page using prevCursor
      const page1Again = await service.query(undefined, undefined, {
        pageSize: 10,
        cursor: page2.prevCursor!,
        direction: "prev",
      });

      expect(page1Again.images).toHaveLength(10);
      expect(page1Again.images.map((i) => i.relativePath)).toEqual(
        page1.images.map((i) => i.relativePath),
      );
      // hasLess is true when using cursor (we came from page2)
      expect(page1Again.hasLess).toBe(true);
      // hasMore is false because there are no more pages in the "prev" direction
      // (we've reached the start)
      expect(page1Again.hasMore).toBe(false);
    });

    it("pagination - last page", async () => {
      const service = new GalleryQueryService();

      let currentPage = await service.query(undefined, undefined, {
        pageSize: 10,
      });
      let pageCount = 1;

      while (currentPage.hasMore) {
        currentPage = await service.query(undefined, undefined, {
          pageSize: 10,
          cursor: currentPage.nextCursor!,
          direction: "next",
        });
        pageCount++;
      }

      expect(pageCount).toBe(3);
      expect(currentPage.images).toHaveLength(5); // Last partial page
      expect(currentPage.hasMore).toBe(false);
      expect(currentPage.hasLess).toBe(true);
      expect(currentPage.nextCursor).toBeNull();
    });

    it("pagination - hasMore/hasLess flags", async () => {
      const service = new GalleryQueryService();

      // First page
      const page1 = await service.query(undefined, undefined, { pageSize: 10 });
      expect(page1.hasMore).toBe(true);
      expect(page1.hasLess).toBe(false);

      // Middle page
      const page2 = await service.query(undefined, undefined, {
        pageSize: 10,
        cursor: page1.nextCursor!,
        direction: "next",
      });
      expect(page2.hasMore).toBe(true);
      expect(page2.hasLess).toBe(true);

      // Last page
      const page3 = await service.query(undefined, undefined, {
        pageSize: 10,
        cursor: page2.nextCursor!,
        direction: "next",
      });
      expect(page3.hasMore).toBe(false);
      expect(page3.hasLess).toBe(true);
    });

    it("pagination - pageSize limit", async () => {
      const service = new GalleryQueryService();

      // Request more than max page size (200)
      const result = await service.query(undefined, undefined, {
        pageSize: 300,
      });

      // Should be limited to 200
      expect(result.images).toHaveLength(25); // Only 25 images exist
      expect(result.pageSize).toBe(200);
    });

    it("pagination - cursor structure", async () => {
      const service = new GalleryQueryService();

      const page = await service.query(undefined, undefined, { pageSize: 5 });

      expect(page.nextCursor).toBeDefined();
      expect(page.nextCursor?.field).toBe("created_at");
      expect(page.nextCursor?.direction).toBe("desc");
      expect(page.nextCursor?.path).toBeDefined();
      expect(page.nextCursor?.value).toBeDefined();
    });
  });

  describe("JSON array queries", () => {
    it("json array - models filter uses json_each", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "multi-model.png",
        extractedModels: JSON.stringify([
          "model-a.safetensors",
          "model-b.safetensors",
        ]),
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "single-model.png",
        extractedModels: JSON.stringify(["model-a.safetensors"]),
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "other-model.png",
        extractedModels: JSON.stringify(["model-c.safetensors"]),
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        generation: { models: ["model-a.safetensors"] },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(2);
      const paths = result.images.map((i) => i.relativePath).sort();
      expect(paths).toEqual(["multi-model.png", "single-model.png"]);
    });

    it("json array - loras filter uses json_each", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "multi-lora.png",
        extractedLoras: JSON.stringify([
          "style-a.safetensors",
          "style-b.safetensors",
        ]),
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "single-lora.png",
        extractedLoras: JSON.stringify(["style-b.safetensors"]),
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        generation: { loras: ["style-b.safetensors"] },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(2);
      const paths = result.images.map((i) => i.relativePath).sort();
      expect(paths).toEqual(["multi-lora.png", "single-lora.png"]);
    });

    it("json array - samplers filter uses json_each", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "multi-sampler.png",
        extractedSamplers: JSON.stringify(["euler", "dpmpp_2m"]),
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "other-sampler.png",
        extractedSamplers: JSON.stringify(["ddim"]),
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        generation: { samplers: ["dpmpp_2m"] },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("multi-sampler.png");
    });

    it("json array - schedulers filter uses json_each", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "karras-sched.png",
        extractedSchedulers: JSON.stringify(["karras", "normal"]),
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        generation: { schedulers: ["karras"] },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("karras-sched.png");
    });
  });

  describe("Empty result", () => {
    it("empty result - no images in database", async () => {
      const service = new GalleryQueryService();

      const result = await service.query();

      expect(result.images).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
      expect(result.hasLess).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(result.prevCursor).toBeNull();
    });

    it("empty result - no matches for filter", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "some.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        generation: { models: ["nonexistent-model.safetensors"] },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("empty result - all images filtered out", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "present.png",
        isMissing: false,
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "missing.png",
        isMissing: true,
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
      });

      // Filter for missing files only (excludes present.png)
      const filters: FilterCriteria = {
        properties: { isMissing: true },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("missing.png");
    });
  });

  describe("Combined filters", () => {
    it("combined - generation and user marks filters", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "match-all.png",
        extractedModels: JSON.stringify(["good-model.safetensors"]),
        rating: 5,
        colorLabel: "red",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "match-model.png",
        extractedModels: JSON.stringify(["good-model.safetensors"]),
        rating: 3,
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "match-rating.png",
        rating: 5,
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        generation: { models: ["good-model.safetensors"] },
        user: { ratingMin: 4 },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("match-all.png");
    });

    it("combined - text and time filters", async () => {
      const service = new GalleryQueryService();

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "recent-portrait.png",
        createdAt: now.toISOString(),
        positivePrompt: "beautiful portrait",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: now.toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "old-portrait.png",
        createdAt: yesterday.toISOString(),
        positivePrompt: "beautiful portrait",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: yesterday.toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "recent-landscape.png",
        createdAt: now.toISOString(),
        positivePrompt: "landscape view",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: now.toISOString(),
        isMissing: false,
      });

      const cutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      const filters: FilterCriteria = {
        text: { positivePrompt: "portrait" },
        time: { createdAfter: cutoff.toISOString() },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("recent-portrait.png");
    });

    it("combined - folder and properties filters", async () => {
      const service = new GalleryQueryService();

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "folder1/small.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "folder1/large.png",
        width: 2048,
        height: 2048,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "folder2/small.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        folder: { pathPrefix: "folder1/" },
        properties: { widthMin: 1000 },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("folder1/large.png");
    });

    it("combined - multiple filter dimensions", async () => {
      const service = new GalleryQueryService();

      const now = new Date();

      // Create multiple images with different attributes
      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "perfect-match.png",
        createdAt: now.toISOString(),
        extractedModels: JSON.stringify(["anima-xl.safetensors"]),
        rating: 5,
        colorLabel: "green",
        positivePrompt: "masterpiece",
        width: 1024,
        height: 1536,
        aspectRatio: "2:3",
        fileFormat: "PNG",
        fileModifiedAt: now.toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "partial-match.png",
        createdAt: now.toISOString(),
        extractedModels: JSON.stringify(["anima-xl.safetensors"]),
        rating: 3,
        colorLabel: "green",
        positivePrompt: "masterpiece",
        width: 1024,
        height: 768,
        aspectRatio: "4:3",
        fileFormat: "PNG",
        fileModifiedAt: now.toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "no-match.png",
        createdAt: now.toISOString(),
        extractedModels: JSON.stringify(["other-model.safetensors"]),
        rating: 5,
        colorLabel: "green",
        positivePrompt: "masterpiece",
        width: 1024,
        height: 1536,
        aspectRatio: "2:3",
        fileFormat: "PNG",
        fileModifiedAt: now.toISOString(),
        isMissing: false,
      });

      const filters: FilterCriteria = {
        generation: { models: ["anima-xl.safetensors"] },
        user: { ratingMin: 4, colorLabels: ["green"] },
        text: { positivePrompt: "masterpiece" },
        properties: { aspectRatios: ["portrait"] },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("perfect-match.png");
    });
  });

  describe("Collection filter", () => {
    it("collection - filter by collectionId", async () => {
      const service = new GalleryQueryService();

      // Create images
      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "in-collection.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "not-in-collection.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "in-other-collection.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      // Create collections
      await testDbClient.insert(schema.collections).values({
        id: 1,
        name: "My Collection",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await testDbClient.insert(schema.collections).values({
        id: 2,
        name: "Other Collection",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Add images to collections
      await testDbClient.insert(schema.collectionImages).values({
        collectionId: 1,
        relativePath: "in-collection.png",
      });

      await testDbClient.insert(schema.collectionImages).values({
        collectionId: 2,
        relativePath: "in-other-collection.png",
      });

      const filters: FilterCriteria = {
        collection: { collectionId: 1 },
      };
      const result = await service.query(filters);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("in-collection.png");
    });

    it("collection - result includes collectionIds", async () => {
      const service = new GalleryQueryService();

      // Create image
      await testDbClient.insert(schema.imageAttributes).values({
        relativePath: "multi-collection.png",
        width: 512,
        height: 512,
        aspectRatio: "square",
        fileFormat: "PNG",
        fileModifiedAt: new Date().toISOString(),
        isMissing: false,
      });

      // Create collections
      await testDbClient.insert(schema.collections).values({
        id: 1,
        name: "Collection 1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await testDbClient.insert(schema.collections).values({
        id: 2,
        name: "Collection 2",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Add to multiple collections
      await testDbClient.insert(schema.collectionImages).values({
        collectionId: 1,
        relativePath: "multi-collection.png",
      });

      await testDbClient.insert(schema.collectionImages).values({
        collectionId: 2,
        relativePath: "multi-collection.png",
      });

      const result = await service.query();

      expect(result.images).toHaveLength(1);
      expect(result.images[0].relativePath).toBe("multi-collection.png");
      expect(result.images[0].collectionIds).toEqual([1, 2]);
    });
  });
});
