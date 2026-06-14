import { eq, desc, sql } from "drizzle-orm";
import { join, dirname, basename, extname, resolve } from "node:path";
import { mkdirSync, renameSync, unlinkSync, existsSync } from "node:fs";
import {
  imageAttributes,
  trashedImages,
  imageTags,
  collectionImages,
} from "./db/schema";
import type { DB } from "./db";
import { clearCache } from "./comfyui-browser";
import {
  broadcastTrash,
  broadcastRestore,
  broadcastPurge,
  broadcastEmpty,
} from "./file-sync-service";

export interface TrashListItem {
  id: number;
  originalRelativePath: string;
  rating: number;
  flag: string | null;
  colorLabel: string | null;
  width: number | null;
  height: number | null;
  aspectRatio: string | null;
  fileFormat: string | null;
  deletedAt: string;
}

export interface TrashListResult {
  items: TrashListItem[];
  total: number;
}

/**
 * TrashService moves image files into <outputDir>/.trash/<id>/ and mirrors their
 * image_attributes row into trashed_images, so deleted images can be restored.
 * The active image_attributes table is hard-deleted on trash and re-inserted
 * on restore — never soft-flagged.
 */
export class TrashService {
  constructor(
    private db: DB,
    private outputDir: string,
  ) {}

  async softDeleteToTrash(relativePath: string): Promise<{ trashId: number }> {
    const absSource = resolve(this.outputDir, relativePath);
    if (!absSource.startsWith(resolve(this.outputDir))) {
      throw new Error("Invalid path");
    }
    if (!existsSync(absSource)) {
      throw new Error("Source file does not exist");
    }

    const rows = await this.db
      .select()
      .from(imageAttributes)
      .where(eq(imageAttributes.relativePath, relativePath))
      .limit(1);
    const attr = rows[0];
    if (!attr) throw new Error("No image_attributes row for path");

    const inserted = await this.db
      .insert(trashedImages)
      .values({
        originalRelativePath: relativePath,
        trashRelativePath: "",
        rating: attr.rating ?? 0,
        flag: attr.flag,
        colorLabel: attr.colorLabel,
        metadataJson: attr.metadataJson,
        width: attr.width,
        height: attr.height,
        fileFormat: attr.fileFormat,
        aspectRatio: attr.aspectRatio,
      })
      .returning({ id: trashedImages.id });
    const trashId = inserted[0].id;

    const trashDir = join(this.outputDir, ".trash", String(trashId));
    const fileBasename = basename(relativePath);
    const trashRelativePath = join(".trash", String(trashId), fileBasename);

    try {
      mkdirSync(trashDir, { recursive: true });
      renameSync(absSource, join(this.outputDir, trashRelativePath));
      await this.db
        .update(trashedImages)
        .set({ trashRelativePath })
        .where(eq(trashedImages.id, trashId));
      await this.db
        .delete(imageTags)
        .where(eq(imageTags.relativePath, relativePath));
      await this.db
        .delete(collectionImages)
        .where(eq(collectionImages.relativePath, relativePath));
      await this.db
        .delete(imageAttributes)
        .where(eq(imageAttributes.relativePath, relativePath));
    } catch (e) {
      // Best-effort: remove the orphan trash row so the trash view stays clean.
      await this.db
        .delete(trashedImages)
        .where(eq(trashedImages.id, trashId))
        .catch(() => {});
      throw e;
    }

    clearCache();
    broadcastTrash(relativePath, trashId);
    return { trashId };
  }

