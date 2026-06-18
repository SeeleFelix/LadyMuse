import sharp from "sharp";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const THUMBNAIL_DIR = resolve(process.cwd(), "data", "thumbnails");
const MAX_DIMENSION = 400;
const WEBP_QUALITY = 80;

function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function getThumbnailPath(relativePath: string): string {
  const webpPath = relativePath.replace(/\.(png|jpe?g|webp)$/i, ".webp");
  return resolve(THUMBNAIL_DIR, webpPath);
}

export function thumbnailExists(relativePath: string): boolean {
  return existsSync(getThumbnailPath(relativePath));
}

export async function generateThumbnail(
  sourcePath: string,
  relativePath: string,
): Promise<string> {
  const outputPath = getThumbnailPath(relativePath);
  ensureDir(outputPath);

  await sharp(sourcePath)
    .resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toFile(outputPath);

  return outputPath;
}
