# Share Page Enhancements Design Spec

## Context

The share page is the project's first public-internet-facing surface. The original implementation (2026-06-18) was a minimal standalone gallery with isolated components. This spec addresses seven gaps: network isolation, metadata leakage via raw PNGs, missing image info display, missing download, missing image count, ambiguous exit button, and component duplication with the main gallery.

## Architecture

```
公网 → frp → :3001 (proxy.js, 只放/share*) → :3000 (主应用)
内网 → :3000 (主应用，无限制)

/share (复用主 gallery 组件)
  ├── +page.server.ts — cookie 校验，初始数据加载（扩展字段）
  └── +page.svelte
        ├── PasswordGate — 未认证时显示
        └── Gallery — 认证后显示
              ├── 顶栏（标题 + "N 张图片" + 退出）
              ├── CSS Grid 缩略图网格 + 无限滚动（复用 ThumbnailCard）
              └── Lightbox（复用主 gallery/Lightbox，readOnly 模式）
                    ├── 大图区：剥离元数据的原格式图片
                    └── ImageInfo 侧边面板（从 DetailPanel 抽取）
```

## Network Isolation

### proxy.js

Node 原生 `http` 模块，零依赖。监听 `:3001`，只转发 `/share` 和 `/api/share` 路径到 `:3000`，其余返回 403。frp 隧道指到 `:3001`。

```
GET /share              → proxy → :3000 ✓
GET /api/share/browse   → proxy → :3000 ✓
GET /generations        → proxy → 403
GET /api/chat           → proxy → 403
```

`package.json` 的 `dev` / `start` 脚本改为并行启动 proxy + vite。

## New API: Share Image Serving

### `GET /api/share/images/[...path]`

新增端点，替代原先 lightbox 直接访问 `/api/comfyui/images/...` 加载原始 PNG 的行为。

- 用 `sharp` 读取原文件，移除所有元数据（Exif、ICC profile、ComfyUI workflow 等），输出纯像素数据
- 保留原始格式和原始质量（PNG → PNG，JPEG → JPEG）
- Cache-Control: `public, max-age=604800`（7 天）
- 响应头包含 `Content-Length`、`Content-Type`
- 路径解析复用 `resolveImagePath()`，有遍历保护

此端点同时用于 lightbox 展示和下载。

## Component Changes

### Lightbox（`gallery/Lightbox.svelte`）— 增强

新增 props，默认值保持主图库行为不变：

| Prop | Default | Share 传入 |
|------|---------|-----------|
| `showZoom` | `true` | `false` |
| `showDownload` | `true` | `true` |
| `showCopyLink` | `true` | `false` |
| `showFilmstrip` | `true` | `false` |
| `showInfo` | `false` | `true` |
| `readOnly` | `false` | `true` |

`readOnly=true` 时，评分/标记等交互控件不渲染。大图加载 URL 通过 prop 注入（share 传 `/api/share/images/...`，主 gallery 传 `/api/comfyui/images/...`）。

### ImageInfo（`gallery/ImageInfo.svelte`）— 新建

从 `DetailPanel.svelte` 抽取纯展示部分。只读，无编辑控件。

Props：
```ts
{
  filename: string;
  fileSize: number;
  width: number;
  height: number;
  fileFormat: string;
  rating: number;
  metadata?: ComfyUIMetadata;
}
```

显示内容：
- 文件名（basename）
- 大小（格式化 KB/MB）
- 尺寸（W×H）
- 格式
- 评分星标（只读）
- 生成参数（可折叠，复用 `MetadataViewer`）

### ThumbnailCard（`gallery/ThumbnailCard.svelte`）— 增强

新增可选 prop `thumbUrl: string | undefined`。传入时覆盖默认的图片加载 URL。share 传入 `/api/share/thumbnails/...`。

### 删除的组件

- `share/ShareLightbox.svelte` — 功能由主 Lightbox 的 readOnly 模式覆盖
- `share/ShareCard.svelte` — 由 ThumbnailCard 替代

### 保留的组件

- `share/PasswordGate.svelte` — share 专属，保留

## Share Page Changes

### 顶栏

- 标题"分享图库"
- 图片总数：`"N 张图片"`
- 退出按钮：保留，清除 cookie 回到密码页
- 退出逻辑：清除 `share_auth` cookie（`path=/share`）并 reload

### 图片网格

- 复用 `VirtualGrid` + `ThumbnailCard`（传入 `thumbUrl`）
- 无限滚动逻辑不变

### Lightbox

- 点击卡片打开主 `Lightbox`，传入 share 配置 props
- 大图加载 `GET /api/share/images/<path>`
- 下载按钮复用 `downloadImage()`，URL 同样是 share images API
- ImageInfo 面板显示在侧边

### 下载

- 复用 `src/lib/utils/download-image.ts` 的 `downloadImage()`
- 下载 URL：`/api/share/images/<path>`

## Data Flow Changes

### `+page.server.ts` 返回扩展字段

`image_attributes` 表的 `width`、`height`、`fileSize`、`fileFormat`、`rating`、`positivePrompt`、`negativePrompt` 等字段原本就查询返回了，只是客户端接口只用了 `relativePath`。

客户端 `ImageData` 接口扩展为包含这些字段，传给 Lightbox 和 ImageInfo。

### 下载流程

```
用户点击下载 → downloadImage(/api/share/images/<path>, filename)
              → fetch → 剥离元数据的图片 Blob
              → URL.createObjectURL → <a download> → 触发浏览器下载
```

## New Files

```
proxy.js                                          — 网络隔离代理
src/routes/api/share/images/[...path]/+server.ts  — 剥离元数据的图片 API
src/lib/components/gallery/ImageInfo.svelte       — 纯展示信息面板（从 DetailPanel 抽取）
```

## Modified Files

```
package.json                                      — 启动脚本并行 proxy
src/lib/components/gallery/Lightbox.svelte        — 新增 showZoom/showDownload/showInfo/readOnly 等 props
src/lib/components/gallery/ThumbnailCard.svelte   — 新增 thumbUrl prop
src/lib/components/gallery/DetailPanel.svelte     — 抽取 ImageInfo，改为引用 ImageInfo
src/routes/share/+page.svelte                     — 复用 Lightbox/ThumbnailCard，加计数，加下载，拼数据给 Lightbox
src/routes/share/+page.server.ts                  — 返回完整字段
```

## Deleted Files

```
src/lib/components/share/ShareLightbox.svelte
src/lib/components/share/ShareCard.svelte
```

## Verification

1. `npm run build` passes
2. 内网访问 `:3000` — 完整应用正常，所有路由可访问
3. 公网通过 frp 访问 — 只有 `/share` 和 `/api/share` 可访问，其他返回 403
4. `/share` → 输入密码 → 图片网格加载，顶栏显示"N 张图片"
5. 点击图片 → Lightbox 打开，大图加载自 `/api/share/images/...`（Network 面板确认）
6. Lightbox 侧边显示文件名、大小、尺寸、格式、评分、生成参数
7. 下载按钮可用，下载的图片不含 ComfyUI 元数据
8. 退出按钮清除 cookie，回到密码页
9. 缩略图缓存于 `data/thumbnails/`，大图无元数据泄露
