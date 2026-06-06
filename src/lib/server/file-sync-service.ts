import { watch, type FSWatcher } from "chokidar";
import { existsSync, readdirSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { db } from "./db";
import { imageAttributes } from "./db/schema";
import { eq, sql, and } from "drizzle-orm";
import { upsertImageMetadata } from "./metadata-extractor";
import { getOutputDir } from "./comfyui-browser";

const SUPPORTED_FORMATS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export type FileEvent = { type: "add" | "delete" | "modify"; path: string };

export type Subscriber = (event: FileEvent) => void;

export interface FileSyncServiceOptions {
  debounceMs?: number;
  validationIntervalMs?: number;
}

/**
 * FileSyncService monitors ComfyUI output directory for file changes.
 * Provides real-time file events via subscriber pattern and periodic validation.
 * Auto-starts on first subscriber, auto-stops on last unsubscribe.
 */
export class FileSyncService {
  private outputDir: string;
  private options: Required<FileSyncServiceOptions>;
  private watcher: FSWatcher | null = null;
  private validationTimer: ReturnType<typeof setInterval> | null = null;
  private subscribers = new Set<Subscriber>();
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> =
    new Map();

  constructor(outputDir: string, options: FileSyncServiceOptions = {}) {
    this.outputDir = outputDir;
    this.options = {
      debounceMs: options.debounceMs ?? 500,
      validationIntervalMs: options.validationIntervalMs ?? 5 * 60 * 1000, // 5 minutes
    };
  }

  /**
   * Start the file watcher and periodic validation timer.
   */
  start(): void {
    if (this.watcher) return;

    this.watcher = watch(this.outputDir, {
      ignoreInitial: true,
      persistent: true,
    });

    this.watcher
      .on("add", (path) => this.handleFileAdded(path))
      .on("unlink", (path) => this.handleFileDeleted(path))
      .on("change", (path) => this.handleFileChanged(path))
      .on("error", (error) => {
        console.error("[FileSyncService] watcher error:", error);
      });

    // Start periodic validation
    this.validationTimer = setInterval(
      () => this.runPeriodicValidation(),
      this.options.validationIntervalMs,
    );

    // Run initial reconciliation
    this.reconcileOnStartup().catch((err) => {
      console.error("[FileSyncService] startup reconcile failed:", err);
    });
  }

  /**
   * Stop the file watcher and periodic validation timer.
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    if (this.validationTimer) {
      clearInterval(this.validationTimer);
      this.validationTimer = null;
    }

    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  /**
   * Register a subscriber for file events.
   * Auto-starts on first subscriber, auto-stops on last unsubscribe.
   * Returns an unsubscribe function.
   */
  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);

    return () => {
      this.subscribers.delete(fn);
    };
  }

  /**
   * Broadcast an event to all subscribers.
   * Subscriber errors are isolated so one failing subscriber doesn't affect others.
   */
  broadcast(event: FileEvent): void {
    for (const sub of this.subscribers) {
      try {
        sub(event);
      } catch {
        // Subscriber errors should not affect other subscribers
      }
    }
  }

  /**
   * Check if a file is a supported image format.
   */
  private isSupportedImageFile(filename: string): boolean {
    const ext = extname(filename).toLowerCase();
    return SUPPORTED_FORMATS.has(ext);
  }

  /**
   * Check if a file should be ignored (starts with underscore).
   */
  private shouldIgnore(filename: string): boolean {
    const basename = filename.split("/").pop() ?? filename;
    return basename.startsWith("_");
  }

  /**
   * Handle file added event.
   */
  private handleFileAdded(absolutePath: string): void {
    const filename = relative(this.outputDir, absolutePath);

    if (!this.isSupportedImageFile(filename) || this.shouldIgnore(filename)) {
      return;
    }

    this.debounceEvent("add", filename, async () => {
      await upsertImageMetadata(filename, absolutePath);
      this.broadcast({ type: "add", path: filename });
    });
  }

  /**
   * Handle file deleted event.
   */
  private handleFileDeleted(absolutePath: string): void {
    const filename = relative(this.outputDir, absolutePath);

    if (!this.isSupportedImageFile(filename) || this.shouldIgnore(filename)) {
      return;
    }

    this.debounceEvent("delete", filename, async () => {
      await db
        .update(imageAttributes)
        .set({ isMissing: true, updatedAt: new Date().toISOString() })
        .where(eq(imageAttributes.relativePath, filename));
      this.broadcast({ type: "delete", path: filename });
    });
  }

  /**
   * Handle file changed event.
   */
  private handleFileChanged(absolutePath: string): void {
    const filename = relative(this.outputDir, absolutePath);

    if (!this.isSupportedImageFile(filename) || this.shouldIgnore(filename)) {
      return;
    }

    this.debounceEvent("modify", filename, async () => {
      await upsertImageMetadata(filename, absolutePath);
      this.broadcast({ type: "modify", path: filename });
    });
  }

  /**
   * Debounce events by type to batch rapid changes.
   */
  private debounceEvent(
    type: string,
    path: string,
    fn: () => Promise<void>,
  ): void {
    const key = `${type}:${path}`;

    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(key);
      try {
        await fn();
      } catch (err) {
        console.error(
          `[FileSyncService] error handling ${type} for ${path}:`,
          err,
        );
      }
    }, this.options.debounceMs);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Scan all files on disk during startup and reconcile with database.
   * - Upsert new files
   * - Mark missing files as isMissing = true
   */
  private async reconcileOnStartup(): Promise<void> {
    const diskFiles = new Set<string>();
    const outputDir = this.outputDir;

    // Walk output directory and collect all image files
    const walk = (dir: string): void => {
      if (!existsSync(dir)) return;
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith("_")) continue;

        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase();
          if (SUPPORTED_FORMATS.has(ext)) {
            const relPath = relative(outputDir, fullPath);
            diskFiles.add(relPath);

            // Upsert metadata for files on disk
            upsertImageMetadata(relPath, fullPath).catch((err) => {
              console.error(
                `[FileSyncService] failed to upsert ${relPath}:`,
                err,
              );
            });
          }
        }
      }
    };

    walk(this.outputDir);

    // Mark files in database but not on disk as missing
    const allRecords = await db
      .select({ relativePath: imageAttributes.relativePath })
      .from(imageAttributes);

    for (const record of allRecords) {
      if (!diskFiles.has(record.relativePath)) {
        await db
          .update(imageAttributes)
          .set({ isMissing: true, updatedAt: new Date().toISOString() })
          .where(eq(imageAttributes.relativePath, record.relativePath));
      }
    }
  }

  /**
   * Run periodic validation to check recently modified files.
   * Queries database for files NOT modified in the last N minutes that are NOT missing,
   * and checks if they still exist on disk.
   */
  private async runPeriodicValidation(): Promise<void> {
    const checkWindowMinutes = 5; // Check files not modified in last 5 minutes
    const cutoffTime = new Date(
      Date.now() - checkWindowMinutes * 60 * 1000,
    ).toISOString();

    // Find files that are NOT missing AND NOT modified recently
    const staleRecords = await db
      .select({ relativePath: imageAttributes.relativePath })
      .from(imageAttributes)
      .where(
        and(
          eq(imageAttributes.isMissing, false),
          sql`${imageAttributes.fileModifiedAt} < ${cutoffTime}`,
        ),
      );

    for (const record of staleRecords) {
      const absPath = join(this.outputDir, record.relativePath);

      if (!existsSync(absPath)) {
        // File is missing on disk, mark as missing
        await db
          .update(imageAttributes)
          .set({ isMissing: true, updatedAt: new Date().toISOString() })
          .where(eq(imageAttributes.relativePath, record.relativePath));

        this.broadcast({ type: "delete", path: record.relativePath });
      }
    }
  }
}

// Singleton promise - ensures concurrent calls share the same instance
let instancePromise: Promise<FileSyncService | null> | null = null;

/**
 * Get or create the singleton FileSyncService instance.
 * Uses promise-based singleton pattern to prevent race conditions.
 */
export async function getFileSyncService(
  options?: FileSyncServiceOptions,
): Promise<FileSyncService | null> {
  if (instancePromise) return instancePromise;

  instancePromise = (async () => {
    const outputDir = await getOutputDir();
    if (!outputDir) return null;
    const service = new FileSyncService(outputDir, options);
    service.start();
    return service;
  })();

  return instancePromise;
}

/**
 * Broadcast a deletion event to all subscribers.
 * Used by the delete endpoint to notify clients of file deletions.
 */
export function broadcastDeletion(path: string): void {
  instancePromise?.then((instance) => {
    instance?.broadcast({ type: "delete", path });
  });
}
