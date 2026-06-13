# Gallery Recycle Bin, Deletion Protection, and Image-Mismatch Diagnostic

**Date:** 2026-06-13
**Scope:** Three related improvements to the ComfyUI gallery in LadyMuse
1. Recycle bin (soft-delete with restore capability)
2. Backend deletion protection for curated images (pick flag or rating)
3. Diagnostic logging to locate the image-mismatch bug

---

## 1. Background

The gallery currently performs **hard deletes**: `unlinkSync` removes the file, then rows in
`image_attributes`, `image_tags`, and `collection_images` are deleted by `relativePath`. There is
no way to recover a deleted image.

Curated images (those with `flag = 'pick'` or `rating > 0`) can be deleted with a single
confirmation, risking accidental loss of rated work.

A separate, long-standing bug: the detail panel / lightbox sometimes displays an image that does
not match the selected thumbnail. The root cause is unknown.

### Schema facts that shape the design

- `image_attributes.relative_path` is the **primary key** (`src/lib/server/db/schema.ts:262`).
- `image_tags.relative_path` and `collection_images.relative_path` are **plain text columns with no
  foreign-key constraint** — they are cleaned up by explicit `DELETE WHERE relative_path = ?`.
- `rating` defaults to `0`; a rated image has `rating > 0`.
- `flag` is nullable text; the curated value is `'pick'`.

---

## 2. Recycle Bin

### 2.1 Architecture decision: independent trash table (not a soft-delete flag)

**Decision:** Move deleted records into a separate `trashed_images` table. Do **not** add a
`deletedAt` flag to `image_attributes`.

**Why not a `deletedAt` flag on `image_attributes`:** That approach requires either (a) a surrogate
primary key to allow the same `relative_path` to coexist as both an active row and one or more
soft-deleted rows, or (b) renaming the path on delete. Both pollute the working active table — (a)
via a primary-key migration that cascades into every path-based lookup, (b) by leaking `.trash/`
prefixes into path semantics. The trash feature is an isolated concern and should live in an
isolated table.

The independent trash table keeps `image_attributes` and all existing queries **completely
unchanged**. Trash bugs cannot corrupt the active gallery. The trash table has its own
auto-increment primary key, so it naturally accommodates multiple deleted versions of the same path.

### 2.2 New table: `trashed_images`

Mirrors the columns needed to display the trash view and restore the image, plus trash-specific
metadata:

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK auto-increment | Stable identity in trash; namespaces the file |
| `original_relative_path` | text not null | The path the file had when active |
| `trash_path` | text not null | `<outputDir>/.trash/<id>/<basename>` |
| `rating` | integer default 0 | Snapshot at delete time, for display |
| `flag` | text | Snapshot |
| `color_label` | text | Snapshot |
| `metadata_json` | text | Snapshot (so restore needs no re-extraction) |
| `width` / `height` | integer | Snapshot, for thumbnail aspect |
| `file_format` | text | Snapshot |
| `deleted_at` | text not null | `(datetime('now'))` |

Tags and collections associations are **not** copied to trash. They are active-management
concepts; on delete, rows in `image_tags` and `collection_images` for that `relative_path` are
deleted (unchanged from current behavior). If the image is restored, it returns without tags or
collections — the user re-curates if desired.

### 2.3 File-system layout

```
<outputDir>/
  ComfyUI_00001_.png          # active
  sub/ComfyUI_00002_.png      # active
  .trash/
    1/ComfyUI_00001_.png      # first trashed item, id=1
    2/ComfyUI_00001_.png      # a LATER file that reused the same path, id=2
```

Files are namespaced by `trashed_images.id`, so the same basename can appear any number of times
in trash without collision.

### 2.4 Operations

**Soft-delete (to trash):**
1. Resolve and validate source path via existing `resolveImagePath`.
2. Check deletion protection (see §3). If protected, abort with 409 before touching anything.
3. Copy the `image_attributes` row (relevant columns) into `trashed_images`; capture the new `id`.
4. `mkdir -p` the `.trash/<id>/` directory.
5. `rename` the file from `<outputDir>/<relativePath>` to `<outputDir>/.trash/<id>/<basename>`.
6. Hard-delete the `image_attributes` row, plus its `image_tags` and `collection_images` rows.
7. Clear the metadata cache for the path.
8. Broadcast a `trash` SSE event (new type) with the path and trash id.

**Restore:**
1. Look up the `trashed_images` row by `id`.
2. Decide target path by checking the **filesystem only** (the DB row is handled separately):
   - If a file exists at `<outputDir>/<original_relative_path>` → occupied → restore to a renamed
     path `<stem>_restored_<timestamp>.<ext>` in the same directory. The timestamp format is
     `YYYYMMDDHHmmss` for sortability and filename safety.
   - If no file exists at the original path → restore in place to `original_relative_path`.
