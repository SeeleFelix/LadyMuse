import { watch, type FSWatcher } from "node:fs";
import { extname } from "node:path";
import { getOutputDir, clearCache } from "./comfyui-browser";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

type Subscriber = (path: string) => void;

let watcher: FSWatcher | null = null;
const subscribers = new Set<Subscriber>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingFiles = new Set<string>();
let starting = false;

function isImageFile(name: string): boolean {
  return IMAGE_EXTENSIONS.has(extname(name).toLowerCase());
}

async function startWatcher() {
  if (watcher || starting) return;
  starting = true;
  const outputDir = await getOutputDir();
  starting = false;
  if (!outputDir || subscribers.size === 0) return;

  try {
    watcher = watch(outputDir, { recursive: true }, (_event, filename) => {
      if (!filename || !isImageFile(filename)) return;
      pendingFiles.add(filename);

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        if (pendingFiles.size === 0) return;
        clearCache();
        const files = [...pendingFiles];
        pendingFiles = new Set();
        for (const sub of subscribers) {
          for (const f of files) sub(f);
        }
      }, 1000);
    });

    watcher.on("error", () => {
      stopWatcher();
    });
  } catch {
    watcher = null;
  }
}

function stopWatcher() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingFiles.clear();
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}

export function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn);
  if (subscribers.size === 1) startWatcher();
  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0) stopWatcher();
  };
}
