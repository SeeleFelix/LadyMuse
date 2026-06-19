# 风格轴选择面板（Style Axis Picker）设计

> 日期：2026-06-16
> 状态：设计稿，待评审

## 1. 背景与目标

用户在使用 LadyMuse 创作助手时，对"技法 / 流派 / 画风"等领域缺乏词汇与分类认知——典型表现是"我不知道我不知道的东西"（例：知道"平涂 厚涂"存在，但不知道它们统称"上色/渲染技法"，也不知道同类还有"赛璐璐 / AO 画法 / 罩染"）。

视觉艺术的分类可分解为 6 条相对独立的轴：

1. **媒介 Medium** — 作品的物理/数字载体（油画 / 水彩 / 数字绘画 / 胶片摄影…）
2. **技法 Technique** — 媒介的操作方式（平涂 / 厚涂 / 赛璐璐…）
3. **流派 Movement** — 艺术史学派（印象派 / 浮世绘 / 装饰艺术…）
4. **画风 Style** — 视觉风格，内部分 4 个子簇（作者/地域/类型/时代）
5. **题材 Genre** — 拍/画的是什么（人像 / 风光 / 画意摄影…）
6. **美学 Mood** — 情绪调性（清新 / 暗黑 / 史诗…）

现有 schema 的 `artTechniques`（构图/光影/色彩等工艺维度）与 `styleFamilies/styles`（媒介与画风混合桶）**无法干净承载这 6 条轴**——这是"结合不进去"的根因。

**目标**：交付一个"风格轴选择面板"，让用户通过浏览 6 条轴发现选项、多选条目，选中的条目其 prompt 关键词在独立开关控制下、以独立 section 形式注入到 system prompt，**与现有 embedding 检索注入物理隔离**。

## 2. 范围

### In Scope（MVP）
- 两张新表 `art_axes` / `art_axis_entries` + Drizzle migration + seed
- `GET /api/axes` 接口
- `StyleAxisPicker.svelte` 组件，接入 `/chat` 页
- 聊天请求新增 `selectedAxisEntryIds` + `axisInjectionEnabled` 两个参数
- `buildSystemPrompt` 增加独立的"用户选定的风格轴"section，位置在 knowledge directory 之后、suffix 之前

### Out of Scope（后续）
- `/builder` 接入
- 参考图反推分析
- 叶子级细化（种子目前到"簇"级，每个轴 6~12 条代表性条目）
- 语义检索（用户不选也能自动命中）——MVP 纯手动选
- 后台 CRUD 管理 UI——先靠 seed 文件维护
- 选择 / 开关状态的持久化——MVP 为内存态 page state，刷新即丢；持久化到 session 或 userConfig 是后续工作
- 与现有 `artTechniques` / `styles` / `artConcepts` 的合并或迁移——三套并行，互不影响

## 3. 数据模型

### 3.1 新表定义（`src/lib/server/db/schema.ts`）

```ts
// 风格轴 — 6 条固定轴
export const artAxes = sqliteTable("art_axes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),      // medium / technique / movement / style / genre / mood
  name: text("name").notNull(),               // Medium / Technique / ...
  nameZh: text("name_zh").notNull(),          // 媒介 / 技法 / ...
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
});

// 风格轴条目 — 所有叶子节点
export const artAxisEntries = sqliteTable("art_axis_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  axisId: integer("axis_id")
    .notNull()
    .references(() => artAxes.id),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),               // Oil Painting / Flat Color / ...
  nameZh: text("name_zh").notNull(),          // 油画 / 平涂 / ...
  description: text("description"),           // 这是什么（中文释义）
  promptKeywords: text("prompt_keywords").notNull(),  // 逗号分隔英文关键词，注入用
  nlDescription: text("nl_description"),      // 自然语言版（给 natural 提示词风格用）
  subGroup: text("sub_group"),                // 仅画风轴: artist / regional / genre / era
  tags: text("tags"),
  sortOrder: integer("sort_order").default(0),
});
```

