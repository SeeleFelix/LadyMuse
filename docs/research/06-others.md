# 其他知识源调研

## Artsy Art Genome Project

### 概述
Artsy 的 Art Genome Project 使用 **1,000+ "基因"**（特征）对艺术品分类，覆盖 **12+ 维度**：Art History, Artist Nationality, Art Movement, Medium, Period, Size, Subject, Style, Technique, Color, Gene（主题性）等。

### 价值
- 概念层面参考：12+ 维度模型可以启发 LadyMuse 的分类方式
- "基因"加权的概念类似 LadyMuse 的 `weightHint` 字段

### 限制
- **专有数据**，无公共 API，无开放数据集
- 基因描述简短（1-2 句），聚焦分类不是教学
- 仅作概念参考

## Anatomy For Sculptors

### 概述
专业级艺术解剖参考，被 Id Software、Fortiche/Arcane、Epic Games、Sony Bend、Santa Monica Studio 等使用。覆盖：人体理解、面部表情解剖、头颈形态、手臂和手的运动。

### 价值
- 艺术解剖的金标准
- 按解剖区域（头、颈、躯干、手臂、手、腿、脚）组织
- 覆盖比例、解剖标志、脂肪垫、肌肉附着、面部表情、手势

### 限制
- **商业产品**，无 API，无结构化数据
- 4 卷书籍 + 3D 参考工具
- 仅作概念参考

## e621 标签系统

### 概述
与 Danbooru 相同的底层软件，但聚焦于 furry/拟人化内容。

### 限制
- `tag_groups` wiki 页面**空白** — 没有社区维护的标签组层级
- 以兽人焦点为主，与通用艺术概念映射不佳
- **建议跳过**，Danbooru 严格更优

## Anime Character Database

### 概述
角色外观数据库，有结构化的特征筛选器（性别、年龄、眼色、发色、发长、兽耳）和约 150 个自由标签。

### 限制
- **仅覆盖角色外观**（发型、服装、配饰）
- 无光照、构图、姿态、表情、材料、技法
- 无文档化的 REST API
- **价值极低**

## face-api.js

### 概述
基于 TensorFlow.js 的 JavaScript 面部检测/识别库。提供 **68 点面部标记检测**和 7 种表情识别（neutral, happy, sad, angry, fearful, disgusted, surprised）。

### 价值
- 7 表情分类法和 68 点标记系统为面部表情技法命名提供科学基础
- MIT 协议，完全开放

### 限制
- 是 ML 模型输出，不是艺术知识
- 仅对面部表情子领域有用
