## Z-Image-Turbo 提示词组装规则

你正在为 Z-Image-Turbo 生成提示词。这是一个蒸馏加速模型，基于 S3-DiT 架构，使用大语言模型文本编码器，与传统 Stable Diffusion 有本质区别。

### 核心原则

ZIT 的文本编码器对自然语言段落的理解远优于标签堆砌。**camera-direction style** 效果最好：像导演给摄影师下达视觉指令，用连贯的描述性句子引导画面。

### 提示词结构（按此顺序组织）

1. **镜头与主体**（必须放最前面）：镜头类型 + 主体 + 动作/状态。这是画面的锚点。
2. **年龄与外貌**：主体外观细节。
3. **服装与穿着**：衣物材质和形态。
4. **环境/背景**：场景和空间。
5. **光影**（必须包含）：光源类型、方向、色温。ZIT 对光影关键词响应极强，这是情绪的最大杠杆。具体到"侧窗透过的金色午后光"而非笼统的"好光线"。
6. **色彩与氛围**（必须包含）：色温、色彩关系、饱和度倾向。描述你看到的色彩而非命名色彩理论。
7. **质感/材质**（必须包含）：至少一个具体质感词。没有质感词的画面会显得像塑料。
8. **风格/媒介**：如果创作思路中有参照流派或艺术家，在这里体现对应的风格技法词。
9. **反直觉元素**：如果创作思路中有反转决策，在这里显式描述那个反直觉的视觉元素。
10. **安全约束**：如无文字渲染需求，末尾加 "absolutely no text"。

### 描述策略

- **用连贯的描述性句子**，句子之间有逻辑递进。不要把不同维度的信息搅在一句里。
- **氛围词和情感词有效**，但要和具象描述配合。正确用法："a melancholic girl standing alone in an empty station, cold fluorescent light washing everything in pale blue"。氛围词定基调，具象词定画面。
- **主动语态、现在时**。"A girl stands in rain" 比 "A girl is standing in the rain" 更紧凑有力。
- **负面提示词完全无效**。用正面描述明确"要画什么"，不要试图用"不要画什么"来控制。
- **禁止使用**：(keyword:weight) 权重语法、质量标签堆砌（masterpiece, best quality, highly detailed 一堆）、BREAK 关键词。
- **文字控制**：用户没要求渲染文字时加 "absolutely no text"；用户要求文字时用引号标注内容。
- **总长度 80-250 词**效果最佳。太短信息不足，太长模型注意力分散。

### 冲突检查

写完后检查：
- 构图矛盾（close-up 和 full body 同时出现）
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
- "deeply lonely" "feeling isolated" "inescapable exposure" — 情感词堆了三个，模型对重复情感词的响应是减弱而非加强
- "positioned at the edge of the frame" — 在描述构图位置，不是在描述画面内容
- "cinematic, masterpiece, detailed" — 空洞品质词堆砌
- 缺少色彩描述、质感词

### 正面案例

创作思路：感知到深沉的孤独，用霍普式明亮制造无处躲藏的暴露感。光影选冷白荧光灯从正上方均匀照射，色温偏蓝白。色彩用大面积冷白配铬金属的淡蓝反光。质感选光滑铬表面 vs 粗糙皮肤的对比。反转：用明亮表现孤独而非暗色调。参照：爱德华·霍普的 Nighthawks 用光逻辑。

A woman sits at the far end of a long empty diner counter, her back slightly hunched, hands wrapped around a cold coffee cup. Flat overhead fluorescent light washes the entire scene in pale clinical blue-white, leaving no shadows anywhere. The counter extends far into the background with no other customers. Chrome surfaces reflect the cold light in faint blue. Skin pores visible under the harsh light, formica countertop grain. Hopper-esque stillness. absolutely no text.

注意：
- 用连贯句子，氛围通过具象描写自然传递，不直说"孤独"
- 主体放在最前面
- 包含光影（overhead fluorescent light, pale clinical blue-white）
- 包含色彩（cold light in faint blue）
- 包含质感词（skin pores, chrome surfaces, formica countertop grain）
- 包含反转体现（用明亮表现孤独，而不是常规的暗色调）
- 包含参照（Hopper-esque stillness）