设计要点：
- `promptKeywords` 是注入到 prompt 的**唯一原料**，逗号分隔英文（图像模型用英文）
- `subGroup` 仅画风轴使用，其它轴留空；UI 渲染画风轴时按 subGroup 二次分组
- 与现有 `artTechniques` / `styles` 完全独立，不建外键关联

### 3.2 Migration

生成方式：`npx drizzle-kit generate`（schema 源头是 `src/lib/server/db/schema.ts`，由 `drizzle.config.ts` 指定）。生成的 SQL 形如（参考 `drizzle/0017_sour_otto_octavius.sql` 风格）：

```sql
CREATE TABLE `art_axes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`name_zh` text NOT NULL,
	`description` text,
	`sort_order` integer DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX `art_axes_slug_unique` ON `art_axes` (`slug`);
--> statement-breakpoint
CREATE TABLE `art_axis_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`axis_id` integer NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`name_zh` text NOT NULL,
	`description` text,
	`prompt_keywords` text NOT NULL,
	`nl_description` text,
	`sub_group` text,
	`tags` text,
	`sort_order` integer DEFAULT 0,
	FOREIGN KEY (`axis_id`) REFERENCES `art_axes`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `art_axis_entries_slug_unique` ON `art_axis_entries` (`slug`);
```

迁移文件命名延续项目惯例（`drizzle/0020_<descriptor>.sql`，descriptor 由 drizzle-kit 随机生成）。

**重要（遵循项目约定）**：执行迁移前必须先备份 `ladymuse.db`：

```bash
cp ladymuse.db .db-backups/ladymuse.db.$(date +%Y%m%d-%H%M%S).bak
npx drizzle-kit migrate
```

### 3.3 Seed 数据

新增 `src/lib/server/seed/axes.ts`，导出 `seedAxes(db: DB)`。在 `src/lib/server/seed/index.ts` 的 `main()` 里追加调用。

6 条轴固定数据：

| sortOrder | slug | name | nameZh |
|---|---|---|---|
| 0 | medium | Medium | 媒介 |
| 1 | technique | Technique | 技法 |
| 2 | movement | Movement | 流派 |
| 3 | style | Style | 画风 |
| 4 | genre | Genre | 题材 |
| 5 | mood | Mood | 美学 |

代表性条目（每轴 6~12 条，`promptKeywords` 已给出注入用关键词）：

**媒介 Medium**
| slug | nameZh | promptKeywords |
|---|---|---|
| oil | 油画 | oil painting, oil paint texture, visible brushstrokes |
| watercolor | 水彩 | watercolor, wet brush, paper texture, translucent |
| acrylic | 丙烯 | acrylic painting, acrylic paint |
| gouache | 水粉 | gouache, opaque watercolor |
| digital-painting | 数字绘画 | digital painting, digital art |
| pixel-art | 像素艺术 | pixel art, 16-bit, sprite |
| vector | 矢量插画 | vector art, flat vector illustration |
| 3d-render | 3D 渲染 | 3d, cgi, render, octane render |
| film-photo | 胶片摄影 | film photography, 35mm, film grain |
| digital-photo | 数码摄影 | photograph, photo, dslr |

**技法 Technique**
| slug | nameZh | promptKeywords |
|---|---|---|
| flat-color | 平涂 | flat color, flat shading |
| cel-shading | 赛璐璐 | cel shading, hard shading, anime shading |
| impasto | 厚涂 | impasto, thick paint, thick brushstrokes |
| gradient-shading | 渐变涂 | gradient shading, soft gradient |
| glazing | 罩染 | glazing, transparent layers, luminous |
| dry-brush | 干扫 | dry brush, rough texture |
| rendering | 渲染型上色 | rendered, soft shading, ambient occlusion |
| painterly | 无线稿厚涂 | painterly, lineless, no outline |
| long-exposure | 长曝光 | long exposure, motion blur, light trails |
| double-exposure | 双重曝光 | double exposure |