3. Move the file from `trash_path` to the target path (`rename`).
4. Write the `image_attributes` row at the target `relative_path`: if a row already exists at that
   path (e.g. an `isMissing` placeholder), update it with the trash snapshot; otherwise insert.
5. Delete the `trashed_images` row.
6. Return `{ restoredPath, renamed: boolean }` so the UI can surface a non-blocking notice when
   renamed ("Restored as `ComfyUI_00001__restored_20260613.png`; original name was taken").
7. Broadcast a `restore` SSE event with the target path.

Restore is **never** allowed to overwrite an existing active file. The filesystem check in step 2
is the sole arbiter of whether a rename is required.

**Purge (single permanent delete from trash):**
1. `unlinkSync` the file at `trash_path`.
2. Delete the `trashed_images` row.
3. Broadcast a `purge` SSE event.

**Empty trash:**
1. Iterate all `trashed_images` rows, unlink each file, delete all rows.
2. Broadcast an `empty` SSE event. Frontend reloads the trash view.

### 2.5 Cleanup policy

**Purely manual.** No auto-expiry, no background cleanup job. Users permanently delete via purge
(single) or "empty trash" (all). The trash grows until the user acts.

### 2.6 API endpoints

| Method | Path | Body | Behavior |
|---|---|---|---|
| `DELETE` | `/api/comfyui/delete` | `{ relativePaths: string[] }` | Soft-delete to trash. Protected items cause whole-batch 409 (see §3). |
| `GET` | `/api/comfyui/trash` | — | List `trashed_images` rows, newest first, paginated. |
| `POST` | `/api/comfyui/trash/restore` | `{ id: number }` | Restore; returns `{ restoredPath, renamed: boolean }`. |
| `DELETE` | `/api/comfyui/trash/purge` | `{ id: number }` | Permanently delete one trash item. |
| `DELETE` | `/api/comfyui/trash/empty` | — | Permanently delete all trash items. |

The existing `DELETE /api/comfyui/delete` signature changes from single-path to an array to
support bulk selection. Frontend call sites are updated accordingly.

### 2.7 SSE event semantics

The existing `FileEvent` type gains four new event types. Each handler's effect is specified so the
store and any future caller agree on meaning:

| Event type | Payload | Effect on active gallery | Effect on trash state |
|---|---|---|---|
| `trash` | `{ path, trashId }` | Remove image from `images`, clear from selection, decrement pagination total (identical to current `delete` handler). | Increment `trashCount`; if trash view is open, prepend the item. |
| `restore` | `{ path, renamed }` | Reload active page (the restored image re-enters the active set). | Decrement `trashCount`; if trash view is open, remove the item. |
| `purge` | `{ trashId }` | None. | Decrement `trashCount`; if trash view is open, remove the item. |
| `empty` | — | None. | Set `trashCount = 0`; if trash view is open, clear it. |

The `trash` handler duplicates the current `delete` handler's gallery-removal logic on purpose:
from the active gallery's perspective, soft-deleting to trash means the image is gone from view.
The trash count is the only additional side effect.

### 2.8 Frontend

- **Trash entry:** An icon button in the gallery header showing the current trash count. Clicking
  switches the gallery into "trash view" mode.
- **Trash view:** Reuses `VirtualGrid` and `ThumbnailCard`. Each card overlays the delete timestamp
  and two buttons: "恢复" (restore) and "彻底删除" (purge). Rating/pick/flag actions are hidden in
  trash view — trash items are not curated.
- **Empty-trash button** at the top of trash view, with a confirmation dialog.
- **Store changes:** `gallery-store` gains a `viewMode: 'gallery' | 'trash'` state and a `trashCount`
  reactive field. The `handleSSEEvent` function handles the new `trash`/`restore`/`purge`/
  `empty` event types to update counts and refresh the active list when needed.
- **Restore notice:** On restore, if the response indicates `renamed: true`, show a non-blocking
  toast naming the new path.

### 2.9 Path-traversal safety

The `.trash` directory lives under `<outputDir>`, so the existing `resolveImagePath` traversal
checks cover it. Trash paths are constructed server-side from the auto-increment `id` and the
basename — never from client-supplied free text — so a client cannot direct a restore or purge at
an arbitrary filesystem location.

---

## 3. Deletion Protection for Curated Images

### 3.1 Rule

The `DELETE /api/comfyui/delete` endpoint, **before** performing any file or DB mutation, checks
every requested path in `image_attributes`:

- If **any** path has `flag = 'pick'` **or** `rating > 0`, the **entire batch is rejected** with
  `409 Conflict`. No file is moved, no row is touched.

The response body lists the offending paths and their reasons:

