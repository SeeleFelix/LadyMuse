# Danbooru 标签体系调研

## 概述

Danbooru（danbooru.donmai.us）是最大的 anime 图片板，拥有社区维护的结构化标签分类体系。其标签直接对应 AI 图像生成中使用的视觉概念，是目前发现的最实用的视觉概念词汇源。

## 结构

三层体系：

### 1. 标签类别（5 个固定类别）
- `general` (0) — 视觉描述符，**主要知识来源**
- `artist` (1) — 创作者
- `copyright` (3) — 作品/系列
- `character` (4) — 角色名
- `meta` (5) — 图像元数据（highres, scan 等）

### 2. 标签蕴含（Tag Implications）
- 标签有父子关系：`eagle` → `bird` → `avian`
- 创建了隐式本体/分类
- API: `/tag_implications.json`

### 3. 标签组 Wiki 页面（社区维护的层级分类）
- 顶级索引：`wiki_pages/tag_groups`
- 按视觉概念组织的专门 wiki 页面

## 视觉概念标签组（核心价值）

### tag_group:image_composition（~200+ 标签，13 节）
- **视角**: from above, from below, from side
- **透视/深度**: foreshortening, depth of field, vanishing point
- **构图**: asymmetry, center focus, rule of thirds
- **格式**: close-up, cowboy shot, full body, portrait
- **主体数量**: duo, group, solo
- **框架**: letterboxed, out of frame
- **风格**: aesthetic, photo(realistic)
- **技术**: bloom, bokeh, chromatic aberration, chromatic shift, cinematic lighting, dutch angle, lens flare, motion blur, tilt shift, vignette

### tag_group:lighting（7 节）
- **方向**: backlighting, overlighting, sidelighting, underlighting
- **类型**: bloom, spotlight, caustics, refraction
- **时段**: dawn, dusk, golden hour, nighttime, sunset
- **光源**: sun, moon, lamp, torch, fire, flashlight
- **其他**: god rays, rim lighting, volumetric lighting
- **缺光**: shade, shadow, silhouette

### tag_group:posture（14 节）
- **基础姿势**: kneeling, lying, sitting, standing
- **运动**: dancing, falling, flying, jumping, running, walking
- **头部**: head tilt, looking up, looking away
- **手臂**: akimbo, behind back, crossed, raised
- **手部**: open hand, clenched hand, pointing, peace sign
- **腿部**: crossed legs, spread arms
- **多人**: carrying, hand hold, hug, kiss
- **标志姿势**: JoJo pose, Gendou pose, Titanic pose

### tag_group:visual_aesthetic（艺术风格）
- **美学**: cyberpunk, steampunk, vaporwave, synthwave, weirdcore, dreamcore, cottagecore
- **艺术风格**: art deco, art nouveau, baroque, cubism, impressionism, ukiyo-e, sumi-e
- **设计元素**: abstract, geometric, minimalism, ornate

### tag_group:colors
- 单色主题、调色板、滤镜（sepia, pastel, neon）、色彩理论（analogous, complementary, triadic, warm/cool）

### tag_group:backgrounds
- 颜色、图案（20+ 类型）、描述性、物体、媒介

### tag_group:gestures
- 按手指配置组织的精细手势分类

### tag_group:focus_tags
- 景深/对焦相关标签

## API 端点

| 端点 | 用途 |
|------|------|
| `GET /tags.json` | 搜索标签（按类别、名称、频率过滤） |
| `GET /tags/{id}.json` | 标签详情（post_count, category） |
| `GET /wiki_pages.json` | 搜索 wiki 页面 |
| `GET /wiki_pages/{title}.json` | wiki 页面内容（markdown） |
| `GET /tag_implications.json` | 蕴含关系 |
| `GET /tag_aliases.json` | 别名关系 |
| `GET /related_tags.json` | 共现数据 |
| `GET /posts.json` | 按标签搜索图片 |
| `GET /autocomplete.json` | 标签自动补全 |

- **无需认证**即可读取（速率限制：500 请求/小时）
- JSON 响应，支持分页和过滤

## 优缺点

### 优点
- 标签直接对应 AI 图像生成使用的视觉概念
- 规模巨大——数十万标签，带真实使用数据
- 标签频率数据（post_count）揭示哪些视觉概念最常用
- 社区维护的 wiki 页面提供定义
- 已经是图像生成模型能理解的格式

### 缺点
- 标签是扁平字符串，没有正式层级（wiki 页面提供临时分组）
- Wiki 描述是打标签指南，不是艺术教育
- 偏 anime/manga 内容；传统美术技法覆盖弱
- 标签名不总是直观或标准的（有些是日文音译）
- 没有提示词关键词格式/NL描述/情绪标签结构
- 没有难度评级
- 速率限制 API（500 请求/小时未认证）
- 内容包含 NSFW 标签

## 对 LadyMuse 的价值

**最高实用价值。** 最佳集成方式：
1. 运行时工具查询相关标签组，发现可用视觉概念
2. 使用标签频率数据确定优先级
3. 交叉比对现有技法，发现缺失概念
4. 使用标签蕴含关系构建概念关系图