**流派 Movement**
| slug | nameZh | promptKeywords |
|---|---|---|
| impressionism | 印象派 | impressionist painting, impressionism, visible brushstrokes, en plein air |
| ukiyo-e | 浮世绘 | ukiyo-e, japanese woodblock print, hokusai style |
| art-nouveau | 新艺术运动 | art nouveau, mucha style, ornamental |
| art-deco | 装饰艺术 | art deco, geometric, 1920s |
| bauhaus | 包豪斯 | bauhaus, geometric, primary colors |
| renaissance | 文艺复兴 | renaissance painting, classical, chiaroscuro |
| pop-art | 波普艺术 | pop art, warhol, bold colors, comic |
| surrealism | 超现实主义 | surrealism, dali, dreamlike |

**画风 Style**（带 subGroup）
| slug | nameZh | subGroup | promptKeywords |
|---|---|---|---|
| ghibli | 吉卜力 | artist | studio ghibli style, miyazaki, hand-drawn |
| shinkai | 新海诚 | artist | makoto shinkai style, vibrant sky, lens flare |
| mucha | 慕夏 | artist | alphonse mucha style, art nouveau portrait |
| japanese-fresh | 日式小清新 | regional | japanese, light and airy, pastel, fresh, soft light |
| guofeng | 国风 | regional | chinese style, guofeng, traditional chinese |
| korean-webtoon | 韩系 | regional | korean webtoon style, manhwa |
| nordic-minimal | 北欧极简 | regional | nordic, minimalist, scandinavian, muted |
| cyberpunk | 赛博朋克 | genre | cyberpunk, neon, futuristic, blade runner |
| steampunk | 蒸汽朋克 | genre | steampunk, brass, steam, victorian sci-fi |
| dark-fantasy | 暗黑奇幻 | genre | dark fantasy, gothic, moody |
| retro-film | 复古胶片 | era | retro film, vintage, faded, 70s |
| 90s-anime | 90s 动漫 | era | 90s anime, retro anime, vhs |
| y2k | Y2K | era | y2k, 2000s, chrome, cyber |

**题材 Genre**
| slug | nameZh | promptKeywords |
|---|---|---|
| portrait | 人像 | portrait, close-up face |
| landscape | 风光 | landscape, scenery, nature |
| pictorialism | 画意摄影 | pictorialism, soft focus, painterly photograph |
| street | 街拍 | street photography, candid, urban |
| still-life | 静物 | still life |
| concept-art | 概念设计 | concept art, artstation, matte painting |

**美学 Mood**
| slug | nameZh | promptKeywords |
|---|---|---|
| fresh | 清新 | fresh, light, airy, bright |
| healing | 治愈 | healing, cozy, warm, soft |
| ethereal | 空灵 | ethereal, dreamy, glowing, soft focus |
| dark | 暗黑 | dark, moody, shadowy |
| nostalgic | 复古怀旧 | nostalgic, vintage, faded |
| epic | 史诗 | epic, cinematic, grand, dramatic |
| film-like | 胶片感 | film grain, analog, cinematic |

> 共约 60 条种子。后续可增量补充，`onConflictDoNothing` 保证幂等。

`seedAxes` 实现参照 `seedStyles`（`src/lib/server/seed/styles.ts`）：先插轴、查回 ID 映射、再插条目，全部 `onConflictDoNothing`。

## 4. API

### 4.1 `GET /api/axes`

新增 `src/routes/api/axes/+server.ts`。返回树形结构，供 UI 一次性渲染：

```ts
// 响应示例
[
  {
    "id": 1, "slug": "medium", "name": "Medium", "nameZh": "媒介", "sortOrder": 0,
    "entries": [
      { "id": 10, "slug": "oil", "name": "Oil Painting", "nameZh": "油画",
        "description": "...", "promptKeywords": "oil painting, ...",
        "subGroup": null, "sortOrder": 0 },
      ...
    ]
  },
  ...
]
```

