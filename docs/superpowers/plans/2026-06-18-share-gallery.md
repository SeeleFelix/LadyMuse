# Share Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only, password-protected gallery at `/share` showing only rated or picked images.

**Architecture:** Isolated route at `/share` with its own page, components, and API endpoints. Password verified via POST endpoint, stored as httpOnly cookie. Thumbnails lazy-generated with sharp and cached to `data/thumbnails/`. Full images served via existing API. No existing code modified.

**Tech Stack:** SvelteKit, Drizzle ORM + SQLite, sharp, Tailwind CSS

---

### Task 1: Install sharp dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install sharp**

```bash
cd /home/narcissus/Workspace/LadyMuse && npm install sharp
```

- [ ] **Step 2: Verify install**

```bash
node -e "const sharp = require('sharp'); console.log('sharp version:', sharp.versions);"
```
Expected: prints sharp version info without error.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add sharp for thumbnail generation"
```

---

### Task 2: Create thumbnail service

**Files:**
- Create: `src/lib/server/thumbnail-service.ts`

- [ ] **Step 1: Create thumbnail service**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/thumbnail-service.ts
git commit -m "feat: add thumbnail generation service"
```

---

### Task 3: Create password verify API

**Files:**
- Create: `src/routes/api/share/verify/+server.ts`