```json
{
  "error": "protected",
  "protected": [
    { "relativePath": "ComfyUI_00001_.png", "reason": "pick" },
    { "relativePath": "sub/ComfyUI_00002_.png", "reason": "rating" }
  ]
}
```

### 3.2 Scope of protection

Protection gates **entry to trash only**. Once an image is in `trashed_images`:
- `POST /api/comfyui/trash/restore` — not protected (it is returning to active).
- `DELETE /api/comfyui/trash/purge` — not protected (deliberate permanent action).
- `DELETE /api/comfyui/trash/empty` — not protected (deliberate, confirmed bulk action).

Rationale: the protection exists to prevent **accidental** loss of curated work during normal
gallery use. Permanent deletion from trash is an explicit, separately-confirmed action; gating it
would make the trash impossible to clear.

### 3.3 Bulk-delete behavior

**Whole-batch rejection.** If the user selects 50 images and one has a pick flag, the entire batch
is rejected and the response lists every protected path. The user must clear the pick/rating on
those specific images (or deselect them) before retrying. This is strict, but predictable — partial
success would silently leave curated images in an ambiguous half-deleted state.

### 3.4 Frontend feedback

On a 409 response, the gallery shows a toast:
> "N 张图片受保护（pick/评分），未删除。请先取消标记。" followed by the list of paths.

The user then manually unflags / clears the rating on those images and retries.

---

## 4. Image-Mismatch Bug: Diagnostic Phase

### 4.1 Strategy

**Do not guess the fix.** Add minimal, unified-prefix logging at four points covering the full
selection-to-render data flow. The user reproduces the bug once and pastes the console output; the
root cause is then identifiable from the log sequence.

### 4.2 Log points

All logs use the prefix `[img-debug]` so they can be grepped and later removed in one pass.

1. **`gallery-store.ts` → `select(path)` entry**
   - Log: incoming `path`, current `images.length`, the index of `path` in `images` (or `-1`),
     current `activeImage?.relativePath`.

2. **`activeImage` assignment**
   - Log: the value returned by `images.find(...)`, before and after assignment. Confirms whether
     `find` returns the expected object or `null`, and whether a concurrent change to `images`
     shifted the result.

3. **`DetailPanel.svelte` `image` prop change**
   - Log: the received `image.relativePath` and the constructed image URL. Confirms what the panel
     is actually rendering, independent of what the store believes is active.

4. **`handleSSEEvent` handling of `delete` / `add`**
   - Log: the event payload and any mutation applied to `images` or `activeImage`. Confirms whether
     an SSE event fired between user actions and silently invalidated `activeImage`.

### 4.3 Expected outcome

A single reproduction with the four log points produces a trace that pinpoints the failure stage
(e.g., "`select` was called with the right path, but `find` returned `null` because an SSE delete
had removed it from `images` one tick earlier"). The fix is then targeted, not speculative.

### 4.4 Removal

Diagnostic logs are removed (or gated behind a dev-only flag) once the root cause is confirmed and
fixed. They are not part of the permanent feature surface.

---

## 5. Implementation Phasing

The three pieces are independent and should be implemented and reviewed separately:

1. **Phase 1 — Deletion protection** (§3). Smallest, touches only the existing delete endpoint and
   frontend toast. Land first; it is pure safety with no schema change.
2. **Phase 2 — Recycle bin** (§2). Largest; adds the `trashed_images` table, new endpoints, file
   moves, trash view, and new SSE event types.
3. **Phase 3 — Image-mismatch diagnostic** (§4). Tiny, additive logging. Can land in parallel with
   Phase 1 or 2; the resulting fix is a separate follow-up once the trace is captured.

### 5.1 Database change protocol

Phase 2 introduces a new table and therefore a **Drizzle migration**. The project's DB protocol
requires two steps around any schema change:

1. **Back up the database first.** Before running a migration or any destructive DB operation,
   copy `./ladymuse.db` to `./ladymuse.db.bak.<YYYYMMDDHHmmSS>`.
2. **Go through a Drizzle migration.** Author the new table in `./src/lib/server/db/schema.ts`,
   then generate the next numbered migration into `./drizzle/` (following the current latest,
   `0017_fast_indices.sql`). Never edit the live DB with ad-hoc SQL.

The implementation plan must call out the backup step explicitly before the `drizzle-kit migrate`
command, so it cannot be skipped.

---

## 6. Out of Scope

- Auto-expiry of trash items (explicitly rejected — manual cleanup only).
- Tags/collections preservation through delete→restore (re-curation is the user's job).
- Migrating the existing `isMissing` mechanism. It remains as-is for externally-deleted files and
  is unrelated to the trash.
- The actual code fix for the image-mismatch bug — this spec covers diagnosis only.