实现：联查 `artAxes`（按 sortOrder）+ `artAxisEntries`（按 axisId, sortOrder），在服务端 group 成树。不返回 `nlDescription` / `tags`（UI 不需要，减小 payload）。

`GET /api/axes` 无鉴权（与现有 `/api/knowledge` 等只读接口一致）。

## 5. UI 组件

### 5.1 `StyleAxisPicker.svelte`

位置：`src/lib/components/style/StyleAxisPicker.svelte`（`style/` 目录已存在、为空，正好承载）。

技术栈对齐项目：Svelte 5 runes（`$props` / `$state` / `$derived`）、Tailwind、暗色 zinc 主题（参照 `common/Dropdown.svelte`）。

**Props（bindable + callback）**：
```ts
let {
  selectedIds = $bindable([] as number[]),     // 选中的 entry id 数组
  injectionEnabled = $bindable(true),          // 注入开关
  onselectionchange,                            // 选择变化回调
}: { ... } = $props();
```

**内部状态**：
```ts
let axes = $state<AxisNode[]>([]);              // 从 /api/axes 拉取
let expandedAxis = $state<string | null>("technique");  // 当前展开的轴 slug（手风琴，一次展开一个）
let query = $state("");                          // 条目过滤（可选，MVP 可不做）
```

**布局**：
```
┌─ 风格轴 ─────────────────────────────────┐
│  [注入到提示词 ●━━] (开关)                │
│                                          │
│  ▼ 媒介        (8 项)                    │
│    [油画][水彩][数字绘画][像素艺术] ...   │
│                                          │
│  ▶ 技法        (10 项)                   │  ← 点击展开
│  ▶ 流派        (8 项)                    │
│  ▶ 画风        (13 项 · 作者/地域/类型/时代) │
│  ▶ 题材        (6 项)                    │
│  ▶ 美学        (7 项)                    │
└──────────────────────────────────────────┘
```

- 6 个折叠组，手风琴模式（同时只展开一个，减少视觉噪音）
- 画风组展开时，内部按 `subGroup` 二次分小节（作者风 / 地域风 / 类型风 / 时代风）
- 每个条目是一个可点击 chip，点击 toggle 选中态；选中态高亮（violet 边框 + 背景，与 Dropdown 选中色一致）
- 顶部"注入到提示词"开关，控制 `injectionEnabled`；关闭时整个面板视觉 dim（opacity-60），选择保留但不生效
- 面板本身可整体折叠（一个收起按钮），不用时不占侧栏空间

**选中 chip 区**（渲染在 chat 输入框上方，由 `/chat` 页持有，不在组件内）：
```
[油画 ×][厚涂 ×][日式小清新 ×]   ← 点击 × 移除
```

### 5.2 `/chat` 页接入（`src/routes/chat/+page.svelte`）

新增 page state：
```ts
let selectedAxisIds = $state<number[]>([]);
let axisInjectionEnabled = $state<boolean>(true);
```

布局：在 chat 主区域侧边（桌面）/ 抽屉（移动）放置 `<StyleAxisPicker>`。MVP 可先做桌面侧栏，移动端折叠按钮后续补。

**`sendMessage()` 改动**（当前在 `+page.svelte:397` 的 fetch body）：
```ts
body: JSON.stringify({
  messages: apiMessages,
  model: selectedModel,
  provider: selectedProvider,
  sessionId: currentSessionId,
  selectedAxisEntryIds: selectedAxisIds,        // 新增
  axisInjectionEnabled,                          // 新增
}),
```

选中 chip 区渲染在输入框上方：遍历 `selectedAxisIds`，反查 entry nameZh，每项带 ×。

## 6. 注入链路（核心）

### 6.1 请求透传

