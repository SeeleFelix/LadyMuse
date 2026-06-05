# Gallery Redesign — Plan 2: FileSyncService

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current file watcher with a robust FileSyncService that keeps the database in sync with disk — detecting new files, deletions, and modifications in real-time with periodic validation fallback.

**Architecture:** New `FileSyncService` class using chokidar for reliable cross-platform file watching. Handles add/unlink/change events with debounce, broadcasts all changes via SSE, and runs periodic reconciliation as a safety net. Startup scan reconciles any drift since last run.

**Tech Stack:** chokidar, Drizzle ORM, better-sqlite3, SSE (Server-Sent Events), Vitest

**Depends on:** Plan 1 (schema + metadata extraction)

**Enables:** Plan 3 (GalleryQueryService), Plan 4 (UI Components)

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/server/file-sync-service.ts` | FileSyncService class |
| Replace | `src/lib/server/comfyui-watcher.ts` | Keep as thin compat layer, delegates to FileSyncService |
| Modify | `src/routes/api/comfyui/watch/+server.ts` | Support all event types |
| Modify | `src/routes/api/comfyui/delete/+server.ts` | Broadcast deletions via FileSyncService |
| Create | `src/lib/server/__tests__/file-sync-service.test.ts` | Tests |

---

### Task 1: Install chokidar

**Files:** `package.json`

- [ ] **Step 1: Install chokidar**

Run: `npm install chokidar`

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add chokidar dependency for file watching"
```

---

### Task 2: Create FileSyncService

**Files:**
- Create: `src/lib/server/file-sync-service.ts`

The FileSyncService class must:

1. **Constructor**: Accept output directory path and options (debounceMs, validationIntervalMs)
2. **start()**: Start chokidar watcher + periodic validation timer
3. **stop()**: Stop watcher + timer
4. **subscribe(fn)**: Register subscriber for file events. Returns unsubscribe function. Auto-starts on first subscriber, auto-stops on last unsubscribe.
5. **broadcast(event)**: Send event to all subscribers
6. **handleFileAdded(relativePath)**: Extract metadata via `upsertImageMetadata`, broadcast `{ type: "add", path }`
7. **handleFileDeleted(relativePath)**: Mark record as `isMissing = true` in database, broadcast `{ type: "delete", path }`
8. **handleFileChanged(relativePath)**: Re-extract metadata via `upsertImageMetadata`, broadcast `{ type: "modify", path }`
9. **reconcileOnStartup()**: Scan all files on disk, compare with database. Upsert new files, mark missing ones.
10. **runPeriodicValidation()**: Check recently modified files only (files with fileModifiedAt in last N minutes)

**Event type**: `{ type: "add" | "delete" | "modify", path: string }`

**Subscriber type**: `(event: { type: string; path: string }) => void`

Implementation details:
- Use chokidar with `ignoreInitial: false` (detect existing files on start)
- Filter to supported formats: PNG, JPG, JPEG, WebP
- Ignore files starting with `_` (matching existing behavior from comfyui-browser.ts)
- 500ms debounce per event type (batch rapid changes)
- Periodic validation: configurable interval, default 5 minutes
- For periodic validation: query database for files NOT modified in last N minutes that are NOT missing, check if they still exist on disk

- [ ] **Step 1: Create the file**

Create `src/lib/server/file-sync-service.ts` implementing all of the above.

Key imports:
```typescript
import { watch } from "chokidar";
import { statSync, existsSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { db } from "./db";
import { imageAttributes } from "./db/schema";
import { eq, isFalse, sql, and } from "drizzle-orm";
import { upsertImageMetadata } from "./metadata-extractor";
import { getOutputDir } from "./comfyui-browser";
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/file-sync-service.ts
git commit -m "feat: FileSyncService with chokidar watcher and periodic validation"
```

---

### Task 3: Update comfyui-watcher.ts as compat layer

**Files:**
- Modify: `src/lib/server/comfyui-watcher.ts`

The current watcher is imported by `src/routes/api/comfyui/watch/+server.ts`. We need to keep the `subscribe` API but delegate to FileSyncService.

Replace the entire implementation with a thin wrapper:

