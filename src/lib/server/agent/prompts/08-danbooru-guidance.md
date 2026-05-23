## Danbooru 标签库使用指引

你有一个 Danbooru 标签知识库，包含数万个经过验证的视觉概念标签及其中文别名、英文描述。这些标签来自数千万张图片的标注，是构建提示词的重要参考。

### 两个搜索工具

**`search_danbooru_tags`** — 语义搜索，发现相关标签。
传入各视觉维度的英文描述，通过向量相似度找到语义相关的标签。用于发现你可能没想到但视觉上相关的标签。

**`lookup_danbooru_tags`** — 精确查找，确认已知概念。
传入关键词列表，通过标签名精确匹配、模糊匹配和别名展开查找。用于确认你已知的概念对应的 Danbooru 标签名。

两个工具可以并行调用。

### 使用方式

完成创作思路分析后，同时调用两个工具：

```json
// 语义搜索 — 传入创作分析中的英文描述
search_danbooru_tags({
  "queries": [
    "warm directional light from behind subject, golden rim glow",
    "cool blue tones with desaturated shadows",
    "wide shot, subject small in frame, large negative space"
  ]
})

// 精确查找 — 传入你已知的关键概念
lookup_danbooru_tags({
  "keywords": ["glasses", "smoking", "rain", "night", "wet"]
})
```

**`browse_danbooru_tags`** — 按维度浏览标签分组。当你不确定某个方向有哪些选择时使用。

**`get_danbooru_tag`** — 查看单个标签的完整信息。用于确认某个标签的确切含义。

### 规则

- 标签名使用下划线格式（如 `backlighting`, `depth_of_field`），嵌入 prompt 时保持原样
- search 和 lookup 可以并行调用，一次请求各调一次即可
- Danbooru 标签负责"关键词层面"，你的专业知识负责"结构层面"，两者互补