`src/routes/api/chat/+server.ts`：
```ts
const { messages, model, provider, sessionId,
        selectedAxisEntryIds, axisInjectionEnabled } = await request.json();
// ...
for await (const chunk of chatStream(
  messages, model, provider, sessionId, request.signal,
  selectedAxisEntryIds, axisInjectionEnabled,   // 新增两个参数
)) { ... }
```

### 6.2 `chatStream` 透传（`src/lib/server/agent/index.ts`）

函数签名扩展：
```ts
export async function* chatStream(
  messages: Message[],
  modelId?: string,
  providerId?: string,
  sessionId?: number,
  signal?: AbortSignal,
  selectedAxisEntryIds?: number[],        // 新增
  axisInjectionEnabled?: boolean,          // 新增
) {
  // ...
  const systemPrompt = await buildSystemPrompt(lastUserMsg, {
    selectedAxisEntryIds, axisInjectionEnabled,
  });
  // ...
}
```

### 6.3 `buildSystemPrompt` 组装独立 section（`src/lib/server/agent/system-prompt.ts`）

签名扩展，增加 options 参数：
```ts
export async function buildSystemPrompt(
  userMessage?: string,
  options?: {
    selectedAxisEntryIds?: number[];
    axisInjectionEnabled?: boolean;
  },
): Promise<string> {
  // ...现有逻辑...

  const axisSection = await buildAxisSelectionSection(options);

  return assemblePrompt(modules, directory, relatedConcepts, suffix, axisSection);
}
```

新增函数 `buildAxisSelectionSection`：
```ts
async function buildAxisSelectionSection(options?: {
  selectedAxisEntryIds?: number[];
  axisInjectionEnabled?: boolean;
}): Promise<string> {
  // 开关关闭 或 无选中 → 返回空串（section 省略）
  if (!options?.axisInjectionEnabled) return "";
  const ids = options?.selectedAxisEntryIds ?? [];
  if (ids.length === 0) return "";

  // 按 ID 查条目 + 联查所属轴
  const rows = await db
    .select({
      axisNameZh: artAxes.nameZh,
      entryNameZh: artAxisEntries.nameZh,
      promptKeywords: artAxisEntries.promptKeywords,
    })
    .from(artAxisEntries)
    .innerJoin(artAxes, eq(artAxisEntries.axisId, artAxes.id))
    .where(inArray(artAxisEntries.id, ids));

  // 按轴 sortOrder 聚合
  const byAxis = new Map<string, { entryNameZh: string; kw: string }[]>();
  for (const r of rows) {
    if (!byAxis.has(r.axisNameZh)) byAxis.set(r.axisNameZh, []);
    byAxis.get(r.axisNameZh)!.push({ entryNameZh: r.entryNameZh, kw: r.promptKeywords });
  }

  const lines = [...byAxis.entries()].map(([axis, items]) =>
    `- ${axis}：${items.map(i => `${i.entryNameZh}（${i.kw}）`).join("；")}`
  ).join("\n");

  return `## 用户选定的风格轴（必须体现）\n用户已显式选定以下风格属性，生成提示词时务必包含这些特征：\n${lines}`;
}
```

### 6.4 `assemblePrompt` 位置安排（`src/lib/server/agent/system-prompt.ts`）

签名扩展：
```ts
export function assemblePrompt(
  modules: string,
  directory: string,
  relatedConcepts: string,
  suffix: string,
  axisSelection?: string,    // 新增
): string {
  const conceptsSection = relatedConcepts.trim() ? `${relatedConcepts.trim()}\n\n` : "";
  const axisSection = axisSelection?.trim() ? `${axisSelection.trim()}\n\n` : "";
  // 顺序: modules → relatedConcepts → directory → 【axisSelection】 → suffix
  return `${modules}\n\n${conceptsSection}${directory}\n\n${axisSection}${suffix}`;
}
```

**位置理由**：
1. **语义分层**：modules=你是谁/怎么工作；relatedConcepts+directory=你知道什么；**用户选定=用户明确要什么**；suffix=输出格式约束。用户意图放知识与输出约束之间，自然。
2. **靠后=高 salience**：显式选定是高意图，LLM 对靠后内容更敏感，不易被忽略。
3. **与 relatedConcepts 拉开距离**：relatedConcepts 是自动检索（低意图），混在一起会被当背景稀释；单独靠后放，分量更重，且满足"不混合、单独注入"的硬约束。

**隔离保证**：`axisSection` 是独立字符串、独立拼装、独立位置，与 `findRelatedConceptsForPrompt` 的 `relatedConcepts` 无任何代码路径交汇——物理隔离。

## 7. 文件改动清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/lib/server/db/schema.ts` | 编辑 | 新增 `artAxes` / `artAxisEntries` 两表定义 |
| `drizzle/0020_*.sql` | 新增 | drizzle-kit 生成的 migration |
| `src/lib/server/seed/axes.ts` | 新增 | `seedAxes(db)`，6 轴 + ~60 条目 |
| `src/lib/server/seed/index.ts` | 编辑 | `main()` 追加 `await seedAxes(db)` |
| `src/routes/api/axes/+server.ts` | 新增 | `GET` 返回树形轴数据 |
| `src/lib/components/style/StyleAxisPicker.svelte` | 新增 | 选择面板组件 |
| `src/routes/chat/+page.svelte` | 编辑 | 接入组件、新增 state、sendMessage body 加两参数、选中 chip 区 |
| `src/routes/api/chat/+server.ts` | 编辑 | 解构两新参数、透传 chatStream |
| `src/lib/server/agent/index.ts` | 编辑 | `chatStream` 签名加两参数、传给 buildSystemPrompt |
| `src/lib/server/agent/system-prompt.ts` | 编辑 | `buildSystemPrompt` 加 options、新增 `buildAxisSelectionSection`、`assemblePrompt` 加 `axisSelection` 参数 |

