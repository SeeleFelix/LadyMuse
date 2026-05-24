## Anima 提示词组装规则

你正在为 Anima 生成提示词。这是 CircleStone Labs 基于 NVIDIA Cosmos 架构的 2B 参数动漫/插画模型，使用 Qwen3 0.6B 文本编码器，与传统 CLIP 编码器模型有本质区别。

### 第一步：确定锚点

Anima 使用 hybrid 模式：**元数据用标签前缀 + 画面内容用自然语言**。元数据标签（quality/safety/artist/time）用逗号分隔放在最前面，后面紧跟 NL 主体描述。

好的锚点：masterpiece, best quality, score_7, safe, @artist_name. An anime girl with medium-length blonde hair sits alone at a diner counter, shoulders hunched, hands wrapped around a cold cup.
坏的锚点：只写标签堆砌没有 NL 描述，或只有 NL 没有元数据标签前缀

多角色时，每个角色必须命名 + 描述外观，不能只列名字。

### 第二步：描述策略

标签部分和 NL 部分的分工：

**用标签写（元数据）**：
- quality 标签：masterpiece, best quality, good quality 等人类评分体系，和/或 score_9 到 score_1 的 PonyV7 美学体系。两套可混用、单用或不用。
- 安全标签：safe, sensitive, nsfw, explicit（必须包含一个）
- 时间标签：year 2025, newest, recent, mid, early, old（按需）
- 画师标签：必须加 @ 前缀（@big chungus），不加 @ 效果很弱
- meta 标签：highres, absurdres, anime screenshot 等（按需）

**用自然语言写（画面内容）**：
- 主体：角色外观、动作、表情、姿势
- 环境：场景、空间关系
- 光影：光源类型、方向、色温（Qwen3 编码器对光影描述响应强）
- 色彩：色调策略、氛围

**关键规则**：
- 标签用**小写**、**空格代替下划线**（唯一例外：score 标签保留下划线，如 score_7）
- (keyword:weight) 权重可用，但需要**比 SDXL 更高的权重值**，如 (chibi:2)
- Danbooru 和 Gelbooru 标签不同时，**优先用 Gelbooru 版本**
- 训练时有 random tag dropout，**不需要穷举所有相关标签**——选关键的就好
- 自然语言部分**至少 2 句**，太短会产生意外结果

### 第三步：信息取舍

**必须包含**：
- 至少一个 quality 标签（否则 Base 模型的默认风格非常朴素中性）
- 一个安全标签
- 主体 NL 描述，至少 2 句

**按需包含**：
- 画师标签（有风格期望时几乎是必须的——Base 模型无美学调优）
- 时间标签
- 系列/角色标签

**可以省略**：
- 细枝末节的 general tags——tag dropout 训练意味着缺几个标签模型也能自行补全
- 分析性的"为什么这样选"——这些是给用户看的，不进 prompt

### 第四步：冲突检查

写完后检查：
- 构图矛盾（close-up 和 full body 同时出现）
- 光影方向矛盾（side lighting 和 backlighting 同时出现）
- 风格矛盾（photorealistic 和 anime style 同时出现，Anima 不擅长写实）
- 标签冗余（同一概念用不同标签重复描述）

### 第五步：参数速查

**采样器选择**（根据用户意图）：

| 用户想要 | 采样器 | 特点 |
|----------|--------|------|
| 锐利线条、平色、干净画面 | er_sde | 默认推荐，中性风格 |
| 柔和、细线、偏 2.5D | euler_a | CFG 可略高于 6 |
| 多样、创意、接受偶尔狂野 | dpmpp_2m_sde_gpu | 更有变化 |

- Steps: 30-50，CFG: 4-6
- Scheduler: 默认即可
- 推荐分辨率：1024×1024, 832×1216, 1216×832, 896×1152, 1152×896

**推荐正向前缀**：
masterpiece, best quality, score_7, safe,

**推荐负面提示词**：
worst quality, low quality, score_1, score_2, score_3, artist name

### 好的示例

prompt：
masterpiece, best quality, score_7, safe, @big chungus. An anime girl with medium-length blonde hair sits alone at the far end of a long empty diner counter, shoulders hunched inward, hands wrapped around a cold coffee cup. Cold white fluorescent light from above bathes everything in flat, shadowless pale blue, the empty counter stretching away into the background. Skin texture visible, laminate countertop reflecting faint blue.

注意：
- 元数据标签前缀（quality + safety + artist）用逗号分隔
- 画面主体 + 环境 + 光影全部用 NL 句子
- 至少 2 句 NL
- 画师加了 @ 前缀
- 包含质感词（skin texture, laminate countertop）
- 没有穷举 general tags

### 坏的示例

**示例 1：只有标签，没有 NL**
1girl, solo, sitting, hunched shoulders, masterpiece, best quality, highres, safe, @big chungus, blonde hair, long hair, blue eyes, diner, counter, fluorescent lighting, cold color, pale blue, skin texture, looking at viewer, upper body

问题：Anima 的 Qwen3 编码器擅长理解 NL，纯标签模式浪费了 NL 理解能力。

**示例 2：NL 太短**
masterpiece, best quality, safe. A sad anime girl.

问题：NL 只有 1 句，极短的 prompt 在 Anima 上会产生意外结果。至少 2 句，越详细越好。

**示例 3：画师没有 @ 前缀**
masterpiece, best quality, safe, big chungus. An anime girl standing in a garden...

问题：画师标签必须加 @ 前缀，不加 @ 效果非常弱。
