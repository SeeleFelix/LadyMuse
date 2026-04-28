# Getty Art & Architecture Thesaurus (AAT) 调研

## 概述

Getty AAT 是现存最权威的艺术词汇表，由 Getty Research Institute 维护。包含 74,460 个概念记录和 503,230 个术语，覆盖所有艺术领域。

## 数据格式与访问

### 可用格式
- **JSON**（Linked.Art 语义模型，基于 CIDOC-CRM）
- **JSON-LD**
- **RDF/XML**, **N3/Turtle**, **N-Triples**

### API 端点
- **SPARQL 端点（新）**: `https://data.getty.edu/vocab/sparql`
- **SPARQL 端点（旧）**: `http://vocab.getty.edu/sparql`
- **JSON API**: 单个概念查询
- **批量下载**: `http://vocab.getty.edu/dataset/aat/`
  - `explicit.zip`（106 MB）— 显式/未压缩三元组
  - `full.zip`（195 MB）— 完整数据集
- **最后更新**: 2019 年 12 月 9 日

### 示例查询

获取照明相关概念：
```sparql
SELECT ?subject ?label WHERE {
  ?subject gvp:prefLabelGVP ?label .
  FILTER(LANG(?label) = "en")
  FILTER(CONTAINS(LCASE(STR(?label)), "light"))
} LIMIT 20
```

获取技法相关概念：
```sparql
SELECT ?subject ?label WHERE {
  ?subject gvp:prefLabelGVP ?label .
  FILTER(LANG(?label) = "en")
  FILTER(CONTAINS(LCASE(STR(?label)), "technique"))
} LIMIT 20
```

## 规模与结构

### 8 个顶层 Facet
1. **Associated Concepts** — 抽象概念、理论
2. **Physical Attributes** — 属性、条件、设计元素、**颜色**
3. **Styles and Periods** — 风格与时期
4. **Agents** — 人物、组织
5. **Activities** — 学科、功能、事件、**工艺与技法**
6. **Materials** — 材料（独立 facet）
7. **Objects** — 最大 facet，13+ 层级
8. **Brand Names** — 品牌名

### 层级深度
- 多重层级（Polyhierarchical）：概念可以有多个父节点
- 深度范围 3-7 层
- 示例链：Activities > Processes and Techniques > image-making > painting (image-making) > [easel painting, mural painting, glass painting, ...]

## JSON 结构（Linked.Art 格式）

每个概念包含：
- `_label`: 显示名
- `broader` / `narrower`: 层级关系
- `identified_by`: 多语言术语（Name, Identifier）
- `subject_of`: 多语言 scope notes
- `equivalent`: Wikidata 交叉引用
- `la:related_from_by`: 语义关系（如 "produces - things", "requires - things"）

## 覆盖评估

| 领域 | 覆盖 | 说明 |
|------|------|------|
| 绘画技法 | **优秀** | 深层层级：easel painting, fresco, encaustic, tempera, oil painting, watercolor, acrylic 等 |
| 摄影技法 | **良好** | 在 Processes and Techniques 下，但偏向传统摄影工艺 |
| 色彩理论 | **良好** | Physical Attributes 下有专门的 Color 层级 |
| 构图 | **有限** | 概念存在但未深入展开 |
| 人体解剖 | **无** | AAT 聚焦于艺术元数据 |
| 光影 | **有限** | 照明设备和一般概念存在，但不是摄影/绘画布光方案 |
| 材料 | **优秀** | 专门的 Materials facet，层级丰富 |
| 数字艺术/AI | **无** | 传统艺术词汇 |

## 许可

**Open Data Commons Attribution License (ODC-By) v1.0**
- 需要署名："This data is derived from the Getty AAT dataset and licensed under ODC-By 1.0"
- 允许商业使用
- 无 copyleft 限制

## 实际集成可行性

### 能调通吗？可以
- SPARQL 端点可用，研究时实际跑过查询
- JSON API 可用
- 批量下载可用

### 能拿到什么
- 概念名称（英文 + 中文等多种语言）
- 学术定义（scope note）
- 层级关系（broader/narrower）
- Wikidata 交叉引用

### 示例数据
```
名称: oil painting (油画)
定义: "The art of applying pigments suspended in oil to a surface..."
上层: painting (image-making)
下层: [alla prima, impasto, glazing, scumbling...]
中文: 油画
```

### 拿不到的
- 没有 AI 生图相关的提示词关键词
- 没有情绪标签、适用场景、组合建议
- 没有难度评级
- 数据格式是 RDF/Linked.Art，解析成本高

## 对 LadyMuse 的价值

**高作为参考，低作为直接数据源。** 最佳用途：
1. **材料/媒介词汇** — LadyMuse 尚未覆盖艺术材料，AAT 的 Materials facet 可以建立新分类
2. **传统技法** — 扩展绘画/技法覆盖（fresco, encaustic, tempera 等其他来源不会有的概念）
3. **中文翻译** — AAT 已有中文术语
4. **分类验证** — 对比 LadyMuse 的分类与业界标准
5. **学术定义** — 可改编为教育性描述
