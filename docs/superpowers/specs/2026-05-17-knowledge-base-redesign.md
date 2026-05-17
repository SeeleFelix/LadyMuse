# 知识库重新设计

> 状态：已确认，待实现

## 目标

将当前知识库（artTechniques + styles + 模糊搜索）重构为结构化、可查询、可生长的三层知识体系，用权威外部源填充基础骨架。

## 架构

### 8 个维度

lighting（光影）/ composition（构图）/ color（色彩）/ texture（质感）/ setting（场景）/ subject（主体）/ style（风格）/ technical（技术）

### 3 个层级

| 层级 | 本质 | 归属 | 量级 |
|------|------|------|------|
| Concept | 单个视觉概念 → 标签 + 自然语言描述 | 属于某个维度 | 数百~数千条 |
| Pattern | 跨维度组合规则（结构顺序、搭配、冲突） | 跨维度 | 几十条 |
| Reference | 验证过的完整案例 + 经验总结 | 跨维度 | 不限 |

## 数据模型

### art_concepts

```sql
id              INTEGER PRIMARY KEY
name            TEXT NOT NULL          -- 英文标识符
name_zh         TEXT                   -- 中文名
category        TEXT NOT NULL          -- 维度
sub_category    TEXT                   -- 子分类
visual_description TEXT                -- 视觉效果描述
tags            TEXT                   -- JSON array，标签模型用的提示词标签
tag_usage       TEXT                   -- 标签用法建议
natural_language TEXT                  -- 自然语言描述
nl_usage        TEXT                   -- 自然语言用法建议
related_concepts TEXT                  -- JSON array，关联概念名
source          TEXT NOT NULL          -- aat / wikipedia / aat+wikipedia / manual
source_id       TEXT                   -- 外部源 ID
quality_verified INTEGER DEFAULT 0
embedding       TEXT                   -- JSON array，向量嵌入
created_at      TEXT
updated_at      TEXT
```

### art_patterns

```sql
id              INTEGER PRIMARY KEY
name            TEXT NOT NULL
intent          TEXT                   -- 适用意图描述
structure_order TEXT                   -- 结构顺序
composition_rules TEXT                 -- 组合规则
conflicts       TEXT                   -- 冲突约束
involves_dimensions TEXT               -- JSON array
involves_concepts TEXT                 -- JSON array，关联概念名
embedding       TEXT
quality_verified INTEGER DEFAULT 0
created_at      TEXT
updated_at      TEXT
```

### art_references

```sql
id              INTEGER PRIMARY KEY
name            TEXT NOT NULL
intent          TEXT                   -- 创作意图
positive_prompt TEXT NOT NULL
negative_prompt TEXT
params_json     TEXT                   -- 参数 JSON
applied_concepts TEXT                  -- JSON array
applied_pattern TEXT
deviations      TEXT                   -- 偏离模式的原因
takeaway        TEXT                   -- 经验总结
verified        INTEGER DEFAULT 0
source          TEXT                   -- user_saved / manual
embedding       TEXT
created_at      TEXT
updated_at      TEXT
```

## 数据来源

### Getty AAT

- **方式**：N-Triples 批量下载（`vocab.getty.edu`，月更），~57K 概念
- **筛选**：按层级路径映射到 8 个维度
- **映射**：`prefLabel → name`、中文标签 → `name_zh`、层级路径 → `category/sub_category`、`scopeNote → visual_description`、`altLabels → tags`、关联概念 → `related_concepts`
- **标记**：`source = "aat"`

### Wikipedia

- **方式**：`categorymembers` API 按分类遍历 → `/page/summary/` 拿摘要
- **筛选**：按 Wikipedia 分类映射到 8 个维度
- **映射**：`title → name`、中文页面标题 → `name_zh`、分类 → `category/sub_category`、`extract → visual_description`
- **标记**：`source = "wikipedia"`
- **速度**：几千条文章，200ms 间隔，全量几十分钟

### 数据补充规则

- AAT scopeNote 为空或长度 < 50 字符 → 查 Wikipedia 同名文章补充 `visual_description`
- 同名概念（name 匹配）合并：`source = "aat+wikipedia"`，描述优先 Wikipedia，术语关系优先 AAT

## 工具

### 概念层 — 机械 SQL

**`explore_dimension`** — 浏览维度/子分类下的概念列表
```
输入: { category, subCategory? }
输出: [{ name, nameZh, subCategory }]，最多 30 条
```

**`get_concept`** — 查单个概念完整详情
```
输入: { name }
输出: 根据当前 prompt_style 返回 tags 或 natural_language 对应字段
```

### 概念层 — embedding 语义搜索

**`find_concepts`** — 按意图语义搜索
```
输入: { intent }
实现: intent → embedding → 余弦相似度检索 art_concepts → Top-N
输出: [{ name, nameZh, score, snippet }]，最多 8 条
```

### 模式层 — embedding

**`find_patterns`** — 按意图搜索创作模式
```
输入: { intent, concepts? }
实现: intent → embedding 搜 art_patterns；若传 concepts 则叠加概念重叠分
输出: [{ name, intent, involves_dimensions, structure_order }]，最多 3 条
```

### 参考层 — 精确关联 + embedding

**`find_references`** — 查找实证案例
```
输入: { concepts?, pattern?, intent?, limit? }
实现: 精确关联优先 → embedding 排；都不传返回最新验证过的
输出: [{ name, intent, prompt_preview, params, takeaway }]，默认 3 条
```

## 系统提示词注入

注入概念目录 + 模式清单，参考不注入。从数据库动态生成：

```
## 知识库目录

### 光影 (lighting)
  directional: rembrandt_lighting, split_lighting, butterfly_lighting, loop_lighting...
  natural: golden_hour, blue_hour, overcast, twilight, moonlight...
  atmospheric: volumetric_fog, crepuscular_rays, god_rays...
### 构图 (composition)
  shot_type: close_up, medium_shot, wide_shot...
  angle: dutch_angle, birds_eye, worms_eye, eye_level...
  ...
### 色彩 / 质感 / 场景 / 主体 / 风格 / 技术
  ...

### 创作模式 (patterns)
  暗调电影感肖像 — 有深度有情绪的人物肖像，适合孤独、沉思、坚韧
  赛博朋克街景 — ...
  ...
```

- 概念目录：`SELECT category, sub_category, name FROM art_concepts GROUP BY category, sub_category`
- 模式清单：`SELECT name, intent FROM art_patterns`
- 参考不列（数量不限、用户持续新增）

## Embedding

- 使用 OpenRouter 的 `openai/text-embedding-3-small`（1536 维，便宜，中英文可用）
- 概念表：嵌入 `visual_description + tags + name_zh`
- 模式表：嵌入 `intent + involves_concepts`
- 参考表：嵌入 `intent + takeaway`
- 同步/录入时批量生成，存入 `embedding` 字段
- 查询：intent → embedding → 余弦相似度 → 返回带 score 的结果

## 旧数据处理

- 旧表（artTechniques、styles、artCategories 等）保留不动，数据作为迁移参考素材
- 旧工具 `knowledge_search`、`discover_visual_concepts` 删除
- 新 5 个工具注册到 `allToolDefinitions` 和 `modules.json`
