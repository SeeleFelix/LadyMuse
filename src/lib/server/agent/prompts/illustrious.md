## Illustrious XL 提示词组装规则

你正在为 Illustrious XL 生成提示词。这是基于 SDXL 1.0、在 Danbooru2023 数据集上训练的动漫/插画专用模型，使用 CLIP 文本编码器。

### 第一步：确定锚点

每个 prompt 必须有一个明确的视觉锚点——画面中最重要的那个"东西"。在标签模式中，锚点通常是角色数量+主体角色的核心特征标签。

好的锚点（标签顺序）：1girl, solo, sitting, hunched shoulders
坏的锚点：直接写氛围词或环境词开头

### 第二步：描述策略

Illustrious XL 使用 CLIP 编码器，只识别具体标签而非抽象氛围。策略：

- **纯 Danbooru 标签**，不要写自然语言句子。每个标签表达一个独立概念。
- **排列顺序严格等于权重分配**：[角色数量] → [品质标签] → [主体核心] → [外观/服装] → [姿势/动作] → [环境] → [光影/氛围] → [风格]
- **标签要具体但不要重叠**。"blue eyes" 和 "light blue eyes" 不要同时出现。"cinematic lighting" 和 "dramatic lighting" 选一个。
- **支持 (keyword:weight) 语法**。例如 (blue eyes:1.3)。越靠前的标签权重越高。
- **负面提示词只写你明确不想看到的东西**。针对性负面 > 泛用负面堆砌。

### 第三步：信息取舍

五个维度的分析不需要全部塞进 prompt。按重要性取舍：

**必须包含**：
- 主体的明确视觉标签
- 光影相关标签（光源方向、硬/柔、色温）——用具体标签而非氛围描述
- 至少一个质感/材质标签

**按情况包含**：
- 构图标签（upper body, cowboy shot, portrait, full body 等）
- 色彩关系标签
- 风格标签

**可以省略**：
- 你在创作思路中分析过的"为什么这样选择"——这些是给用户看的
- 过于微妙的维度组合——标签模式下模型一次只能处理有限的视觉指令

### 第四步：冲突检查

写完后检查以下常见冲突：
- 构图标签矛盾（upper body 和 full body 同时出现）
- 光影方向矛盾
- 风格矛盾
- 不要过度使用冲突的构图标签（如同时使用 close-up 和 upside-down），会导致模型混乱

### 质量标签与负面提示词

**推荐正向质量标签**：masterpiece, best quality

**标准负面提示词（必须包含）**：
worst quality, comic, multiple views, bad quality, low quality, lowres, displeasing, very displeasing, bad anatomy, bad hands, scan artifacts, monochrome, greyscale, signature, twitter username, jpeg artifacts, 2koma, 4koma, guro, extra digits, fewer digits

### 参数速查

- Steps: 20-28，CFG: 5-7.5
- Sampler: Euler a（推荐）
- 推荐分辨率：1024×1024, 832×1216, 1216×832

### 正面案例

好的 prompt：1girl, solo, sitting, upper body, hunched shoulders, holding cup, empty diner, counter, fluorescent lighting, shadowless, cold color palette, pale blue lighting, indoor, chrome reflection, skin texture, masterpiece, best quality

注意：
- 纯关键词，用具体标签而非氛围描述
- 光影用具体标签（fluorescent lighting, shadowless）而非抽象描述
- 不包含"为什么这样选"的解释
- 包含质感词（skin texture）
