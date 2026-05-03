import { readdirSync, statSync, existsSync, createReadStream } from "node:fs";
import { resolve, join, extname, relative } from "node:path";
import type { RequestHandler } from "@sveltejs/kit";
import { getConfig } from "./config";
import {
  parseComfyUIPngMetadata,
  readPngDimensions,
  isImageFile,
  type ComfyUIMetadata,
} from "./png-metadata";

export interface BrowseImage {
  filename: string;
  relativePath: string;
  size: number;
  modifiedAt: string;
  width: number | null;
  height: number | null;
  metadata: ComfyUIMetadata | null;
}

export interface BrowseResult {
  images: BrowseImage[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

type SortMode = "date-desc" | "date-asc" | "name";

// Metadata cache: key = absolute path, value = { mtimeMs, metadata }
const metadataCache = new Map<
  string,
  { mtimeMs: number; metadata: ComfyUIMetadata | null }
>();

export async function getOutputDir(): Promise<string | null> {
  return getConfig("comfyui_output_dir");
}

function collectImageFiles(
  outputDir: string,
): { relativePath: string; size: number; mtimeMs: number }[] {
  const dirStat = statSync(outputDir);

  const files: { relativePath: string; size: number; mtimeMs: number }[] = [];

  function walk(dir: string) {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.name.startsWith("_") &&
        !entry.name.endsWith(".png") &&
        !entry.name.endsWith(".jpg")
      )
        continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && isImageFile(entry.name)) {
        const stat = statSync(fullPath);
        files.push({
          relativePath: relative(outputDir, fullPath),
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        });
      }
    }
  }

  walk(outputDir);
  return files;
}

export async function browseImages(
  page: number,
  pageSize: number,
  sort: SortMode,
): Promise<BrowseResult> {
  const outputDir = await getOutputDir();
  if (!outputDir || !existsSync(outputDir)) {
    return { images: [], total: 0, page, pageSize, hasMore: false };
  }

  const allFiles = collectImageFiles(outputDir);

  // Sort
  if (sort === "date-desc") {
    allFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);
  } else if (sort === "date-asc") {
    allFiles.sort((a, b) => a.mtimeMs - b.mtimeMs);
  } else {
    allFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  }

  const total = allFiles.length;
  const start = (page - 1) * pageSize;
  const pageFiles = allFiles.slice(start, start + pageSize);

  const images: BrowseImage[] = pageFiles.map((f) => {
    const absPath = resolve(outputDir, f.relativePath);

    // Check cache
    let metadata: ComfyUIMetadata | null = null;
    const cached = metadataCache.get(absPath);
    if (cached && cached.mtimeMs === f.mtimeMs) {
      metadata = cached.metadata;
    } else {
      try {
        metadata = parseComfyUIPngMetadata(absPath);
      } catch {
        metadata = null;
      }
      metadataCache.set(absPath, { mtimeMs: f.mtimeMs, metadata });
    }

    // Read actual dimensions from PNG IHDR
    const dims = absPath.toLowerCase().endsWith(".png")
      ? readPngDimensions(absPath)
      : null;

    return {
      filename: f.relativePath.split("/").pop() || f.relativePath,
      relativePath: f.relativePath,
      size: f.size,
      modifiedAt: new Date(f.mtimeMs).toISOString(),
      width: dims?.width ?? null,
      height: dims?.height ?? null,
      metadata,
    };
  });

  return {
    images,
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
  };
}

export async function resolveImagePath(
  relativePath: string,
): Promise<string | null> {
  const outputDir = await getOutputDir();
  if (!outputDir) return null;

  const absPath = resolve(outputDir, relativePath);

  // Path traversal check
  if (!absPath.startsWith(resolve(outputDir))) return null;
  if (relativePath.includes("..")) return null;

  if (!existsSync(absPath)) return null;
  return absPath;
}

export function clearCache(): void {
  metadataCache.clear();
}