## 8. 测试

### 8.1 单元 / 集成（vitest，参照现有 `__tests__` 目录）
- `seedAxes` 幂等：跑两次，条目数不变
- `GET /api/axes`：返回 6 轴、画风轴含 subGroup 分组、结构符合约定
- `buildAxisSelectionSection`：
  - `axisInjectionEnabled=false` → 返回 `""`
  - `selectedAxisEntryIds=[]` → 返回 `""`
  - 正常输入 → 返回包含"用户选定的风格轴（必须体现）"标题 + 各轴关键词的字符串
- `assemblePrompt`：`axisSelection` 为空时输出与原行为一致；非空时该 section 出现在 directory 与 suffix 之间

### 8.2 手动 UI 验证
- 面板渲染 6 个折叠组、手风琴展开正常
- 多选 chip、选中态高亮、再点取消
- 选中后输入框上方出现 chip、点 × 可移除
- 注入开关关闭 → 面板 dim、sendMessage 后 system prompt 不含 axis section
- 开关开启 + 有选中 → 实际抓包/日志确认 system prompt 含独立 section、位置正确、关键词完整
- 开关开启 + 无选中 → system prompt 不含 axis section（空串省略）

## 9. 风险与权衡

- **种子覆盖度**：MVP ~60 条到簇级，用户可能仍找不到某些细分（如"水彩湿画法"的具体变体）。已知取舍——先跑通链路，叶子级增量补充是后续运营工作。
- **关键词质量**：`promptKeywords` 是 best-effort，不同图像模型（ZIT/SDXL/FLUX）对同一关键词响应不同。MVP 不做模型差异化，统一关键词；后续可按 `model-profiles` 加差异化。
- **三套并行**：新表与 `artTechniques`/`styles`/`artConcepts` 完全独立。短期看是"又加一套"，但维度不同、硬塞会更乱。长期是否合并另议，不在本设计范围。
