# Danbooru 标签知识库

> 状态：已确认

## 目标

用 Danbooru 标签体系替代 AAT，构建 AI 绘画标签知识库。数据源来自 BigQuery 官方公开数据集，用户手动导出 JSON，应用内导入 + 向量化。

## 数据流

```
用户手动导出 BigQuery（4 个查询）
  ↓
tags.jsonl + wiki_pages.jsonl + tag_aliases.jsonl + tag_implications.jsonl
  ↓ 放入 data/danbooru/
  ↓ UI 点「导入 Danbooru 数据」
  ↓
  ├─ tags + wiki_pages join → danbooru_tags (~50k)
  ├─ tag_aliases → danbooru_tag_aliases
  └─ tag_implications → danbooru_tag_implications
  ↓
  ↓ UI 点「生成向量」
  ↓ embed-all.ts → vec_danbooru (~50k)
  ↓
agent tools:
  ├─ search_danbooru_tags (语义+关键字搜索)
  ├─ list_danbooru_topics (列出可浏览的 topic)
  ├─ browse_danbooru_tags (按 topic → section 浏览)
  └─ get_danbooru_tag (查单个标签详情+关联)
```

## 数据源

BigQuery 公开数据集 `danbooru1.danbooru_public`：

**tags 导出：**
```sql
SELECT id, name, post_count, category, created_at, updated_at, is_deprecated, words
FROM danbooru1.danbooru_public.tags
WHERE category = 0 AND is_deprecated = false
```

**wiki_pages 导出：**
```sql
SELECT id, title, body, other_names, is_locked, is_deleted, created_at, updated_at
FROM danbooru1.danbooru_public.wiki_pages
WHERE is_deleted = false AND body IS NOT NULL AND body != ''
```

**tag_aliases 导出：**
```sql
SELECT id, antecedent_name, consequent_name, status, created_at, updated_at
FROM danbooru1.danbooru_public.tag_aliases
WHERE status = 'active'
```

**tag_implications 导出：**
```sql
SELECT id, antecedent_name, consequent_name, status, created_at, updated_at
FROM danbooru1.danbooru_public.tag_implications
WHERE status = 'active'
```

导出格式均为 JSONL（BigQuery Export → JSON, newline-delimited）。

## 数据库变更

### 新表：`danbooru_tags`

```sql
CREATE TABLE danbooru_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  post_count INTEGER DEFAULT 0,
  body TEXT,
  other_names TEXT,  -- JSON array
  embedding TEXT,     -- '1' when vectorized
  created_at TEXT,
  updated_at TEXT
);
```

### 新表：`danbooru_tag_aliases`

同一标签的不同叫法，用于搜索时归一化。

```sql
CREATE TABLE danbooru_tag_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  antecedent_name TEXT NOT NULL,   -- 别名（如 "backlight"）
  consequent_name TEXT NOT NULL,   -- 正式名（如 "backlighting"）
  status TEXT DEFAULT 'active'
);
```

### 新表：`danbooru_tag_implications`

标签的自动推论关系——搜到 A 意味着 B 也存在。

```sql
CREATE TABLE danbooru_tag_implications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  antecedent_name TEXT NOT NULL,   -- 条件标签（如 "backlighting"）
  consequent_name TEXT NOT NULL,   -- 推论标签（如 "lighting"）
  status TEXT DEFAULT 'active'
);
```

### 新表：`vec_danbooru`

```sql
CREATE VIRTUAL TABLE vec_danbooru USING vec0(
  id TEXT,
  embedding float[1536]
);
```

## 后端变更

### 新增：`knowledge/sync-danbooru.ts`
- `importDanbooru()` — 读取 data/danbooru/ 下的 JSONL 文件，join，upsert 到 `danbooru_tags`
- 通过 SSE 推送进度

### 扩展：`knowledge/embed-all.ts`
- 新增 `embedTarget("danbooru")` 支持
- Embedding 文本：`name + " " + stripWikiMarkup(body)[:300]`
- Tool 返回给 agent：`stripWikiMarkup(body)[:400]`
- 写入 `vec_danbooru`，flag 写入 `danbooru_tags.embedding`

### 新增：`tools.ts`（4 个 tool）

**`search_danbooru_tags`** — 主力：语义 + 关键字
- 输入：`query`（必填，语义描述）+ `keyword`（可选，模糊匹配标签名）+ `topic`（可选，限定范围）
- 逻辑：generateEmbedding → vec_danbooru MATCH（15 个）→ 回查 danbooru_tags → score > 0.3 过滤
- 如果有 keyword，额外 LIKE 模糊匹配，结果合并去重
- 返回：name + body(400c) + post_count + score
- 返回时附带 implications（自动推论的相关标签）

**`list_danbooru_topics`** — 列出可浏览 topic
- 无参数
- 返回：8 个 topic 名 + 中文说明

**`browse_danbooru_tags`** — 按 topic → section 浏览
- 输入：`topic`
- 复用 `TAG_GROUP_TOPICS` + `fetchTagGroup`，实时从 Danbooru API 获取
- 返回：按 section 组织的标签列表 + post_count

**`get_danbooru_tag`** — 查单个标签详情
- 输入：`name`
- 逻辑：查 danbooru_tags 拿 body + post_count + other_names，查 aliases 表拿别名，查 implications 表拿关联
- 返回：name + body(400c) + post_count + aliases + implications

搜索时额外利用：
- **aliases**：用户 query 分词后，查 alias 表归一化成正式 tag 名，提高搜索精度
- **implications**：返回匹配标签时，附带其 consequent tags 作为"相关推荐"

### 扩展：`db/index.ts`
- 创建 `vec_danbooru` 虚拟表

### 新增：`prompts/08-danbooru-guidance.md`

Danbooru 工具使用指引，仿照 `02-civitai-guidance.md` 模式。tool 启用时自动注入系统提示词。

内容：
- 列出 8 个可浏览的 topic（lighting / composition / colors / background / aesthetic / posture / gestures / focus）
- 说明 tool 使用流程：语义搜索 → 浏览探索 → 确认标签
- 关键规则：标签名格式（下划线）、可嵌入 prompt、优先使用搜索验证过的标签

### 注册：`prompts/modules.json`
- `shared_modules` 新增 `{"file": "08-danbooru-guidance.md", "enabled": true}`
- `tools` 新增三个 danbooru tool 的启用配置

## 前端变更

知识库管理页面新增 Danbooru 区块：
- 文件放置指引：JSONL 文件放在 `data/danbooru/`
- 状态显示：tags 数 / wiki 数 / 已导入数 / 已向量化数
- 操作按钮：「导入标签」「生成向量」
- 进度条

## 文档

`docs/danbooru-import.md`：
- BigQuery 导出 SQL 和步骤
- JSONL 文件放置路径
- UI 操作指引
- 数据更新流程

## 验证

1. 用户放置 JSONL 文件后，导入返回正确数量（~50k）
2. 生成向量后，`vec_danbooru_rowids` 有 ~50k 行
3. `search_danbooru_tags("soft lighting")` 返回相关标签 + 描述 + 分数
4. 标签描述质量可读
