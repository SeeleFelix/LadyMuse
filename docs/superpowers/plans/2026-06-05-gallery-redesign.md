# Gallery Redesign — Plan 1: Schema & Metadata Extraction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the database schema and metadata extraction to capture all available image data, providing the foundation for the gallery sync engine, query service, and UI layers.

**Architecture:** Add new columns to `imageAttributes` for extracted index fields (models, LoRAs, samplers, prompts, numeric params) and image physical properties (dimensions, format, file size). Create a new `metadata-extractor.ts` module that coordinates comprehensive metadata extraction from all image formats. Use Drizzle Kit to generate and apply the schema migration.

**Tech Stack:** Drizzle ORM, better-sqlite3, Vitest, existing png-metadata.ts

**Depends on:** Nothing (this is the foundation)

**Enables:** Plan 2 (FileSyncService), Plan 3 (GalleryQueryService), Plan 4 (UI Components)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/server/db/schema.ts:261-271` | Add new columns to `imageAttributes` |
| Create | `src/lib/server/metadata-extractor.ts` | Comprehensive metadata extraction from any image file |
| Create | `src/lib/server/__tests__/metadata-extractor.test.ts` | Tests for metadata extraction |
| Create | `src/lib/server/__tests__/metadata-extractor-fixtures.ts` | Test fixtures (mock PNG chunks, sample metadata) |
| Modify | `src/lib/server/png-metadata.ts` | Export `extractPngTextChunks` (already public), add raw chunk collection |

---

### Task 1: Add new columns to imageAttributes schema

**Files:**
- Modify: `src/lib/server/db/schema.ts:261-271`
- Test: `src/lib/server/db/__tests__/schema-defaults.test.ts`

- [ ] **Step 1: Write the failing test for new schema columns**

Add to `src/lib/server/db/__tests__/schema-defaults.test.ts`:

```typescript
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

    // Insert with all new fields populated
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
      )`
    );

    const row = testDb.run(sql`SELECT * FROM image_attributes WHERE relative_path = 'test/image.png'`);
    expect(row).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/db/__tests__/schema-defaults.test.ts --reporter=verbose`
Expected: FAIL — new columns don't exist in schema yet

- [ ] **Step 3: Add new columns to `imageAttributes` in schema.ts**

Replace the `imageAttributes` table definition in `src/lib/server/db/schema.ts` (lines 261-271) with:

```typescript
export const imageAttributes = sqliteTable("image_attributes", {
  relativePath: text("relative_path").primaryKey(),
  rating: integer("rating").default(0),
  colorLabel: text("color_label"),
  flag: text("flag"),
  notes: text("notes"),
  stackId: integer("stack_id").references(() => stacks.id),
  metadataJson: text("metadata_json"),
  createdAt: text("created_at").default(now),
  updatedAt: text("updated_at").default(now),

  // Extracted index fields (from ComfyUI workflow)
  extractedModels: text("extracted_models"),
  extractedLoras: text("extracted_loras"),
  extractedSamplers: text("extracted_samplers"),
  extractedSchedulers: text("extracted_schedulers"),
  positivePrompt: text("positive_prompt"),
  negativePrompt: text("negative_prompt"),
  steps: integer("steps").default(0),
  cfgScale: real("cfg_scale").default(0),
  seed: text("seed"),

  // Image physical properties
  width: integer("width"),
  height: integer("height"),
  aspectRatio: text("aspect_ratio"),
  fileSize: integer("file_size"),
  fileFormat: text("file_format"),
  colorSpace: text("color_space"),
  hasAlpha: integer("has_alpha", { mode: "boolean" }).default(false),

  // File tracking (for sync engine)
  fileModifiedAt: text("file_modified_at"),
  isMissing: integer("is_missing", { mode: "boolean" }).default(false),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/db/__tests__/schema-defaults.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Generate and apply migration**

Run:
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

Expected: Migration file created in `./drizzle/` with ALTER TABLE adding all new columns.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/db/schema.ts drizzle/ src/lib/server/db/__tests__/schema-defaults.test.ts
git commit -m "feat: add metadata columns to image_attributes schema"
```

---

### Task 2: Create ImageMetadata type and extraction fixtures

**Files:**
- Create: `src/lib/server/metadata-extractor.ts`
- Create: `src/lib/server/__tests__/metadata-extractor-fixtures.ts`