- [ ] **Step 1: Create verify endpoint**

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const SHARE_PASSWORD = "jiejiejie";
const COOKIE_NAME = "share_auth";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export const POST: RequestHandler = async ({ request, cookies }) => {
  const body = await request.json();
  const password = body.password as string;

  if (password !== SHARE_PASSWORD) {
    return json({ error: "Incorrect password" }, { status: 401 });
  }

  cookies.set(COOKIE_NAME, "1", {
    httpOnly: true,
    path: "/share",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
  });

  return json({ success: true });
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/share/verify/+server.ts
git commit -m "feat: add share password verify API"
```

---

### Task 4: Create share browse API

**Files:**
- Create: `src/routes/api/share/browse/+server.ts`

- [ ] **Step 1: Create browse endpoint**

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { imageAttributes } from "$lib/server/db/schema";
import { eq, or, gt, lt, and, desc } from "drizzle-orm";

const DEFAULT_LIMIT = 50;

interface CursorData {
  modified_at: string;
  path: string;
}

function decodeCursor(cursor: string | null): CursorData | null {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

function encodeCursor(image: {
  fileModifiedAt: string | null;
  relativePath: string;
}): string {
  return Buffer.from(
    JSON.stringify({
      modified_at: image.fileModifiedAt,
      path: image.relativePath,
    }),
  ).toString("base64url");
}

export const GET: RequestHandler = async ({ url }) => {
  const cursorParam = url.searchParams.get("cursor");
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || String(DEFAULT_LIMIT)),
    100,
  );

  const cursor = decodeCursor(cursorParam);

  const conditions = [
    or(gt(imageAttributes.rating, 0), eq(imageAttributes.flag, "pick")),
    eq(imageAttributes.isMissing, false),
  ];

  // DESC order: newer items first. Cursor marks the last item of current page.
  // Next page needs items "less than" cursor (older or same-time-but-lower-path).
  if (cursor) {
    conditions.push(
      or(
        lt(imageAttributes.fileModifiedAt, cursor.modified_at),
        and(
          eq(imageAttributes.fileModifiedAt, cursor.modified_at),
          lt(imageAttributes.relativePath, cursor.path),
        ),
      ),
    );
  }

  const images = await db
    .select()
    .from(imageAttributes)
    .where(and(...conditions))
    .orderBy(
      desc(imageAttributes.fileModifiedAt),
      desc(imageAttributes.relativePath),
    )
    .limit(limit + 1);

  const hasMore = images.length > limit;
  if (hasMore) images.pop();

  const nextCursor =
    images.length > 0 ? encodeCursor(images[images.length - 1]) : null;

  return json({ images, nextCursor, hasMore });
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/share/browse/+server.ts
git commit -m "feat: add share browse API with rating/pick filter"
```

---

### Task 5: Create thumbnail API endpoint

**Files:**
- Create: `src/routes/api/share/thumbnails/[...path]/+server.ts`

- [ ] **Step 1: Create thumbnail serving endpoint**

```typescript
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { resolveImagePath } from "$lib/server/comfyui-browser";
import { existsSync, createReadStream, statSync } from "node:fs";
import { extname } from "node:path";
import {
  generateThumbnail,
  getThumbnailPath,
  thumbnailExists,
} from "$lib/server/thumbnail-service";

export const GET: RequestHandler = async ({ params }) => {
  const relativePath = decodeURIComponent(params.path);
  const absPath = await resolveImagePath(relativePath);

  if (!absPath || !existsSync(absPath)) {
    return json({ error: "Not found" }, { status: 404 });
  }

  if (!thumbnailExists(relativePath)) {
    try {
      await generateThumbnail(absPath, relativePath);
    } catch {
      return json({ error: "Failed to generate thumbnail" }, { status: 500 });
    }
  }

  const thumbPath = getThumbnailPath(relativePath);
  const stat = statSync(thumbPath);
  const stream = createReadStream(thumbPath);

  return new Response(stream as any, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=604800",
      "Content-Length": stat.size.toString(),
    },
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/share/thumbnails/\[...path\]/+server.ts
git commit -m "feat: add share thumbnail API with lazy generation"
```

---

### Task 6: Create share page server loader

**Files:**
- Create: `src/routes/share/+page.server.ts`

- [ ] **Step 1: Create page server**

```typescript
import type { PageServerLoad } from "./$types";
import { db } from "$lib/server/db";
import { imageAttributes } from "$lib/server/db/schema";
import { eq, or, gt, and, desc } from "drizzle-orm";

const COOKIE_NAME = "share_auth";

export const load: PageServerLoad = async ({ cookies }) => {
  const authed = cookies.get(COOKIE_NAME);

  if (!authed) {
    return { authenticated: false as const, images: [] };
  }

  const images = await db
    .select()
    .from(imageAttributes)
    .where(
      and(
        or(gt(imageAttributes.rating, 0), eq(imageAttributes.flag, "pick")),
        eq(imageAttributes.isMissing, false),
      ),
    )
    .orderBy(
      desc(imageAttributes.fileModifiedAt),
      desc(imageAttributes.relativePath),
    )
    .limit(50);

  const nextCursor =
    images.length > 0
      ? Buffer.from(
          JSON.stringify({
            modified_at: images[images.length - 1].fileModifiedAt,
            path: images[images.length - 1].relativePath,
          }),
        ).toString("base64url")
      : null;

  return {
    authenticated: true as const,
    images: images.map((img) => ({
      ...img,
      metadataJson: undefined,
    })),
    nextCursor,
    hasMore: images.length >= 50,
  };
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/share/+page.server.ts
git commit -m "feat: add share page server with auth check and initial data"
```

---

### Task 7: Create PasswordGate component

**Files:**
- Create: `src/lib/components/share/PasswordGate.svelte`

- [ ] **Step 1: Create PasswordGate**

```svelte
<script lang="ts">
  let password = "";
  let error = "";
  let loading = false;

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!password) return;

    loading = true;
    error = "";

    try {
      const res = await fetch("/api/share/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        window.location.reload();
      } else {
        error = "密码错误";
      }
    } catch {
      error = "网络错误，请重试";
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-zinc-950">
  <form
    onsubmit={handleSubmit}
    class="w-full max-w-sm mx-4 p-8 rounded-xl bg-zinc-900 border border-zinc-800 space-y-6"
  >
    <div class="text-center">
      <h1 class="text-xl font-semibold text-zinc-100">需要密码</h1>
      <p class="text-sm text-zinc-500 mt-1">输入密码以查看分享内容</p>
    </div>

    <div class="space-y-3">
      <input
        type="password"
        bind:value={password}
        placeholder="密码"
        autocomplete="off"
        disabled={loading}
        class="w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 text-center"
      />

      {#if error}
        <p class="text-red-400 text-sm text-center">{error}</p>
      {/if}

      <button
        type="submit"
        disabled={loading}
        class="w-full py-2.5 rounded-lg bg-zinc-100 text-zinc-900 font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors"
      >
        {loading ? "验证中..." : "确认"}
      </button>
    </div>
  </form>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/share/PasswordGate.svelte
git commit -m "feat: add PasswordGate component for share page"
```

---

### Task 8: Create ShareCard component

**Files:**
- Create: `src/lib/components/share/ShareCard.svelte`

- [ ] **Step 1: Create ShareCard**

```svelte
<script lang="ts">
  interface Props {
    relativePath: string;
    index: number;
    onclick: (index: number) => void;
  }

  let { relativePath, index, onclick }: Props = $props();

  function getThumbnailUrl(): string {
    return `/api/share/thumbnails/${encodeURIComponent(relativePath)}`;
  }
</script>

<button
  onclick={() => onclick(index)}
  class="aspect-square bg-zinc-900 rounded-lg overflow-hidden cursor-pointer border border-zinc-800 hover:border-zinc-600 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500"
>
  <img
    src={getThumbnailUrl()}
    alt=""
    loading="lazy"
    class="w-full h-full object-contain"
  />
</button>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/share/ShareCard.svelte
git commit -m "feat: add ShareCard component"
```

---

### Task 9: Create ShareLightbox component

**Files:**
- Create: `src/lib/components/share/ShareLightbox.svelte`

- [ ] **Step 1: Create ShareLightbox**

```svelte
<script lang="ts">
  import { onMount } from "svelte";

  interface Image {
    relativePath: string;
  }

  interface Props {
    images: Image[];
    currentIndex: number;
    onclose: () => void;
    onprev: (index: number) => void;
    onnext: (index: number) => void;
  }

  let { images, currentIndex, onclose, onprev, onnext }: Props = $props();

  function getImageUrl(relativePath: string): string {
    return `/api/comfyui/images/${encodeURIComponent(relativePath)}`;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onclose();
    } else if (e.key === "ArrowLeft" && currentIndex > 0) {
      onprev(currentIndex - 1);
    } else if (e.key === "ArrowRight" && currentIndex < images.length - 1) {
      onnext(currentIndex + 1);
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
  onclick={onclose}
  onkeydown={() => {}}
>
  <!-- Close button -->
  <button
    onclick={onclose}
    class="absolute top-4 right-4 z-10 p-2 rounded-full bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="w-6 h-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  </button>

  <!-- Counter -->
  <div class="absolute top-4 left-4 z-10 text-zinc-400 text-sm">
    {currentIndex + 1} / {images.length}
  </div>

  <!-- Prev button -->
  {#if currentIndex > 0}
    <button
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
        onprev(currentIndex - 1);
      }}
      class="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 19l-7-7 7-7"
        />
      </svg>
    </button>
  {/if}

  <!-- Next button -->
  {#if currentIndex < images.length - 1}
    <button
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
        onnext(currentIndex + 1);
      }}
      class="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 5l7 7-7 7"
        />
      </svg>
    </button>
  {/if}

  <!-- Image -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <img
    src={getImageUrl(images[currentIndex].relativePath)}
    alt=""
    class="max-w-full max-h-full object-contain p-4"
    onclick={(e: MouseEvent) => e.stopPropagation()}
    onkeydown={() => {}}
  />
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/share/ShareLightbox.svelte
git commit -m "feat: add ShareLightbox component"
```

---

### Task 10: Create share page

**Files:**
- Create: `src/routes/share/+page.svelte`

- [ ] **Step 1: Create share page**

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import PasswordGate from "$lib/components/share/PasswordGate.svelte";
  import ShareCard from "$lib/components/share/ShareCard.svelte";
  import ShareLightbox from "$lib/components/share/ShareLightbox.svelte";

  interface ImageData {
    relativePath: string;
  }

  let { data } = $props();

  let images = $state<ImageData[]>(data.images || []);
  let nextCursor = $state<string | null>(data.nextCursor || null);
  let hasMore = $state<boolean>(data.hasMore || false);
  let loading = $state(false);
  let loaded = $state(false);

  let lightboxOpen = $state(false);
  let lightboxIndex = $state(0);

  let sentinelEl = $state<HTMLDivElement>();

  function handleCardClick(index: number) {
    lightboxIndex = index;
    lightboxOpen = true;
  }

  function closeLightbox() {
    lightboxOpen = false;
  }

  async function loadMore() {
    if (loading || !hasMore || !nextCursor) return;
    loading = true;

    try {
      const params = new URLSearchParams({ cursor: nextCursor, limit: "50" });
      const res = await fetch(`/api/share/browse?${params}`);
      const result = await res.json();

      images = [...images, ...result.images];
      nextCursor = result.nextCursor;
      hasMore = result.hasMore;
    } finally {
      loading = false;
    }
  }

  function clearAuth() {
    document.cookie =
      "share_auth=; path=/share; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.reload();
  }

  onMount(() => {
    loaded = true;
  });
</script>

{#if !data.authenticated && loaded}
  <PasswordGate />
{:else if data.authenticated}
  <div class="min-h-screen bg-zinc-950">
    <!-- Top bar -->
    <div
      class="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur border-b border-zinc-800"
    >
      <div class="flex items-center justify-between px-4 py-3 max-w-none">
        <h1 class="text-lg font-semibold text-zinc-100">分享图库</h1>
        <button
          onclick={clearAuth}
          class="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
        >
          退出
        </button>
      </div>
    </div>

    <!-- Grid -->
    <div class="px-2 py-2">
      <div
        class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 md:gap-3"
      >
        {#each images as image, i}
          <ShareCard
            relativePath={image.relativePath}
            index={i}
            onclick={handleCardClick}
          />
        {/each}
      </div>

      <!-- Sentinel for infinite scroll -->
      {#if hasMore}
        <div
          bind:this={sentinelEl}
          class="h-20 flex items-center justify-center"
        >
          {#if loading}
            <div class="text-zinc-500 text-sm">加载中...</div>
          {/if}
        </div>
      {/if}

      {#if !hasMore && images.length > 0}
        <div class="h-20 flex items-center justify-center text-zinc-600 text-sm">
          已加载全部图片
        </div>
      {/if}

      {#if images.length === 0}
        <div class="h-60 flex items-center justify-center text-zinc-500">
          暂无分享内容
        </div>
      {/if}
    </div>
  </div>

  <!-- Lightbox -->
  {#if lightboxOpen}
    <ShareLightbox
      images={images}
      currentIndex={lightboxIndex}
      onclose={closeLightbox}
      onprev={(i: number) => (lightboxIndex = i)}
      onnext={(i: number) => (lightboxIndex = i)}
    />
  {/if}
{/if}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/share/+page.svelte
git commit -m "feat: add share gallery page"
```

---

### Task 11: Wire IntersectionObserver for infinite scroll

**Files:**
- Modify: `src/routes/share/+page.svelte`

- [ ] **Step 1: Add IntersectionObserver to page**

Replace the `onMount` block in `+page.svelte` with:

```svelte
<script lang="ts">
  // ... existing imports and code ...

  let observer = $state<IntersectionObserver>();

  onMount(() => {
    loaded = true;

    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore) {
          loadMore();
        }
      },
      { rootMargin: "200px" },
    );

    return () => observer?.disconnect();
  });

  // Watch sentinelEl changes to reconnect observer
  $effect(() => {
    if (observer && sentinelEl) {
      observer.disconnect();
      observer.observe(sentinelEl);
    }
  });
</script>
```

- [ ] **Step 2: Verify build**

```bash
cd /home/narcissus/Workspace/LadyMuse && npm run build 2>&1
```
Expected: build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/share/+page.svelte
git commit -m "feat: add infinite scroll to share page"
```

---

### Task 12: End-to-end verification

- [ ] **Step 1: Start dev server**

```bash
cd /home/narcissus/Workspace/LadyMuse && npm run dev &
sleep 3
```

- [ ] **Step 2: Test password gate (wrong password)**

```bash
curl -s -X POST http://localhost:3000/api/share/verify \
  -H "Content-Type: application/json" \
  -d '{"password":"wrong"}' -w "\nHTTP %{http_code}\n"
```
Expected: HTTP 401, `{"error":"Incorrect password"}`

- [ ] **Step 3: Test password gate (correct password)**

```bash
curl -s -X POST http://localhost:3000/api/share/verify \
  -H "Content-Type: application/json" \
  -d '{"password":"jiejiejie"}' -c /tmp/share_cookie.txt -w "\nHTTP %{http_code}\n"
```
Expected: HTTP 200, `{"success":true}` with Set-Cookie header

- [ ] **Step 4: Test browse API (no cookie)**

```bash
curl -s http://localhost:3000/api/share/browse -w "\nHTTP %{http_code}\n"
```
Expected: returns rated/picked images in JSON format

- [ ] **Step 5: Test share page with cookie**

```bash
curl -s http://localhost:3000/share -b /tmp/share_cookie.txt -w "\nHTTP %{http_code}\n" | head -5
```
Expected: HTTP 200, page contains gallery HTML (not password form)

- [ ] **Step 6: Test thumbnail API**

```bash
# Use the first image from browse results
IMAGE_PATH=$(curl -s http://localhost:3000/api/share/browse | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['images'][0]['relativePath']) if d['images'] else exit(1)")
echo "Testing thumbnail for: $IMAGE_PATH"
curl -s -o /dev/null -w "HTTP %{http_code}, Size: %{size_download} bytes, Content-Type: %{content_type}\n" "http://localhost:3000/api/share/thumbnails/$IMAGE_PATH"
```
Expected: HTTP 200, Content-Type image/webp, size < 50KB

- [ ] **Step 7: Verify thumbnail cached on disk**

```bash
ls -la data/thumbnails/
```
Expected: `.webp` files exist matching image paths

- [ ] **Step 8: Stop dev server**

```bash
kill %1 2>/dev/null
```
