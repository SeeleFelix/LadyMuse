import { describe, it, expect, afterAll } from "vitest";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import {
  createTestDir,
  createTestPng,
  cleanupTestDir,
  SAMPLE_PROMPT_JSON,
} from "./metadata-extractor-fixtures";
import { extractImageMetadata } from "../metadata-extractor";

// Test directory setup
const testDir = createTestDir();

afterAll(() => {
  cleanupTestDir(testDir);
});

describe("extractImageMetadata", () => {
  it("1. Basic file properties - PNG with no metadata", () => {
    const path = join(testDir, "basic.png");
    createTestPng(path, { width: 1024, height: 1536, alpha: false });

    const result = extractImageMetadata(path);

    expect(result.fileFormat).toBe("PNG");
    expect(result.width).toBe(1024);
    expect(result.height).toBe(1536);
    expect(result.aspectRatio).toBe("portrait");
    expect(result.fileSize).toBeGreaterThan(0);
    expect(result.hasAlpha).toBe(false);
    expect(result.fileModifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.rawChunks).toEqual([]);
  });

  it("2. Aspect ratio classification - landscape (1920x1080)", () => {
    const path = join(testDir, "landscape.png");
    createTestPng(path, { width: 1920, height: 1080 });

    const result = extractImageMetadata(path);
    expect(result.aspectRatio).toBe("landscape");
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
  });

  it("2. Aspect ratio classification - square (512x512)", () => {
    const path = join(testDir, "square.png");
    createTestPng(path, { width: 512, height: 512 });

    const result = extractImageMetadata(path);
    expect(result.aspectRatio).toBe("square");
    expect(result.width).toBe(512);
    expect(result.height).toBe(512);
  });

  it("2. Aspect ratio classification - portrait (100x200)", () => {
    const path = join(testDir, "portrait.png");
    createTestPng(path, { width: 100, height: 200 });

    const result = extractImageMetadata(path);
    expect(result.aspectRatio).toBe("portrait");
    expect(result.width).toBe(100);
    expect(result.height).toBe(200);
  });

  it("3. Alpha channel detection - PNG with hasAlpha=true", () => {
    const path = join(testDir, "alpha.png");
    createTestPng(path, { width: 800, height: 600, alpha: true });

    const result = extractImageMetadata(path);
    expect(result.hasAlpha).toBe(true);
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
  });

  it("3. Alpha channel detection - PNG without alpha", () => {
    const path = join(testDir, "no-alpha.png");
    createTestPng(path, { width: 800, height: 600, alpha: false });

    const result = extractImageMetadata(path);
    expect(result.hasAlpha).toBe(false);
  });

  it("4. ComfyUI metadata extraction - full workflow", () => {
    const path = join(testDir, "comfyui.png");
    createTestPng(path, {
      width: 1024,
      height: 1536,
      textChunks: [{ keyword: "prompt", text: SAMPLE_PROMPT_JSON }],
    });

    const result = extractImageMetadata(path);

    // Models
    expect(result.extractedModels).toContain("anima-xl.safetensors");

    // LoRAs
    expect(result.extractedLoras).toContain("detail_enhancer.safetensors");

    // Samplers
    expect(result.extractedSamplers).toContain("dpmpp_2m");

    // Schedulers
    expect(result.extractedSchedulers).toContain("karras");

    // Prompts
    expect(result.positivePrompt).toContain("1girl, solo");
    expect(result.negativePrompt).toContain("bad anatomy");

    // Sampler parameters
    expect(result.steps).toBe(30);
    expect(result.cfgScale).toBe(7.0);
    expect(result.seed).toBe("1234567890");
  });

  it("5. Raw text chunks preserved - all chunks appear", () => {
    const path = join(testDir, "raw-chunks.png");
    createTestPng(path, {
      width: 512,
      height: 512,
      textChunks: [
        { keyword: "prompt", text: SAMPLE_PROMPT_JSON },
        { keyword: "workflow", text: '{"nodes":[]}' },
        { keyword: "custom_key", text: "custom_value" },
      ],
    });

    const result = extractImageMetadata(path);

    expect(result.rawChunks).toHaveLength(3);
    expect(result.rawChunks).toContainEqual({
      keyword: "prompt",
      text: SAMPLE_PROMPT_JSON,
    });
    expect(result.rawChunks).toContainEqual({
      keyword: "workflow",
      text: '{"nodes":[]}',
    });
    expect(result.rawChunks).toContainEqual({
      keyword: "custom_key",
      text: "custom_value",
    });
  });

  it("6. PNG without ComfyUI metadata - empty defaults", () => {
    const path = join(testDir, "no-metadata.png");
    createTestPng(path, { width: 800, height: 600 });

    const result = extractImageMetadata(path);

    expect(result.extractedModels).toEqual([]);
    expect(result.extractedLoras).toEqual([]);
    expect(result.extractedSamplers).toEqual([]);
    expect(result.extractedSchedulers).toEqual([]);
    expect(result.positivePrompt).toBe("");
    expect(result.negativePrompt).toBe("");
    expect(result.steps).toBe(0);
    expect(result.cfgScale).toBe(0);
    expect(result.seed).toBe("0");
    expect(result.rawChunks).toEqual([]);
  });

  it("7. JPG file - basic format detection, no ComfyUI extraction", () => {
    const path = join(testDir, "image.jpg");
    // Minimal JPEG file (1x1 red pixel)
    const jpegData = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x03, 0x02, 0x02, 0x03, 0x02, 0x02, 0x03, 0x02, 0x02, 0x03, 0x02,
      0x02, 0x03, 0x02, 0x02, 0x03, 0x02, 0x02, 0x03, 0x02, 0x02, 0x03, 0x02,
      0x02, 0x03, 0x02, 0x02, 0x03, 0x02, 0x02, 0x03, 0x02, 0x02, 0x03, 0x02,
      0x02, 0x03, 0x02, 0x02, 0x03, 0x02, 0x02, 0x03, 0x02, 0x02, 0x03, 0x02,
      0x02, 0x03, 0x02, 0x02, 0x03, 0x02, 0x02, 0x03, 0x02, 0x02, 0x03, 0x02,
      0x02, 0x03, 0x02, 0x02, 0x03, 0x02, 0x02, 0x03, 0xff, 0xc0, 0x00, 0x0b,
      0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00,
      0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x09, 0xff, 0xc4, 0x00, 0x14,
      0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01,
      0x01, 0x00, 0x00, 0x3f, 0x00, 0x37, 0xff, 0xd9,
    ]);
    writeFileSync(path, jpegData);

    const result = extractImageMetadata(path);

    expect(result.fileFormat).toBe("JPG");
    expect(result.hasAlpha).toBe(false); // JPEG never has alpha
    expect(result.width).toBe(null); // We don't read JPEG dimensions
    expect(result.height).toBe(null);
    expect(result.aspectRatio).toBe(null);
    expect(result.extractedModels).toEqual([]);
    expect(result.extractedLoras).toEqual([]);
    expect(result.extractedSamplers).toEqual([]);
    expect(result.extractedSchedulers).toEqual([]);
  });

  it("8. metadataJson field - stores raw prompt JSON", () => {
    const path = join(testDir, "metadata-json.png");
    createTestPng(path, {
      width: 512,
      height: 768,
      textChunks: [{ keyword: "prompt", text: SAMPLE_PROMPT_JSON }],
    });

    const result = extractImageMetadata(path);

    expect(result.metadataJson).toBe(SAMPLE_PROMPT_JSON);
  });

  it("8. metadataJson field - null when no ComfyUI metadata", () => {
    const path = join(testDir, "no-metadata-json.png");
    createTestPng(path, { width: 512, height: 512 });

    const result = extractImageMetadata(path);

    expect(result.metadataJson).toBe(null);
  });

  it("Edge case: zero height - aspectRatio is null", () => {
    const path = join(testDir, "zero-height.png");
    createTestPng(path, { width: 100, height: 0 });

    const result = extractImageMetadata(path);
    // Height from PNG dimensions is 0, so aspectRatio should be null
    expect(result.aspectRatio).toBe(null);
  });

  it("Edge case: near-square ratios within threshold are square", () => {
    // Test boundaries: ratio < 0.95 = portrait, ratio > 1.05 = landscape
    // 0.95 <= ratio <= 1.05 = square

    // 100/95 = 1.0526... > 1.05 -> landscape
    const landscapePath = join(testDir, "near-landscape.png");
    createTestPng(landscapePath, { width: 100, height: 95 });
    expect(extractImageMetadata(landscapePath).aspectRatio).toBe("landscape");

    // 100/105 = 0.952... > 0.95 -> square
    const squarePath = join(testDir, "near-square1.png");
    createTestPng(squarePath, { width: 100, height: 105 });
    expect(extractImageMetadata(squarePath).aspectRatio).toBe("square");

    // 95/100 = 0.95 = portrait threshold
    const portraitPath = join(testDir, "near-portrait.png");
    createTestPng(portraitPath, { width: 95, height: 100 });
    expect(extractImageMetadata(portraitPath).aspectRatio).toBe("square");
  });
});
