import { statSync } from "node:fs";
import { openSync, readSync, closeSync } from "node:fs";
import { Buffer } from "node:buffer";
import type { ComfyUIMetadata, SamplerInfo } from "./png-metadata";
import {
  extractPngTextChunks,
  parseComfyUIPngMetadata,
  readPngDimensions,
} from "./png-metadata";

// PNG color type values from IHDR
const PNG_COLOR_TYPE_GRAYSCALE = 0;
const PNG_COLOR_TYPE_RGB = 2;
const PNG_COLOR_TYPE_PALETTE = 3;
const PNG_COLOR_TYPE_GRAYSCALE_ALPHA = 4;
const PNG_COLOR_TYPE_RGBA = 6;

export interface ExtractedImageMetadata {
  // Raw PNG text chunks preserved
  rawChunks: { keyword: string; text: string }[];

  // Extracted from ComfyUI metadata
  extractedModels: string[];
  extractedLoras: string[];
  extractedSamplers: string[];
  extractedSchedulers: string[];
  positivePrompt: string;
  negativePrompt: string;

  // Sampler parameters from first sampler
  steps: number;
  cfgScale: number;
  seed: string;

  // Image dimensions and properties
  width: number | null;
  height: number | null;
  aspectRatio: "portrait" | "landscape" | "square" | null;

  // File properties
  fileSize: number;
  fileFormat: "PNG" | "JPG" | "WebP";
  colorSpace: string | null;
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
 * Returns "PNG", "JPG", or "WebP". Returns "PNG" as fallback for unrecognized extensions.
 */
export function detectFileFormat(filePath: string): "PNG" | "JPG" | "WebP" {
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf("."));
  if (ext === ".png") return "PNG";
  if (ext === ".jpg" || ext === ".jpeg") return "JPG";
  if (ext === ".webp") return "WebP";
  return "PNG";
}

/**
 * Extract sampler parameters from the first sampler in the metadata.
 * Returns an object with seed, steps, and cfg from the primary sampler.
 */
export function extractFirstSampler(samplers: SamplerInfo[]): {
  seed: string;
  steps: number;
  cfg: number;
} {
  if (samplers.length === 0) {
    return { seed: "0", steps: 0, cfg: 0 };
  }
  const first = samplers[0];
  return {
    seed: first.seed !== null ? String(first.seed) : "0",
    steps: first.steps ?? 0,
    cfg: first.cfg ?? 0,
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
      // Need 29 bytes: 8 (sig) + 4 (len) + 4 (type) + 13 (IHDR data)
      // Color type is at byte 25 (0-indexed), which is the 26th byte
      const buf = Buffer.alloc(29);
      const n = readSync(fd, buf, 0, 29, null);
      if (n < 29) return false;

      const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      if (!buf.subarray(0, 8).equals(PNG_SIG)) return false;

      const ihdrLen = buf.readUInt32BE(8);
      if (ihdrLen !== 13) return false;

      if (buf.subarray(12, 16).toString("ascii") !== "IHDR") return false;

      // Color type is at byte 25 (16 + 9), after bit depth at byte 24
      const colorType = buf[25];
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

  if (fileFormat === "PNG") {
    const extractedChunks = extractPngTextChunks(filePath);
    // Strip the 'type' field from chunks to match the interface
    rawChunks = extractedChunks.map(({ keyword, text }) => ({ keyword, text }));
    comfyMetadata = parseComfyUIPngMetadata(filePath);
    const pngDims = readPngDimensions(filePath);
    if (pngDims) {
      dimensions = pngDims;
    }
  }

  // Extract models, LoRAs, and sampler names from ComfyUI metadata
  const extractedModels = comfyMetadata?.models ?? [];
  const extractedLoras = comfyMetadata?.loras ?? [];
  const extractedSamplers =
    comfyMetadata?.samplers
      .map((s) => s.samplerName)
      .filter((s): s is string => s !== null) ?? [];
  const extractedSchedulers =
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

  // Calculate aspect ratio classification
  const width = dimensions.width ?? comfyMetadata?.width ?? null;
  const height = dimensions.height ?? comfyMetadata?.height ?? null;
  const aspectRatio: "portrait" | "landscape" | "square" | null =
    width && height && height !== 0
      ? classifyAspectRatio(width / height)
      : null;

  // Detect alpha for PNG
  const hasAlpha = fileFormat === "PNG" ? detectPngAlpha(filePath) : false;

  // Color space - not detected yet, always null
  const colorSpace: string | null = null;

  return {
    rawChunks,
    extractedModels,
    extractedLoras,
    extractedSamplers,
    extractedSchedulers,
    positivePrompt,
    negativePrompt,
    steps,
    cfgScale,
    seed,
    width,
    height,
    aspectRatio,
    fileSize: stats.size,
    fileFormat,
    colorSpace,
    hasAlpha,
    fileModifiedAt: stats.mtime.toISOString(),
    metadataJson: comfyMetadata?.rawPromptJson ?? null,
  };
}