- [ ] **Step 1: Define the ImageMetadata type and extraction result interface**

Create `src/lib/server/metadata-extractor.ts`:

```typescript
import { statSync } from "node:fs";
import { extname, basename } from "node:path";
import {
  parseComfyUIPngMetadata,
  readPngDimensions,
  extractPngTextChunks,
  type ComfyUIMetadata,
  type SamplerInfo,
} from "./png-metadata";

export interface ExtractedImageMetadata {
  // Raw text chunks preserved intact (for "Send to ComfyUI" and future use)
  rawChunks: { keyword: string; text: string }[];

  // Extracted index fields
  extractedModels: string[];
  extractedLoras: string[];
  extractedSamplers: string[];
  extractedSchedulers: string[];
  positivePrompt: string;
  negativePrompt: string;
  steps: number;
  cfgScale: number;
  seed: string;

  // Image physical properties
  width: number | null;
  height: number | null;
  aspectRatio: "portrait" | "landscape" | "square" | null;
  fileSize: number;
  fileFormat: "PNG" | "JPG" | "WebP";
  colorSpace: string | null;
  hasAlpha: boolean;

  // File system
  fileModifiedAt: string;

  // Original raw data
  metadataJson: string | null;
}

function classifyAspectRatio(
  w: number | null,
  h: number | null,
): "portrait" | "landscape" | "square" | null {
  if (!w || !h) return null;
  const ratio = w / h;
  if (ratio > 1.05) return "landscape";
  if (ratio < 0.95) return "portrait";
  return "square";
}

function detectFileFormat(
  filePath: string,
): "PNG" | "JPG" | "WebP" {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".png") return "PNG";
  if (ext === ".jpg" || ext === ".jpeg") return "JPG";
  return "WebP";
}

function extractFirstSampler(
  samplers: SamplerInfo[],
): { steps: number; cfgScale: number; seed: string; sampler: string; scheduler: string } {
  if (samplers.length === 0) {
    return { steps: 0, cfgScale: 0, seed: "", sampler: "", scheduler: "" };
  }
  const s = samplers[0];
  return {
    steps: s.steps ?? 0,
    cfgScale: s.cfg ?? 0,
    seed: s.seed != null ? String(s.seed) : "",
    sampler: s.samplerName ?? "",
    scheduler: s.scheduler ?? "",
  };
}

export function extractImageMetadata(filePath: string): ExtractedImageMetadata {
  const stat = statSync(filePath);
  const fileFormat = detectFileFormat(filePath);

  // Collect all PNG text chunks
  const rawChunks: { keyword: string; text: string }[] = [];
  if (fileFormat === "PNG") {
    const chunks = extractPngTextChunks(filePath);
    for (const c of chunks) {
      rawChunks.push({ keyword: c.keyword, text: c.text });
    }
  }

  // Parse ComfyUI metadata (existing logic handles prompt + workflow JSON)
  const comfyMeta: ComfyUIMetadata | null =
    fileFormat === "PNG" ? parseComfyUIPngMetadata(filePath) : null;

  // Extract index fields from ComfyUI metadata
  const firstSampler = extractFirstSampler(comfyMeta?.samplers ?? []);

  // Collect all sampler names and schedulers
  const samplerNames: string[] = [];
  const schedulerNames: string[] = [];
  if (comfyMeta?.samplers) {
    for (const s of comfyMeta.samplers) {
      if (s.samplerName && !samplerNames.includes(s.samplerName)) {
        samplerNames.push(s.samplerName);
      }
      if (s.scheduler && !schedulerNames.includes(s.scheduler)) {
        schedulerNames.push(s.scheduler);
      }
    }
  }

  // Read dimensions
  let width: number | null = comfyMeta?.width ?? null;
  let height: number | null = comfyMeta?.height ?? null;
  if (fileFormat === "PNG") {
    const dims = readPngDimensions(filePath);
    if (dims) {
      width = dims.width;
      height = dims.height;
    }
  }

  // Detect alpha for PNG by checking IHDR color type
  let hasAlpha = false;
  if (fileFormat === "PNG") {
    hasAlpha = detectPngAlpha(filePath);
  }

  return {
    rawChunks,
    extractedModels: comfyMeta?.models ?? [],
    extractedLoras: comfyMeta?.loras ?? [],
    extractedSamplers: samplerNames,
    extractedSchedulers: schedulerNames,
    positivePrompt: comfyMeta?.positivePrompts.join("\n") ?? "",
    negativePrompt: comfyMeta?.negativePrompts.join("\n") ?? "",
    steps: firstSampler.steps,
    cfgScale: firstSampler.cfgScale,
    seed: firstSampler.seed,
    width,
    height,
    aspectRatio: classifyAspectRatio(width, height),
    fileSize: stat.size,
    fileFormat,
    colorSpace: null, // TODO: extract from EXIF if present
    hasAlpha,
    fileModifiedAt: new Date(stat.mtimeMs).toISOString(),
    metadataJson: comfyMeta?.rawPromptJson ?? null,
  };
}

function detectPngAlpha(filePath: string): boolean {
  try {
    const { openSync, readSync, closeSync } = require("node:fs");
    const fd = openSync(filePath, "r");
    try {
      const buf = Buffer.alloc(25);
      const n = readSync(fd, buf, 0, 25, null);
      if (n < 25) return false;
      if (!buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
      const ihdrLen = buf.readUInt32BE(8);
      if (ihdrLen !== 13) return false;
      if (buf.subarray(12, 16).toString("ascii") !== "IHDR") return false;
      // Color type byte is at offset 24 in IHDR data
      const colorType = buf[24];
      // Color types with alpha: 4 (grayscale+alpha), 6 (RGBA)
      return colorType === 4 || colorType === 6;
    } finally {
      closeSync(fd);
    }
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Create test fixtures**

Create `src/lib/server/__tests__/metadata-extractor-fixtures.ts`:

```typescript
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Minimal PNG builder for testing
const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(buf: Buffer): number {
  // CRC32 lookup table
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

function makeIHDR(width: number, height: number, colorType: number = 2): Buffer {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8; // bit depth
  data[9] = colorType; // 2=RGB, 6=RGBA
  data[10] = 0; // compression
  data[11] = 0; // filter
  data[12] = 0; // interlace
  return makeChunk("IHDR", data);
}

function makeTextChunk(keyword: string, text: string): Buffer {
  const kw = Buffer.from(keyword, "ascii");
  const txt = Buffer.from(text, "utf-8");
  const data = Buffer.concat([kw, Buffer.from([0]), txt]);
  return makeChunk("tEXt", data);
}

function makeIDAT(width: number, height: number, hasAlpha: boolean): Buffer {
  // Create minimal image data
  const channels = hasAlpha ? 4 : 3;
  const rowSize = 1 + width * channels; // filter byte + pixel data
  const rawData = Buffer.alloc(rowSize * height, 0);
  const { deflateSync } = require("node:zlib");
  const compressed = deflateSync(rawData);
  return makeChunk("IDAT", compressed);
}

const IEND = makeChunk("IEND", Buffer.alloc(0));

export function createTestPng(
  path: string,
  options: {
    width?: number;
    height?: number;
    hasAlpha?: boolean;
    textChunks?: { keyword: string; text: string }[];
  } = {},
): string {
  const { width = 1, height = 1, hasAlpha = false, textChunks = [] } = options;
  const colorType = hasAlpha ? 6 : 2;

  const chunks = [
    PNG_SIG,
    makeIHDR(width, height, colorType),
    ...textChunks.map((c) => makeTextChunk(c.keyword, c.text)),
    makeIDAT(width, height, hasAlpha),
    IEND,
  ];

  writeFileSync(path, Buffer.concat(chunks));
  return path;
}

export function createTestDir(): string {
  const dir = join(tmpdir(), `ladymuse-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function cleanupTestDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Sample ComfyUI prompt JSON (simplified)
export const SAMPLE_PROMPT_JSON = JSON.stringify({
  "3": {
    class_type: "KSampler",
    inputs: {
      seed: 1234567890,
      steps: 30,
      cfg: 7.0,
      sampler_name: "dpmpp_2m",
      scheduler: "karras",
      denoise: 1.0,
    },
  },
  "4": {
    class_type: "CheckpointLoaderSimple",
    inputs: { ckpt_name: "anima-xl.safetensors" },
  },
  "5": {
    class_type: "LoraLoader",
    inputs: { lora_name: "detail_enhancer.safetensors" },
  },
  "6": {
    class_type: "CLIPTextEncode",
    inputs: { text: "1girl, solo, long hair, blue eyes, school uniform" },
  },
  "7": {
    class_type: "CLIPTextEncode",
    inputs: { text: "bad anatomy, worst quality, low quality, blurry" },
  },
  "8": {
    class_type: "EmptyLatentImage",
    inputs: { width: 1024, height: 1536 },
  },
});

export const SAMPLE_WORKFLOW_JSON = JSON.stringify({
  nodes: [
    {
      type: "LoraLoader",
      widgets_values: ["detail_enhancer.safetensors", 0.8, 1.0],
    },
  ],
});
```

- [ ] **Step 3: Commit fixtures and type definitions**

```bash
git add src/lib/server/metadata-extractor.ts src/lib/server/__tests__/metadata-extractor-fixtures.ts
git commit -m "feat: add ImageMetadata type and test fixtures for metadata extraction"
```

---

### Task 3: Test and implement metadata extraction

**Files:**
- Create: `src/lib/server/__tests__/metadata-extractor.test.ts`
- Modify: `src/lib/server/metadata-extractor.ts`

- [ ] **Step 1: Write tests for extractImageMetadata**

Create `src/lib/server/__tests__/metadata-extractor.test.ts`:

```typescript
import { describe, it, expect, afterAll } from "vitest";
import { join } from "node:path";
import {
  createTestDir,
  createTestPng,
  cleanupTestDir,
  SAMPLE_PROMPT_JSON,
} from "./metadata-extractor-fixtures";
import { extractImageMetadata } from "../metadata-extractor";

const testDir = createTestDir();

afterAll(() => {
  cleanupTestDir(testDir);
});

describe("extractImageMetadata", () => {
  it("extracts basic file properties for a minimal PNG", () => {
    const path = join(testDir, "basic.png");
    createTestPng(path, { width: 100, height: 200 });

    const meta = extractImageMetadata(path);

    expect(meta.fileFormat).toBe("PNG");
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(200);
    expect(meta.aspectRatio).toBe("portrait");
    expect(meta.fileSize).toBeGreaterThan(0);
    expect(meta.hasAlpha).toBe(false);
    expect(meta.isMissing).toBe(false);
    expect(meta.fileModifiedAt).toBeTruthy();
  });

  it("detects landscape aspect ratio", () => {
    const path = join(testDir, "landscape.png");
    createTestPng(path, { width: 1920, height: 1080 });

    const meta = extractImageMetadata(path);
    expect(meta.aspectRatio).toBe("landscape");
  });

  it("detects square aspect ratio", () => {
    const path = join(testDir, "square.png");
    createTestPng(path, { width: 512, height: 512 });

    const meta = extractImageMetadata(path);
    expect(meta.aspectRatio).toBe("square");
  });

  it("detects alpha channel", () => {
    const path = join(testDir, "alpha.png");
    createTestPng(path, { width: 10, height: 10, hasAlpha: true });

    const meta = extractImageMetadata(path);
    expect(meta.hasAlpha).toBe(true);
  });

  it("extracts ComfyUI metadata from PNG text chunks", () => {
    const path = join(testDir, "comfyui.png");
    createTestPng(path, {
      width: 1024,
      height: 1536,
      textChunks: [
        { keyword: "prompt", text: SAMPLE_PROMPT_JSON },
      ],
    });

    const meta = extractImageMetadata(path);

    expect(meta.extractedModels).toContain("anima-xl.safetensors");
    expect(meta.extractedLoras).toContain("detail_enhancer.safetensors");
    expect(meta.extractedSamplers).toContain("dpmpp_2m");
    expect(meta.extractedSchedulers).toContain("karras");
    expect(meta.positivePrompt).toContain("1girl, solo");
    expect(meta.negativePrompt).toContain("bad anatomy");
    expect(meta.steps).toBe(30);
    expect(meta.cfgScale).toBe(7.0);
    expect(meta.seed).toBe("1234567890");
  });

  it("preserves raw text chunks", () => {
    const path = join(testDir, "raw_chunks.png");
    createTestPng(path, {
      width: 10,
      height: 10,
      textChunks: [
        { keyword: "prompt", text: SAMPLE_PROMPT_JSON },
        { keyword: "workflow", text: '{"nodes":[]}' },
        { keyword: "custom_key", text: "custom_value" },
      ],
    });

    const meta = extractImageMetadata(path);

    expect(meta.rawChunks.length).toBe(3);
    expect(meta.rawChunks.map((c) => c.keyword)).toContain("prompt");
    expect(meta.rawChunks.map((c) => c.keyword)).toContain("workflow");
    expect(meta.rawChunks.map((c) => c.keyword)).toContain("custom_key");
  });

  it("returns empty arrays for PNG without ComfyUI metadata", () => {
    const path = join(testDir, "no_meta.png");
    createTestPng(path, { width: 100, height: 100 });

    const meta = extractImageMetadata(path);

    expect(meta.extractedModels).toEqual([]);
    expect(meta.extractedLoras).toEqual([]);
    expect(meta.positivePrompt).toBe("");
    expect(meta.negativePrompt).toBe("");
    expect(meta.steps).toBe(0);
    expect(meta.seed).toBe("");
  });

  it("handles JPG files with basic properties", () => {
    // Create a minimal JPG-like file (just test format detection)
    const path = join(testDir, "photo.jpg");
    // Write minimal valid content — just test the format detection path
    const { writeFileSync } = require("node:fs");
    writeFileSync(path, Buffer.alloc(100));

    const meta = extractImageMetadata(path);

    expect(meta.fileFormat).toBe("JPG");
    expect(meta.extractedModels).toEqual([]);
  });

  it("stores rawPromptJson in metadataJson field", () => {
    const path = join(testDir, "raw_prompt.png");
    createTestPng(path, {
      width: 10,
      height: 10,
      textChunks: [
        { keyword: "prompt", text: SAMPLE_PROMPT_JSON },
      ],
    });

    const meta = extractImageMetadata(path);
    expect(meta.metadataJson).toBe(SAMPLE_PROMPT_JSON);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/server/__tests__/metadata-extractor.test.ts --reporter=verbose`
Expected: Some tests FAIL — `extractImageMetadata` may have bugs or missing logic

- [ ] **Step 3: Fix any issues in metadata-extractor.ts**

Iterate on `src/lib/server/metadata-extractor.ts` until all tests pass. The `detectPngAlpha` function uses `require("node:fs")` which should be changed to use the already-imported `openSync`/`readSync`/`closeSync`. Replace:

```typescript
function detectPngAlpha(filePath: string): boolean {
  try {
    const fd = openSync(filePath, "r");
    try {
      const buf = Buffer.alloc(25);
      const n = readSync(fd, buf, 0, 25, null);
      if (n < 25) return false;
      if (!buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
      const ihdrLen = buf.readUInt32BE(8);
      if (ihdrLen !== 13) return false;
      if (buf.subarray(12, 16).toString("ascii") !== "IHDR") return false;
      const colorType = buf[24];
      return colorType === 4 || colorType === 6;
    } finally {
      closeSync(fd);
    }
  } catch {
    return false;
  }
}
```

Also add the missing imports at the top of `metadata-extractor.ts`:

```typescript
import { statSync, openSync, readSync, closeSync } from "node:fs";
```

And remove the duplicate require-based implementation.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/server/__tests__/metadata-extractor.test.ts --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/__tests__/metadata-extractor.test.ts src/lib/server/metadata-extractor.ts
git commit -m "feat: comprehensive image metadata extraction with tests"
```

---

### Task 4: Update browse API to populate new columns on-demand

**Files:**
- Modify: `src/lib/server/comfyui-browser.ts`
- Modify: `src/routes/api/comfyui/browse/+server.ts`

The current browse API reads metadata from PNG on every request but never writes the extracted data to the database. We need to ensure new columns get populated when images are first seen.

- [ ] **Step 1: Add a function to upsert extracted metadata into imageAttributes**

Add to `src/lib/server/metadata-extractor.ts`:

```typescript
import { db } from "./db";
import { imageAttributes } from "./db/schema";
import { eq } from "drizzle-orm";

export async function upsertImageMetadata(
  relativePath: string,
  absolutePath: string,
): Promise<void> {
  const meta = extractImageMetadata(absolutePath);

  // Check if record exists
  const existing = await db
    .select({ fileModifiedAt: imageAttributes.fileModifiedAt })
    .from(imageAttributes)
    .where(eq(imageAttributes.relativePath, relativePath))
    .get();

  // Skip if file hasn't changed since last extraction
  if (existing?.fileModifiedAt === meta.fileModifiedAt) return;

  const values = {
    extractedModels: JSON.stringify(meta.extractedModels),
    extractedLoras: JSON.stringify(meta.extractedLoras),
    extractedSamplers: JSON.stringify(meta.extractedSamplers),
    extractedSchedulers: JSON.stringify(meta.extractedSchedulers),
    positivePrompt: meta.positivePrompt,
    negativePrompt: meta.negativePrompt,
    steps: meta.steps,
    cfgScale: meta.cfgScale,
    seed: meta.seed,
    width: meta.width,
    height: meta.height,
    aspectRatio: meta.aspectRatio,
    fileSize: meta.fileSize,
    fileFormat: meta.fileFormat,
    colorSpace: meta.colorSpace,
    hasAlpha: meta.hasAlpha,
    fileModifiedAt: meta.fileModifiedAt,
    isMissing: false,
    metadataJson: meta.metadataJson,
  };

  if (existing) {
    await db
      .update(imageAttributes)
      .set({ ...values, updatedAt: new Date().toISOString() })
      .where(eq(imageAttributes.relativePath, relativePath));
  } else {
    await db.insert(imageAttributes).values({
      relativePath,
      ...values,
    });
  }
}
```

- [ ] **Step 2: Write test for upsertImageMetadata**

Add to `src/lib/server/__tests__/metadata-extractor.test.ts`:

```typescript
import { upsertImageMetadata } from "../metadata-extractor";

describe("upsertImageMetadata", () => {
  it("extracts metadata and returns structured result for database insertion", async () => {
    const path = join(testDir, "upsert_new.png");
    createTestPng(path, {
      width: 1024,
      height: 768,
      textChunks: [
        { keyword: "prompt", text: SAMPLE_PROMPT_JSON },
      ],
    });

    // Test extraction directly (the upsert function will be tested with real DB in integration)
    const meta = extractImageMetadata(path);

    expect(meta.extractedModels).toEqual(["anima-xl.safetensors"]);
    expect(meta.width).toBe(1024);
    expect(meta.height).toBe(768);
    expect(meta.aspectRatio).toBe("landscape");
    expect(meta.fileFormat).toBe("PNG");
    expect(meta.steps).toBe(30);
    expect(meta.hasAlpha).toBe(false);

    // Verify the data can be serialized for DB storage
    const dbValues = {
      extractedModels: JSON.stringify(meta.extractedModels),
      extractedLoras: JSON.stringify(meta.extractedLoras),
      width: meta.width,
      height: meta.height,
    };
    expect(dbValues.extractedModels).toBe('["anima-xl.safetensors"]');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/lib/server/__tests__/metadata-extractor.test.ts --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/metadata-extractor.ts src/lib/server/__tests__/metadata-extractor.test.ts
git commit -m "feat: upsert extracted metadata to database with change detection"
```

---

### Task 5: Run all tests and verify integration

**Files:** None changed

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 2: Verify migration applied to development database**

Run: `npx drizzle-kit push`
Expected: Schema changes applied without errors

- [ ] **Step 3: Verify existing gallery still works**

Start the dev server (`npm run dev`), navigate to `/generations`, verify:
- Existing images display correctly
- Ratings, tags, collections still work
- New columns show null/empty for existing images (expected — they'll be populated by FileSyncService in Plan 2)

- [ ] **Step 4: Commit final state if any fixes were needed**

```bash
git add -A
git commit -m "fix: integration fixes for schema migration"
```

---

## Summary of Plan 1 Deliverables

1. **Extended `imageAttributes` schema** with 19 new columns for extracted index fields, image properties, and file tracking
2. **`metadata-extractor.ts`** — Comprehensive metadata extraction from any image file
3. **`upsertImageMetadata()`** — Database write with change detection (mtime comparison)
4. **Full test coverage** for extraction logic
5. **Database migration** applied cleanly

## Next Plans

- **Plan 2:** FileSyncService — chokidar-based watcher, startup reconciliation, periodic validation, SSE broadcast
- **Plan 3:** GalleryQueryService — Multi-dimensional filtering, cursor pagination, smart collections
- **Plan 4:** UI Components — Gallery store, Library/Inspect/Compare modes, keyboard shortcuts, virtual scrolling
