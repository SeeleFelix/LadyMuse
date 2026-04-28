# Wikidata 艺术概念调研

## 概述

Wikidata 是全球最大的开放式知识图谱，包含数百万实体的结构化数据。WikiProject Visual Arts 提供了视觉艺术实体的本体建模指南。

## 结构

知识图谱结构。实体通过属性（properties）和限定符（qualifiers）连接。参考了以下元数据标准：
- **CDWA**（Categories for Description of Works of Art）— 384 个类别
- **CCO**（Cataloging Cultural Objects）
- **CIDOC CRM** — 国际文化遗产信息标准
- Getty AAT

## API 与数据

### SPARQL 端点
- `https://query.wikidata.org/sparql` — 完全开放，可查询

### 批量导出
- JSON 和 RDF 格式（完整转储数百 GB）

### REST API
- 单个实体查询

## 许可

**CC0（公共领域贡献）**
- 不需要署名
- 完全开放，任何用途
- 所有调研资源中最宽松的协议

## 覆盖

极其广泛但深度不一致。部分艺术概念有丰富的结构化数据（画作的尺寸、材料、位置、风格、时期）；其他只有最少数据。

### 擅长的
- 概念间的**关系连接**（画家→流派、技法→材料、风格→时期）
- **多语言标签**（CC0 协议，包括中文）
- 大量实体的基本元数据

### 不擅长的
- 深度的技法描述
- 实践指导（"怎么用"）
- 一致的数据质量

## 对 LadyMuse 的价值

**中等。** 主要用途：
1. **多语言标签补全** — CC0 协议最宽松，可以自由使用任何语言的标签
2. **概念关系图** — 构建技法→材料→风格的关系网络
3. **与 Getty AAT 交叉引用** — AAT 概念已有 Wikidata 链接
4. **中文翻译** — 为现有技法补充中文名称

如果已使用 Getty AAT，Wikidata 的增量价值主要在于 CC0 协议更宽松（不需要署名）。
