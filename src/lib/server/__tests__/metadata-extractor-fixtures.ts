import { mkdirSync, rmSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { deflateSync } from "node:zlib";
import { randomBytes } from "node:crypto";

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// PNG color type values
const PNG_COLOR_TYPE_GRAYSCALE = 0;
const PNG_COLOR_TYPE_RGB = 2;
const PNG_COLOR_TYPE_PALETTE = 3;
const PNG_COLOR_TYPE_GRAYSCALE_ALPHA = 4;
const PNG_COLOR_TYPE_RGBA = 6;

/**
 * Calculate CRC32 for PNG chunk data.
 * PNG CRC is calculated over chunk type (4 bytes) + chunk data.
 */
function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Create a PNG chunk with proper CRC32.
 * Returns Buffer containing: length (4 bytes) + type (4 bytes) + data + CRC (4 bytes)
 */
function createPngChunk(type: string, data: Buffer = Buffer.alloc(0)): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const chunkData = Buffer.concat([typeBuf, data]);
  const crc = crc32(chunkData);
  const length = data.length;

  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(length, 0);
  typeBuf.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc, 8 + data.length);
  return chunk;
}

/**
 * Create an IHDR chunk for PNG.
 */
function createIhdrChunk(
  width: number,
  height: number,
  colorType: number = PNG_COLOR_TYPE_RGB,
): Buffer {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data.writeUInt8(8, 8); // bit depth
  data.writeUInt8(colorType, 9); // color type
  data.writeUInt8(0, 10); // compression method
  data.writeUInt8(0, 11); // filter method
  data.writeUInt8(0, 12); // interlace method
  return createPngChunk("IHDR", data);
}

/**
 * Create a tEXt chunk with keyword and text.
 */
function createTextChunk(keyword: string, text: string): Buffer {
  const keywordBuf = Buffer.from(keyword, "ascii");
  const textBuf = Buffer.from(text, "utf-8");
  const data = Buffer.concat([keywordBuf, Buffer.from([0]), textBuf]);
  return createPngChunk("tEXt", data);
}

/**
 * Create an IDAT chunk with minimal valid image data.
 * Creates a 1x1 pixel image (deflated scanline data).
 */
function createIdatChunk(
  width: number,
  height: number,
  hasAlpha: boolean = false,
): Buffer {
  // Create minimal scanline data for a solid color image
  const bytesPerPixel = hasAlpha ? 4 : 3;
  const rowSize = 1 + width * bytesPerPixel; // filter type (1) + pixel data

  const scanlines = Buffer.alloc(height * rowSize);

  // Fill each scanline: filter type 0 (none) + pixel data
  for (let y = 0; y < height; y++) {
    const offset = y * rowSize;
    scanlines[offset] = 0; // filter type None
    // Fill with white pixels (or gray for grayscale)
    for (let x = 0; x < width; x++) {
      const pixelOffset = offset + 1 + x * bytesPerPixel;
      if (hasAlpha) {
        scanlines[pixelOffset] = 255; // R
        scanlines[pixelOffset + 1] = 255; // G
        scanlines[pixelOffset + 2] = 255; // B
        scanlines[pixelOffset + 3] = 255; // A
      } else {
        scanlines[pixelOffset] = 255; // R
        scanlines[pixelOffset + 1] = 255; // G
        scanlines[pixelOffset + 2] = 255; // B
      }
    }
  }

  // Deflate the scanlines
  const deflated = deflateSync(scanlines);
  return createPngChunk("IDAT", deflated);
}

/**
 * Create an IEND chunk (marks end of PNG).
 */
function createIendChunk(): Buffer {
  return createPngChunk("IEND");
}

export interface CreateTestPngOptions {
  width?: number;
  height?: number;
  alpha?: boolean;
  textChunks?: Array<{ keyword: string; text: string }>;
}

/**
 * Create a valid minimal PNG file for testing.
 * Includes PNG signature, IHDR, optional tEXt chunks, IDAT, and IEND.
 */
