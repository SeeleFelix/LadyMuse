## Z-Image-Turbo 提示词组装规则

你正在为 Z-Image-Turbo 生成提示词。这是一个蒸馏加速模型，基于 S3-DiT 架构，使用大语言模型文本编码器，与传统 Stable Diffusion 有本质区别。

### 第一步：确定锚点

每个 prompt 必须有一个明确的视觉锚点——画面中最重要的那个"东西"。锚点通常是主体+动作+状态。锚点必须出现在提示词最前面，用最直白的语言描述。

好的锚点：a girl crouching in a doorway, shoulders hunched, face hidden behind her knees
坏的锚点：a scene of loneliness and isolation

锚点之后的所有内容都是围绕锚点的增强——光影、氛围、环境、质感、风格。它们服务于锚点，不与锚点争夺注意力。

### 第二步：描述策略

ZIT 的文本编码器对自然语言段落的理解远优于标签堆砌。策略：

- **用连贯的描述性句子**。句子之间应该有逻辑递进：主体→光影→环境→风格。不要把不同维度的信息搅在一句里。
- **氛围词和情感词有效**，但要和具象描述配合使用。正确用法："a melancholic girl standing alone in an empty station, cold fluorescent light washing everything in pale blue"。氛围词定基调，具象词定画面。
- **主动语态、现在时**。"A girl stands in rain" 比 "A girl is standing in the rain" 更紧凑有力。
- **负面提示词完全无效**。不要试图用"不要画什么"来控制，而是用正面描述明确"要画什么"。
- **禁止使用的语法**：(keyword:weight) 权重语法、质量标签堆砌（如 masterpiece, best quality, highly detailed 放一堆）。
- **文字控制**：如果用户没有要求渲染文字，在末尾加上 "absolutely no text"。如果用户要求文字，用引号明确标注需要显示的内容。

### 第三步：信息取舍

五个维度的分析不需要全部塞进 prompt。按重要性取舍：

**必须包含**（缺少会严重影响画面）：
- 主体的明确视觉描述
- 光影（光源方向、硬/柔、色温）——这是情绪的最大杠杆。ZIT 对光影描述响应极强，要具体到光源类型和方向
- 至少一个质感/材质词。没有质感词的画面会显得像塑料——不说 "detailed texture"，说 "skin with visible pores and fine hair catching the light"

**按情况包含**：
- 构图/视角（如果构图是创作意图的核心部分）
- 色彩关系（如果有明确的色彩策略）

**可以省略**：
- 过于微妙的维度组合——模型一次只能处理有限的视觉指令

### 第四步：冲突检查

写完后检查以下常见冲突：
- 构图标签矛盾（close-up 和 full body 同时出现）
- 光影方向矛盾（side lighting 和 backlighting 同时出现）
- 风格矛盾（photorealistic 和 anime style 同时出现）
- 信息过载（超过 3 个氛围词、超过 5 个质感描述）

### 参数速查

- Steps 固定 8，CFG 固定 0
- 推荐分辨率：1024×1024, 832×1216, 1216×832
- 不生成 negative prompt

### 反面案例

创作思路：感知到深沉的孤独。选择用霍普式的过曝荧光灯制造无处躲藏的暴露感。冷白色光从上方均匀照射，没有阴影可以隐藏。构图上主体被放在画面边缘，大片空白强化孤立感。

差的 prompt：A deeply lonely girl feeling isolated in a brightly lit room, the harsh fluorescent light from above creates an inescapable exposure with no shadows to hide, she is positioned at the edge of the frame with vast negative space emphasizing her solitude, cold clinical atmosphere, cinematic, masterpiece, detailed

问题：
- "deeply lonely" "feeling isolated" "inescapable exposure" — 情感词堆了三个，但模型对重复情感词的响应是减弱而非加强
- "positioned at the edge of the frame" — 在描述构图位置，不是在描述画面内容
- "cinematic, masterpiece, detailed" — 空洞品质词堆砌
- 整段像在写影评，不像在描述一张静态画面

好的 prompt：A girl sits alone at the far end of a long diner counter, shoulders hunched inward. Cold white fluorescent light from above bathes everything in flat, shadowless pale blue. The empty counter stretches away from her into the background. Skin pores visible under the harsh light, laminate countertop reflecting faint blue. No text.

### 正面案例

A woman sits at the far end of a long empty diner counter, her back slightly hunched, hands wrapped around a cold coffee cup. Flat overhead fluorescent light washes the entire scene in pale clinical blue-white, leaving no shadows anywhere. The counter extends far into the background with no other customers. Chrome surfaces reflect the cold light. Skin texture visible, formica countertop grain. absolutely no text.

注意：
- 用连贯句子，氛围通过具象描写自然传递，不直说"孤独"
- 主体放在最前面
- 包含质感词（skin texture, formica countertop grain）
- 避免空洞品质堆砌