  async restoreFromTrash(
    trashId: number,
  ): Promise<{ restoredPath: string; renamed: boolean }> {
    const rows = await this.db
      .select()
      .from(trashedImages)
      .where(eq(trashedImages.id, trashId))
      .limit(1);
    const item = rows[0];
    if (!item) throw new Error("Trash item not found");

    const outputRoot = resolve(this.outputDir);
    const originalAbs = resolve(this.outputDir, item.originalRelativePath);
    if (!originalAbs.startsWith(outputRoot)) {
      throw new Error("Invalid original path");
    }
    const occupied = existsSync(originalAbs);
    let targetRelativePath = item.originalRelativePath;

    if (occupied) {
      // Pick a non-colliding path: <dir>/<name>_restored_<ts><ext>. When the
      // original lives at the output root, dirname() returns "." — in that
      // case we must NOT prepend a "./" or the restoredPath no longer matches
      // the user-facing relative path.
      const dir = dirname(item.originalRelativePath);
      const name = basename(
        item.originalRelativePath,
        extname(item.originalRelativePath),
      );
      const ext = extname(item.originalRelativePath);
      const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
      const suffix = `${name}_restored_${ts}${ext}`;
      targetRelativePath = dir && dir !== "." ? `${dir}/${suffix}` : suffix;
    }

    const targetAbs = resolve(this.outputDir, targetRelativePath);
    if (!targetAbs.startsWith(outputRoot)) {
      throw new Error("Invalid target path");
    }
    mkdirSync(dirname(targetAbs), { recursive: true });
    const trashAbs = resolve(this.outputDir, item.trashRelativePath);
    if (!trashAbs.startsWith(outputRoot)) {
      throw new Error("Invalid trash path");
    }
    renameSync(trashAbs, targetAbs);

    // Upsert: an isMissing=true placeholder may exist at this path; replace its fields.
    await this.db
      .insert(imageAttributes)
      .values({
        relativePath: targetRelativePath,
        rating: item.rating ?? 0,
        flag: item.flag,
        colorLabel: item.colorLabel,
        metadataJson: item.metadataJson,
        width: item.width,
        height: item.height,
        fileFormat: item.fileFormat,
        aspectRatio: item.aspectRatio,
      })
      .onConflictDoUpdate({
        target: imageAttributes.relativePath,
        set: {
          rating: item.rating ?? 0,
          flag: item.flag,
          colorLabel: item.colorLabel,
          metadataJson: item.metadataJson,
          width: item.width,
          height: item.height,
          fileFormat: item.fileFormat,
          aspectRatio: item.aspectRatio,
          isMissing: false,
        },
      });

    await this.db.delete(trashedImages).where(eq(trashedImages.id, trashId));

    broadcastRestore(targetRelativePath, occupied);
    return { restoredPath: targetRelativePath, renamed: occupied };
  }

  async purgeTrashItem(trashId: number): Promise<void> {
    const rows = await this.db
      .select()
      .from(trashedImages)
      .where(eq(trashedImages.id, trashId))
      .limit(1);
    const item = rows[0];
    if (!item) return;

    const abs = resolve(this.outputDir, item.trashRelativePath);
    if (abs.startsWith(resolve(this.outputDir)) && existsSync(abs)) {
      unlinkSync(abs);
    }
    await this.db.delete(trashedImages).where(eq(trashedImages.id, trashId));
    broadcastPurge(trashId);
  }

  async emptyTrash(): Promise<{ count: number }> {
    const all = await this.db.select().from(trashedImages).all();
    for (const item of all) {
      const abs = resolve(this.outputDir, item.trashRelativePath);
      if (abs.startsWith(resolve(this.outputDir)) && existsSync(abs)) {
        unlinkSync(abs);
      }
    }
    await this.db.delete(trashedImages).run();
    broadcastEmpty();
    return { count: all.length };
  }

  async listTrash(page: number, pageSize: number): Promise<TrashListResult> {
    const total =
      (
        await this.db.select({ c: sql<number>`count(*)` }).from(trashedImages)
      )[0]?.c ?? 0;
    const offset = (page - 1) * pageSize;
    const rows = await this.db
      .select({
        id: trashedImages.id,
        originalRelativePath: trashedImages.originalRelativePath,
        rating: trashedImages.rating,
        flag: trashedImages.flag,
        colorLabel: trashedImages.colorLabel,
        width: trashedImages.width,
        height: trashedImages.height,
        aspectRatio: trashedImages.aspectRatio,
        fileFormat: trashedImages.fileFormat,
        deletedAt: trashedImages.deletedAt,
      })
      .from(trashedImages)
      .orderBy(desc(trashedImages.deletedAt))
      .limit(pageSize)
      .offset(offset);
    return { items: rows as TrashListItem[], total };
  }

  async count(): Promise<number> {
    const row = (
      await this.db.select({ c: sql<number>`count(*)` }).from(trashedImages)
    )[0];
    return row?.c ?? 0;
  }
}
