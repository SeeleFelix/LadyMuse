# Share Gallery Design Spec

## Context

Need a read-only, password-protected gallery for sharing curated images with remote viewers. Based on the existing gallery functionality but stripped down: no editing, no downloading, no filtering/sorting UI. Shows only images with a rating (1-5) or pick flag.

## Architecture

```
/share (独立路由，复用现有原图 API，新增缩略图 API)
  │
  ├── /share/+page.server.ts — cookie 校验，初始数据加载
  └── /share/+page.svelte
        ├── PasswordGate — 未认证时显示
        └── Gallery — 认证后显示
              ├── 顶栏（标题 + 退出）
              ├── CSS Grid 缩略图网格 + 无限滚动
              └── ShareLightbox — 点击放大
```

## Routes

### Pages

| Route | File | Purpose |
|-------|------|---------|
| `/share` | `src/routes/share/+page.svelte` | Password gate + gallery + lightbox |
| `/share` | `src/routes/share/+page.server.ts` | Cookie check, initial browse data |

### API 端点（新增）

| Route | File | Purpose |
|-------|------|---------|
| `POST /api/share/verify` | `src/routes/api/share/verify/+server.ts` | Validate password, set encrypted cookie |
| `GET /api/share/browse` | `src/routes/api/share/browse/+server.ts` | Query rated/picked images only |
| `GET /api/share/thumbnails/[...path]` | `src/routes/api/share/thumbnails/[...path]/+server.ts` | Lazy-generate + serve WebP thumbnails |

### API 端点（复用现有）

| Route | File | Purpose |
|-------|------|---------|
| `GET /api/comfyui/images/[...path]` | existing | Serve full-resolution images (used by lightbox) |

## Components

### PasswordGate

- 密码输入框 + 确认按钮
- 错误提示
- POST `/api/share/verify` → 成功则刷新页面

### Gallery Grid

- CSS Grid `grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`
- `IntersectionObserver` sentinel 触发无限滚动
- 每个卡片: `aspect-square` 容器, `object-contain` 等比缩放

### ShareCard

- `<img>` 加载缩略图 API
- `loading="lazy"`
- 点击 → 打开 ShareLightbox
- 无评分、flag、多选、下载、右键菜单

### ShareLightbox

- 全屏遮罩
- 左/右箭头切换图片
- 关闭按钮 (Esc / X)
- 加载原图（复用现有 images API）
- 无下载按钮

## Data Flow

### Password Verification

```
POST /api/share/verify  { password: "xxx" }
  → 比对固定密码
  → 正确: set-cookie (encrypted, httpOnly, path=/share, maxAge=30d)
  → 返回 { success: true }
  → 错误: 返回 401
```

### Browse Query

```
GET /api/share/browse?cursor=<path>&limit=50

SQL:
  SELECT * FROM image_attributes
  WHERE (rating > 0 OR flag = 'pick')
    AND is_missing = 0
    AND (cursor condition for keyset pagination)
  ORDER BY file_modified_at DESC
  LIMIT 50
```

### Thumbnail Serving (Lazy Generation)

```
GET /api/share/thumbnails/2025/03/28/img.png

  1. Resolve image path via existing resolveImagePath()
  2. Check data/thumbnails/{relativePath}.webp
     → Exists: serve with Cache-Control: public, max-age=604800
     → Not exist:
       a. sharp(fullPath).resize(400, 400, { fit: "inside", withoutEnlargement: true })
       b. .webp({ quality: 80 })
       c. .toFile("data/thumbnails/{relativePath}.webp")
       d. Serve result with Cache-Control: public, max-age=604800
  3. Original image not found → 404
```

## New Dependencies

- `sharp` — high-performance image processing for thumbnail generation

## New Files Summary

```
src/routes/share/+page.svelte
src/routes/share/+page.server.ts
src/routes/api/share/verify/+server.ts
src/routes/api/share/browse/+server.ts
src/routes/api/share/thumbnails/[...path]/+server.ts
src/lib/server/thumbnail-service.ts
src/lib/components/share/PasswordGate.svelte
src/lib/components/share/ShareCard.svelte
src/lib/components/share/ShareLightbox.svelte
```

## Existing Files Modified

None. All new code is in isolated routes and components. Existing gallery is untouched.

## Verification

1. `npm run build` passes
2. Visit `/share` → password form
3. Enter wrong password → error shown
4. Enter `jiejiejie` → gallery loads with only rated/picked images
5. Thumbnails load fast (< 20KB each via DevTools Network)
6. Click image → lightbox with full-resolution image, no download button
7. `data/thumbnails/` contains generated `.webp` files
8. Browser hard-refresh → thumbnails served from cache (304 or disk cache)
