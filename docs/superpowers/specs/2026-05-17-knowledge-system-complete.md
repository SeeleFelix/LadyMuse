# 知识库系统完整设计

> 状态：已确认，待实现
> 前置：`2026-05-17-knowledge-base-redesign.md`（数据模型、工具、数据源）

## 范围

在已完成的后端基础设施（3张表、embedding模块、目录生成、5个工具、AAT/Wikipedia同步脚本）之上，补齐：

1. 同步系统集成（SSE进度推送 + 异步执行）
2. 前端页面（知识库管理页面 + 聊天页工具标签更新）
3. 旧系统清理（旧页面、旧API、旧工具引用）

## 页面变更

| 页面 | 动作 | 说明 |
|------|------|------|
| `/knowledge` | 重写 | 8维度浏览 + 关键词/语义搜索 + 概念详情 + 同步触发 + SSE进度 |
| `/styles` | 删除 | 风格只是8维度之一，合并到 /knowledge |
| `/chat` | 修改 | 更新 TOOL_NAMES + TOOL_LABELS，删除旧工具引用 |

## API 设计

### 新增

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/knowledge` | GET | 概念列表。参数：`category`(选填，8维度之一)、`search`(选填)、`mode`(keyword/semantic，默认 keyword)、`subCategory`(选填) |
| `/api/knowledge/[name]` | GET | 单条概念完整详情 |
| `/api/knowledge/sync/aat` | POST | 触发 AAT 同步（异步），已运行时返回 409 |
| `/api/knowledge/sync/wikipedia` | POST | 触发 Wikipedia 同步（异步），已运行时返回 409 |
| `/api/knowledge/sync/status` | GET | 当前同步状态快照 |
| `/api/knowledge/sync/progress` | GET | SSE 端点，推送同步进度事件 |

### 删除

| 端点 | 说明 |
|------|------|
| `/api/styles` | 旧风格API，功能合并到 /api/knowledge |

### 修改

| 端点 | 说明 |
|------|------|
| `/api/knowledge` | 从旧 artCategories/artSubcategories/artTechniques 改为 artConcepts |

## 同步状态对象

```typescript
interface SyncStatus {
  running: boolean;
  source: "aat" | "wikipedia" | null;
  stage: "downloading" | "parsing" | "importing" | "embedding" | null;
  total: number;
  done: number;
  percent: number;
  error: string | null;
  lastSync: string | null; // ISO date
}
```

全局单例，同步脚本实时更新。SSE 1秒推送一次当前状态。

## `/knowledge` 页面布局

```
┌──────────────────────────────────────────────────────┐
│  知识库管理                                          │
│  [同步AAT] [同步Wikipedia]  上次同步: 2026-05-17      │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░ 67%  正在同步 AAT...            │
├────────────┬─────────────────────────────────────────┤
│ 维度       │  搜索: [________]  [关键词 ▾]            │
│            │                                        │
│ ▸ 光影     │  directional/                          │
│   构图      │    rembrandt_lighting   伦勃朗光        │
│   色彩      │    split_lighting       分割光          │
│   质感      │  natural/                              │
│   场景      │    golden_hour          黄金时刻        │
│   主体      │    blue_hour            蓝调时刻        │
│   风格      │  atmospheric/                          │
│   技术      │    volumetric_fog       体积雾          │
│            │                                        │
│  模式      │              [点击概念 → 右侧详情]       │
│  · 暗调肖像│                                        │
│  · ...     │                                        │
└────────────┴─────────────────────────────────────────┘
```

- 左侧：维度标签（8个）+ 模式快捷列表
- 右侧：概念列表（按 subCategory 分组，点击展开详情面板）
- 搜索栏在右侧顶部，模式切换（关键词/语义）
- 进度条在触发同步后显示

## 概念详情面板

| 区域 | 字段 | 展示 |
|------|------|------|
| 标题 | `name` / `nameZh` | 中文名 + 英文名，维度标签，来源标记 |
| 视觉描述 | `visualDescription` | 段落文本 |
| 标签 | `tags` | badges + 一键复制全部 |
| 标签用法 | `tagUsage` | 小字提示 |
| 自然语言描述 | `naturalLanguage` | 段落文本 + 复制 |
| 自然语言用法 | `nlUsage` | 小字提示 |
| 关联概念 | `relatedConcepts` | 可点击链接列表，点击跳转到该概念详情 |

## 搜索

| 模式 | 机制 | 参数 |
|------|------|------|
| keyword | SQL LIKE 匹配 `visualDescription + tags + nameZh` | `mode=keyword` |
| semantic | embedding → 余弦相似度，和 find_concepts 同一逻辑 | `mode=semantic` |

维度选中时添加 `category = ?` 过滤。默认 keyword，搜索框旁边切换。

## 聊天页工具标签

TOOL_NAMES 和 TOOL_LABELS 统一替换为：

| 工具 | 标签 |
|------|------|
| `explore_dimension` | 知识库 · 浏览维度 |
| `get_concept` | 知识库 · 查看概念 |
| `find_concepts` | 知识库 · 搜索概念 |
| `find_patterns` | 知识库 · 匹配模式 |
| `find_references` | 知识库 · 查找参考 |

删除：`knowledge_search`、`discover_visual_concepts`

## 旧数据

- 旧表（artCategories、artSubcategories、artTechniques、styleFamilies、styles、styleTechniqueRecs）保留不动
- 旧 API `/api/knowledge` 和 `/api/styles` 重写/删除
- 旧页面 `/styles` 删除
- 旧工具引用从聊天页 TOOL_NAMES/TOOL_LABELS 中清除