export function createTestPng(
  path: string,
  options: CreateTestPngOptions = {},
): void {
  const width = options.width ?? 1024;
  const height = options.height ?? 1536;
  const alpha = options.alpha ?? false;
  const textChunks = options.textChunks ?? [];

  const colorType = alpha ? PNG_COLOR_TYPE_RGBA : PNG_COLOR_TYPE_RGB;

  const chunks: Buffer[] = [createIhdrChunk(width, height, colorType)];

  // Add text chunks before IDAT
  for (const chunk of textChunks) {
    chunks.push(createTextChunk(chunk.keyword, chunk.text));
  }

  // Add image data and end marker
  chunks.push(createIdatChunk(width, height, alpha));
  chunks.push(createIendChunk());

  // Combine signature + all chunks
  const pngData = Buffer.concat([PNG_SIG, ...chunks]);
  writeFileSync(path, pngData);
}

/**
 * Create a temporary directory for testing.
 * Returns the path to the created directory.
 */
export function createTestDir(): string {
  const randomId = randomBytes(8).toString("hex");
  const dir = `/tmp/test-metadata-${randomId}`;
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Clean up a temporary test directory.
 */
export function cleanupTestDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

/**
 * Sample ComfyUI prompt JSON with typical KSampler workflow.
 * Includes:
 * - KSampler with seed:1234567890, steps:30, cfg:7.0, sampler_name:"dpmpp_2m", scheduler:"karras"
 * - CheckpointLoaderSimple with ckpt_name:"anima-xl.safetensors"
 * - LoraLoader with lora_name:"detail_enhancer.safetensors"
 * - Two CLIPTextEncode nodes (positive and negative prompts)
 * - EmptyLatentImage with 1024x1536 resolution
 */
export const SAMPLE_PROMPT_JSON = JSON.stringify({
  "1": {
    class_type: "CheckpointLoaderSimple",
    inputs: {
      ckpt_name: "anima-xl.safetensors",
    },
  },
  "2": {
    class_type: "CLIPTextEncode",
    inputs: {
      text: "1girl, solo, long hair, blue eyes, school uniform",
      clip: ["1", 1],
    },
  },
  "3": {
    class_type: "CLIPTextEncode",
    inputs: {
      text: "bad anatomy, worst quality, low quality, blurry",
      clip: ["1", 1],
    },
  },
  "4": {
    class_type: "KSampler",
    inputs: {
      seed: 1234567890,
      steps: 30,
      cfg: 7.0,
      sampler_name: "dpmpp_2m",
      scheduler: "karras",
      denoise: 1.0,
      model: ["1", 0],
      positive: ["2", 0],
      negative: ["3", 0],
      clip: ["1", 1],
    },
  },
  "5": {
    class_type: "LoraLoader",
    inputs: {
      lora_name: "detail_enhancer.safetensors",
      strength_model: 1.0,
      strength_clip: 1.0,
      model: ["1", 0],
      clip: ["1", 1],
    },
  },
  "6": {
    class_type: "EmptyLatentImage",
    inputs: {
      width: 1024,
      height: 1536,
      batch_size: 1,
    },
  },
});

/**
 * Sample workflow JSON for ComfyUI.
 */
export const SAMPLE_WORKFLOW_JSON = JSON.stringify({
  nodes: [
    {
      type: "CheckpointLoaderSimple",
      widgets_values: ["anima-xl.safetensors"],
    },
    {
      type: "CLIPTextEncode",
      widgets_values: ["1girl, solo, long hair, blue eyes, school uniform"],
    },
    {
      type: "CLIPTextEncode",
      widgets_values: ["bad anatomy, worst quality, low quality, blurry"],
    },
    {
      type: "KSampler",
      widgets_values: [
        1234567890,
        "randomize",
        30,
        7.0,
        "dpmpp_2m",
        "karras",
        1.0,
      ],
    },
    {
      type: "LoraLoader",
      widgets_values: ["detail_enhancer.safetensors", 1.0, 1.0],
    },
    {
      type: "EmptyLatentImage",
      widgets_values: [1024, 1536, 1],
    },
  ],
});
