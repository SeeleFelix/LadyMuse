import { openSync, readSync, closeSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { Buffer } from "node:buffer";

export interface SamplerInfo {
  id: string;
  classType: string;
  seed: number | null;
  steps: number | null;
  cfg: number | null;
  samplerName: string | null;
  scheduler: string | null;
  denoise: number | null;
}

export interface ComfyUIMetadata {
  positivePrompts: string[];
  negativePrompts: string[];
  models: string[];
  loras: string[];
  width: number | null;
  height: number | null;
  samplers: SamplerInfo[];
  rawPromptJson: string | null;
}

type PngTextChunk =
  | { type: "tEXt"; keyword: string; text: string }
  | { type: "iTXt"; keyword: string; text: string };

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export function readPngDimensions(
  filePath: string,
): { width: number; height: number } | null {
  try {
    const fd = openSync(filePath, "r");
    try {
      const buf = Buffer.alloc(24);
      const n = readSync(fd, buf, 0, 24, null);
      if (n < 24) return null;
      // Verify PNG signature (bytes 0-7)
      if (!buf.subarray(0, 8).equals(PNG_SIG)) return null;
      // IHDR chunk length should be 13 (bytes 8-11)
      const ihdrLen = buf.readUInt32BE(8);
      if (ihdrLen !== 13) return null;
      // Verify IHDR type (bytes 12-15)
      if (buf.subarray(12, 16).toString("ascii") !== "IHDR") return null;
      return {
        width: buf.readUInt32BE(16),
        height: buf.readUInt32BE(20),
      };
    } finally {
      closeSync(fd);
    }
  } catch {
    return null;
  }
}

export function isImageFile(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return IMAGE_EXTS.has(ext);
}

function readChunkHeader(
  fd: number,
  buf: Buffer,
): { length: number; type: string } | null {
  const n = readSync(fd, buf, 0, 8, null);
  if (n < 8) return null;
  return {
    length: buf.readUInt32BE(0),
    type: buf.subarray(4, 8).toString("ascii"),
  };
}

export function extractPngTextChunks(filePath: string): PngTextChunk[] {
  const results: PngTextChunk[] = [];
  const fd = openSync(filePath, "r");
  try {
    const sig = Buffer.alloc(8);
    readSync(fd, sig, 0, 8, null);
    if (!sig.equals(PNG_SIG)) return results;

    const headerBuf = Buffer.alloc(8);
    const readBuf = Buffer.alloc(1024 * 1024); // 1MB read buffer

    while (true) {
      const hdr = readChunkHeader(fd, headerBuf);
      if (!hdr) break;
      const { length, type } = hdr;

      if (type === "tEXt") {
        const data = readChunkData(fd, length, readBuf);
        if (data) {
          const nullIdx = data.indexOf(0);
          if (nullIdx >= 0) {
            results.push({
              type: "tEXt",
              keyword: data.subarray(0, nullIdx).toString("ascii"),
              text: data.subarray(nullIdx + 1).toString("utf-8"),
            });
          }
        }
      } else if (type === "iTXt") {
        const data = readChunkData(fd, length, readBuf);
        if (data) {
          const nullIdx = data.indexOf(0);
          if (nullIdx >= 0) {
            const keyword = data.subarray(0, nullIdx).toString("ascii");
            const compFlag = data[nullIdx + 1];
            let rest = data.subarray(nullIdx + 3);
            const langEnd = rest.indexOf(0);
            if (langEnd >= 0) {
              rest = rest.subarray(langEnd + 1);
              const transEnd = rest.indexOf(0);
              if (transEnd >= 0) {
                let textData = rest.subarray(transEnd + 1);
                let text: string;
                if (compFlag) {
                  textData = inflateSync(textData);
                  text = textData.toString("utf-8");
                } else {
                  text = textData.toString("utf-8");
                }
                results.push({ type: "iTXt", keyword, text });
              }
            }
          }
        }
      } else if (type === "IEND") {
        break;
      } else {
        // Skip this chunk's data + CRC
        skipChunkData(fd, length, readBuf);
      }
      // Skip CRC (4 bytes) after reading data
      skipBytes(fd, 4, readBuf);
    }
  } finally {
    closeSync(fd);
  }
  return results;
}

function readChunkData(fd: number, length: number, buf: Buffer): Buffer | null {
  if (length > buf.length) {
    // For very large chunks, allocate a bigger buffer
    const bigBuf = Buffer.alloc(length);
    let offset = 0;
    while (offset < length) {
      const toRead = Math.min(length - offset, bigBuf.length - offset);
      const n = readSync(fd, bigBuf, offset, toRead, null);
      if (n <= 0) return null;
      offset += n;
    }
    return bigBuf;
  }
  let offset = 0;
  while (offset < length) {
    const toRead = Math.min(length - offset, buf.length);
    const n = readSync(fd, buf, 0, toRead, null);
    if (n <= 0) return null;
    offset += n;
  }
  return buf.subarray(0, length);
}

function skipChunkData(fd: number, length: number, buf: Buffer): void {
  let remaining = length;
  while (remaining > 0) {
    const toRead = Math.min(remaining, buf.length);
    const n = readSync(fd, buf, 0, toRead, null);
    if (n <= 0) return;
    remaining -= n;
  }
}

function skipBytes(fd: number, count: number, buf: Buffer): void {
  if (count <= buf.length) {
    readSync(fd, buf, 0, count, null);
  } else {
    skipChunkData(fd, count, buf);
  }
}

const NEGATIVE_KEYWORDS = [
  "bad anatomy",
  "worst quality",
  "bad quality",
  "lowres",
  "bad hands",
  "blurry",
  "ugly",
  "deformed",
];

// ComfyUI linked inputs are arrays like ["nodeId", outputIndex] — skip them
function isLinkedInput(v: unknown): boolean {
  return Array.isArray(v);
}
function strVal(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function numVal(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

function looksLikeNegativePrompt(text: string): boolean {
  const lower = text.toLowerCase();
  return NEGATIVE_KEYWORDS.some((kw) => lower.includes(kw));
}

function extractMetadataFromPromptJson(
  rawJson: string,
): Omit<ComfyUIMetadata, "rawPromptJson"> {
  const prompt: Record<string, any> = JSON.parse(rawJson);

  const samplers: SamplerInfo[] = [];
  const models: string[] = [];
  const loras: string[] = [];
  const texts: string[] = [];
  let width: number | null = null;
  let height: number | null = null;

  for (const [nodeId, nodeData] of Object.entries(prompt)) {
    const ct: string = nodeData.class_type || "";
    const inputs: Record<string, any> = nodeData.inputs || {};

    // Samplers
    if (
      ct.includes("KSampler") &&
      !ct.includes("Guidance") &&
      !ct.includes("Config")
    ) {
      samplers.push({
        id: nodeId,
        classType: ct,
        seed: numVal(inputs.seed) ?? numVal(inputs.noise_seed) ?? null,
        steps: numVal(inputs.steps) ?? null,
        cfg: numVal(inputs.cfg) ?? null,
        samplerName: strVal(inputs.sampler_name) ?? null,
        scheduler: strVal(inputs.scheduler) ?? null,
        denoise: numVal(inputs.denoise) ?? null,
      });
    }

    // Models
    if (ct === "CheckpointLoaderSimple" || ct === "CheckpointLoader") {
      const name = strVal(inputs.ckpt_name);
      if (name) models.push(name);
    }
    if (ct === "UNETLoader") {
      const name = strVal(inputs.unet_name);
      if (name) models.push(name);
    }

    // LoRAs (standard LoraLoader nodes only; LoraManager handled via workflow JSON)
    if (ct === "LoraLoader" || ct === "LoraLoaderModelOnly") {
      const name = strVal(inputs.lora_name);
      if (name && !loras.includes(name)) loras.push(name);
    }

    // Prompts from CLIPTextEncode
    if (ct === "CLIPTextEncode") {
      const text = strVal(inputs.text);
      if (text && text.trim().length > 5) texts.push(text.trim());
    }

    // WeiLinPromptUI
    if (ct.includes("WeiLinPrompt")) {
      const pos = strVal(inputs.positive);
      if (pos && pos.trim()) texts.unshift(pos.trim());
    }

    // Resolution
    if (ct.includes("EmptyLatent") || ct.includes("EmptySD3")) {
      const w = numVal(inputs.width);
      const h = numVal(inputs.height);
      if (w) width = w;
      if (h) height = h;
    }
  }

  const negativeTexts = texts.filter(looksLikeNegativePrompt);
  const positiveTexts = texts.filter((t) => !looksLikeNegativePrompt(t));

  return {
    positivePrompts: positiveTexts,
    negativePrompts: negativeTexts,
    models,
    loras,
    width,
    height,
    samplers,
  };
}

function extractLorasFromWorkflowJson(rawJson: string): string[] {
  const workflow: {
    nodes?: Array<{ type?: string; widgets_values?: unknown[] }>;
  } = JSON.parse(rawJson);
  const loras: string[] = [];
  if (!workflow.nodes || !Array.isArray(workflow.nodes)) return loras;
  for (const node of workflow.nodes) {
    if (!node.type) continue;
    const wv = node.widgets_values;
    if (!Array.isArray(wv)) continue;

    // Standard LoraLoader: widgets_values[0] = lora_name string
    if (node.type === "LoraLoader" || node.type === "LoraLoaderModelOnly") {
      const name = typeof wv[0] === "string" ? wv[0] : null;
      if (name && !loras.includes(name)) loras.push(name);
      continue;
    }

    // LoraManager nodes: widgets_values[2] = [{ name, strength, active, ... }]
    if (node.type.includes("LoraManager")) {
      // Lora Loader (LoraManager): wv[2] is the active lora array
      if (node.type.includes("Lora Loader")) {
        const loraArr = Array.isArray(wv[2]) ? wv[2] : [];
        for (const entry of loraArr) {
          if (
            entry &&
            typeof entry === "object" &&
            entry.active !== false &&
            typeof entry.name === "string"
          ) {
            if (!loras.includes(entry.name)) loras.push(entry.name);
          }
        }
      }
      // Lora Randomizer (LoraManager): wv[1] is the selected lora array
      if (node.type.includes("Lora Randomizer")) {
        const loraArr = Array.isArray(wv[1]) ? wv[1] : [];
        for (const entry of loraArr) {
          if (
            entry &&
            typeof entry === "object" &&
            entry.active !== false &&
            typeof entry.name === "string"
          ) {
            if (!loras.includes(entry.name)) loras.push(entry.name);
          }
        }
      }
    }
  }
  return loras;
}

function extractLorasFromParametersText(text: string): string[] {
  const loras: string[] = [];
  const re = /<lora:([^:>]+)(?::(-?[\d.]+))?>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const name = match[1].trim();
    if (!loras.includes(name)) loras.push(name);
  }
  return loras;
}

export function parseComfyUIPngMetadata(
  filePath: string,
): ComfyUIMetadata | null {
  const chunks = extractPngTextChunks(filePath);

  let parametersText: string | null = null;
  let promptJson: string | null = null;
  let workflowJson: string | null = null;

  for (const chunk of chunks) {
    if (chunk.keyword === "parameters") parametersText = chunk.text;
    if (chunk.keyword === "prompt") promptJson = chunk.text;
    if (chunk.keyword === "workflow") workflowJson = chunk.text;
  }

  if (!promptJson && !parametersText && !workflowJson) return null;

  let result: Omit<ComfyUIMetadata, "rawPromptJson"> = {
    positivePrompts: [],
    negativePrompts: [],
    models: [],
    loras: [],
    width: null,
    height: null,
    samplers: [],
  };

  if (promptJson) {
    try {
      result = extractMetadataFromPromptJson(promptJson);
    } catch {
      // JSON parse failed, fall through
    }
  }

  // Fallback: try workflow JSON for LoRAs
  if (result.loras.length === 0 && workflowJson) {
    try {
      const workflowLoras = extractLorasFromWorkflowJson(workflowJson);
      if (workflowLoras.length > 0) result.loras = workflowLoras;
    } catch {
      // ignore
    }
  }

  // Fallback: parse <lora:name:weight> from parameters text
  if (result.loras.length === 0 && parametersText) {
    const textLoras = extractLorasFromParametersText(parametersText);
    if (textLoras.length > 0) result.loras = textLoras;
  }

  // If we have a parameters text chunk, prepend it as the first positive prompt
  if (parametersText) {
    result.positivePrompts = [parametersText, ...result.positivePrompts];
  }

  return { ...result, rawPromptJson: promptJson };
}
