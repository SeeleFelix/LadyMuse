import { statSync } from "node:fs";
import { openSync, readSync, closeSync } from "node:fs";
import { Buffer } from "node:buffer";
import type { ComfyUIMetadata, SamplerInfo } from "./png-metadata.js";
import {
  extractPngTextChunks,
  parseComfyUIPngMetadata,
  readPngDimensions,
} from "./png-metadata.js";

// PNG color type values from IHDR
const PNG_COLOR_TYPE_GRAYSCALE = 0;
const PNG_COLOR_TYPE_RGB = 2;
const PNG_COLOR_TYPE_PALETTE = 3;
const PNG_COLOR_TYPE_GRAYSCALE_ALPHA = 4;
const PNG_COLOR_TYPE_RGBA = 6;

export interface ExtractedImageMetadata {
  // Raw PNG text chunks preserved
  rawChunks: Array<{ type: string; keyword: string; text: string }>;

  // Extracted from ComfyUI metadata
  models: string[];
  loras: string[];
  samplers: string[];
  schedulers: string[];
  positivePrompt: string;
  negativePrompt: string;

  // Sampler parameters from first sampler
  steps: number | null;
  cfgScale: number | null;
  seed: number | null;

  // Image dimensions and properties
  width: number | null;
  height: number | null;
  aspectRatio: number;
  aspectRatioClass: "portrait" | "landscape" | "square";

  // File properties
  fileSize: number;
  fileFormat: string;
  colorSpace: string;
  hasAlpha: boolean;

  // Timestamp
  fileModifiedAt: string;

  // Raw ComfyUI prompt JSON for "Send to ComfyUI"
  metadataJson: string | null;
}

/**
 * Classify aspect ratio into portrait, landscape, or square.
 * Uses thresholds: portrait < 0.95, landscape > 1.05, else square.
 */
export function classifyAspectRatio(
  ratio: number,
): "portrait" | "landscape" | "square" {
  if (ratio < 0.95) return "portrait";
  if (ratio > 1.05) return "landscape";
  return "square";
}

/**
 * Detect file format from extension.
 * Returns "png", "jpeg", or "webp". Returns "unknown" for unrecognized extensions.
 */
export function detectFileFormat(filePath: string): string {
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf("."));
  if (ext === ".png") return "png";
  if (ext === ".jpg" || ext === ".jpeg") return "jpeg";
  if (ext === ".webp") return "webp";
  return "unknown";
}

/**
 * Extract sampler parameters from the first sampler in the metadata.
 * Returns an object with seed, steps, and cfg from the primary sampler.
 */
export function extractFirstSampler(samplers: SamplerInfo[]): {
  seed: number | null;
  steps: number | null;
  cfg: number | null;
} {
  if (samplers.length === 0) {
    return { seed: null, steps: null, cfg: null };
  }
  const first = samplers[0];
  return {
    seed: first.seed,
    steps: first.steps,
    cfg: first.cfg,
  };
}

/**
 * Detect if a PNG file has an alpha channel by reading the IHDR color type byte.
 * Returns true for grayscale+alpha (4) or RGBA (6).
 */
export function detectPngAlpha(filePath: string): boolean {
  try {
    const fd = openSync(filePath, "r");
    try {
      const buf = Buffer.alloc(25);
      const n = readSync(fd, buf, 0, 25, null);
      if (n < 25) return false;

      const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      if (!buf.subarray(0, 8).equals(PNG_SIG)) return false;

      const ihdrLen = buf.readUInt32BE(8);
      if (ihdrLen !== 13) return false;

      if (buf.subarray(12, 16).toString("ascii") !== "IHDR") return false;

      const colorType = buf[24];
      return (
        colorType === PNG_COLOR_TYPE_GRAYSCALE_ALPHA ||
        colorType === PNG_COLOR_TYPE_RGBA
      );
    } finally {
      closeSync(fd);
    }
  } catch {
    return false;
  }
}

/**
 * Extract comprehensive metadata from an image file.
 * For PNG files with ComfyUI metadata, extracts all available information.
 * For other formats, only basic file properties are extracted.
 */
export function extractImageMetadata(filePath: string): ExtractedImageMetadata {
  const stats = statSync(filePath);
  const fileFormat = detectFileFormat(filePath);

  let rawChunks: ExtractedImageMetadata["rawChunks"] = [];
  let comfyMetadata: ComfyUIMetadata | null = null;
  let dimensions = {
    width: null as number | null,
    height: null as number | null,
  };

  if (fileFormat === "png") {
    rawChunks = extractPngTextChunks(filePath);
    comfyMetadata = parseComfyUIPngMetadata(filePath);
    const pngDims = readPngDimensions(filePath);
    if (pngDims) {
      dimensions = pngDims;
    }
  }

  // Extract models, LoRAs, and sampler names from ComfyUI metadata
  const models = comfyMetadata?.models ?? [];
  const loras = comfyMetadata?.loras ?? [];
  const samplers =
    comfyMetadata?.samplers
      .map((s) => s.samplerName)
      .filter((s): s is string => s !== null) ?? [];
  const schedulers =
    comfyMetadata?.samplers
      .map((s) => s.scheduler)
      .filter((s): s is string => s !== null) ?? [];

  // Join prompts (deduplicate while preserving order)
  const positivePrompt = Array.from(
    new Set(comfyMetadata?.positivePrompts ?? []),
  ).join("\n");
  const negativePrompt = Array.from(
    new Set(comfyMetadata?.negativePrompts ?? []),
  ).join("\n");

  // Extract first sampler parameters
  const {
    seed,
    steps,
    cfg: cfgScale,
  } = extractFirstSampler(comfyMetadata?.samplers ?? []);

  // Calculate aspect ratio
  const width = dimensions.width ?? comfyMetadata?.width ?? null;
  const height = dimensions.height ?? comfyMetadata?.height ?? null;
  const aspectRatio = width && height && height !== 0 ? width / height : 1;
  const aspectRatioClass = classifyAspectRatio(aspectRatio);

  // Detect alpha for PNG
  const hasAlpha = fileFormat === "png" ? detectPngAlpha(filePath) : false;

  // Color space from format
  const colorSpace = fileFormat === "png" ? "sRGB" : "sRGB";

  return {
    rawChunks,
    models,
    loras,
    samplers,
    schedulers,
    positivePrompt,
    negativePrompt,
    steps,
    cfgScale,
    seed,
    width,
    height,
    aspectRatio,
    aspectRatioClass,
    fileSize: stats.size,
    fileFormat,
    colorSpace,
    hasAlpha,
    fileModifiedAt: stats.mtime.toISOString(),
    metadataJson: comfyMetadata?.rawPromptJson ?? null,
  };
}