```typescript
import { FileSyncService } from "./file-sync-service";

let service: FileSyncService | null = null;

async function getService(): Promise<FileSyncService> {
  if (!service) {
    service = new FileSyncService();
    await service.start();
  }
  return service;
}

type Subscriber = (path: string) => void;

export function subscribe(fn: Subscriber): () => void {
  const wrappedFn = (event: { type: string; path: string }) => {
    fn(event.path);
  };

  // Start service lazily and subscribe
  let unsub: (() => void) | null = null;
  getService().then((svc) => {
    unsub = svc.subscribe(wrappedFn);
  });

  return () => {
    unsub?.();
  };
}
```

Note: This is a temporary compat layer. The SSE endpoint will be updated in Task 4 to use the full event type.

- [ ] **Step 1: Replace implementation**

- [ ] **Step 2: Run existing tests to verify nothing broke**

Run: `npx vitest run --reporter=verbose`

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/comfyui-watcher.ts
git commit -m "refactor: comfyui-watcher delegates to FileSyncService"
```

---

### Task 4: Update SSE endpoint for all event types

**Files:**
- Modify: `src/routes/api/comfyui/watch/+server.ts`

Update to use FileSyncService directly (not the compat layer) and broadcast all event types:

```typescript
import type { RequestHandler } from "./$types";
import { FileSyncService } from "$lib/server/file-sync-service";

export const GET: RequestHandler = async ({ request }) => {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const service = new FileSyncService();
      await service.start();

      const send = (event: { type: string; path: string }) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          unsubscribe();
        }
      };

      const unsubscribe = service.subscribe(send);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 30_000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        service.stop();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
```

- [ ] **Step 1: Update the endpoint**

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/comfyui/watch/+server.ts
git commit -m "feat: SSE endpoint broadcasts add/delete/modify events"
```

---

### Task 5: Update delete endpoint to broadcast via FileSyncService

**Files:**
- Modify: `src/routes/api/comfyui/delete/+server.ts`

After deleting, broadcast the deletion event via the shared FileSyncService instance. Also add support for batch deletion (array of paths).

The delete endpoint currently:
1. Deletes file from filesystem
2. Cleans up database records

We need to add: broadcast `{ type: "delete", path }` to all connected clients.

Import the FileSyncService singleton from comfyui-watcher.ts or create a shared instance.

- [ ] **Step 1: Update delete endpoint**

Add import and broadcast after successful deletion:
```typescript
import { broadcastDeletion } from "$lib/server/file-sync-service";
```

After the database cleanup, call `broadcastDeletion(relative_path)`.

In `file-sync-service.ts`, add a module-level broadcast function that the singleton service exposes:
```typescript
let instance: FileSyncService | null = null;
export function broadcastDeletion(path: string): void {
  instance?.broadcast({ type: "delete", path });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/comfyui/delete/+server.ts src/lib/server/file-sync-service.ts
git commit -m "feat: broadcast deletion events to all connected clients"
```

---

### Task 6: Write tests for FileSyncService

**Files:**
- Create: `src/lib/server/__tests__/file-sync-service.test.ts`

Test the FileSyncService logic without actually starting chokidar (test the reconciliation and event handling logic in isolation):

1. **reconcileOnStartup**: Create temp dir with test PNG files, call reconcile, verify database records created with correct metadata
2. **reconcileOnStartup marks missing files**: Insert a fake DB record for a non-existent file, call reconcile, verify `isMissing = true`
3. **handleFileAdded**: Add a test PNG, call handleFileAdded, verify database record created
4. **handleFileChanged**: Modify mtime of existing file, call handleFileChanged, verify metadata updated
5. **handleFileDeleted**: Create DB record, call handleFileDeleted, verify isMissing = true
6. **broadcast**: Subscribe, trigger event, verify subscriber received it
7. **debounce**: Rapidly add multiple files, verify they're batched

Note: These tests should test the service logic directly (not chokidar integration). They can use the test PNG fixtures from Plan 1.

- [ ] **Step 1: Write tests**

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/lib/server/__tests__/file-sync-service.test.ts --reporter=verbose`

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/__tests__/file-sync-service.test.ts
git commit -m "test: FileSyncService reconciliation and event handling"
```

---

### Task 7: Integration verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run --reporter=verbose`

- [ ] **Step 2: Start dev server and verify**

Run: `npm run dev`
- Navigate to `/generations`
- Verify images display correctly
- Verify new images appear in real-time when ComfyUI generates them
- Verify deleted images disappear from UI

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes for FileSyncService"
```
