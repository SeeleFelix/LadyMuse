import { readFileSync } from "fs";
import { join } from "path";
import { getConfig } from "../config";
import { getModelProfile, getDefaultProfile } from "./model-profiles";

interface ModuleConfig {
  file: string;
  enabled: boolean;
}

function loadPromptModules(): string {
  const dir = join(import.meta.dirname, "prompts");
  const config: { modules: ModuleConfig[] } = JSON.parse(
    readFileSync(join(dir, "modules.json"), "utf-8"),
  );
  return config.modules
    .filter((m) => m.enabled)
    .map((m) => readFileSync(join(dir, m.file), "utf-8"))
    .join("\n\n");
}

const STYLE_GUIDANCE: Record<string, string> = {
  tags: `你的输出必须是纯标签格式：逗号分隔的关键词/短语。例如："1girl, long hair, blue eyes, standing in rain, neon lights, cinematic lighting, masterpiece, best quality"。需要强调时使用 (keyword:weight) 语法。总长度控制在 75 token 以内效果最佳。`,
  hybrid: `你的输出应该是关键词和自然语言的混合。开头用关键主体标签，然后用描述性自然语言表达氛围和细节。例如："1girl, elegant dress, standing in a moonlit garden, soft ethereal glow filtering through ancient trees, petals drifting in a gentle breeze, cinematic composition, masterpiece"。重要元素可以使用 (keyword:weight) 强调。`,
  natural: `你的输出必须是流畅的自然语言段落式描述。按此结构组织：先明确图片类型和主体（最重要，放最前面），然后描述主体的外观和动作细节，接着是环境背景，再描述光影氛围（光源类型、方向、色温），最后补充风格媒介和品质约束。每个视觉元素要具体：不说"好看的光"，说"柔和的侧光从窗户透入，在脸上形成温暖的明暗过渡"。不要使用权重语法或逗号分隔的标签。必须包含质感/材质词（如 skin texture, fabric detail, film grain）。不需要文字渲染时写 "absolutely no text"。`,
};

export async function buildSystemPrompt(): Promise<string> {
  const targetModelId = (await getConfig("target_image_model")) || "zit";
  const outputLang = (await getConfig("output_language")) || "zh";
  const promptStyle = (await getConfig("prompt_style")) || "hybrid";

  const profile = getModelProfile(targetModelId) || getDefaultProfile();

  const langInstruction =
    outputLang === "en"
      ? `你的输出提示词必须使用英文。`
      : `你的输出提示词必须使用中文。`;

  const zitSpecificRules =
    profile.id === "zit"
      ? `
## Z-Image-Turbo 专用规则

你正在为 Z-Image-Turbo 生成提示词。这是一个蒸馏加速模型，与传统 Stable Diffusion 有本质区别：

1. **加法而非减法**：负面提示词完全无效。不要试图用"不要画什么"来控制，而是用正面描述明确"要画什么"。
2. **自然语言优先**：模型文本编码器对自然语言段落的理解远优于标签堆砌。用完整的描述性句子，不要用逗号分隔的关键词列表。
3. **结构顺序**：[图片类型] → [主体与动作，极其具体] → [服装/外观细节] → [环境背景] → [光影氛围，要具体到光源类型] → [风格/媒介，包含质感词] → [品质约束]
4. **质感词必须**：每次都要包含至少一个质感/材质描述词。没有质感词的画面会显得像塑料。
5. **开头最关键**：把最重要的视觉元素（主体+动作）放在最前面，后续描述按层次有序展开。
6. **文字控制**：如果用户没有要求渲染文字，在末尾加上 "absolutely no text"。如果用户要求文字，用引号明确标注需要显示的内容。
7. **禁止使用的语法**：(keyword:weight) 权重语法、负面提示词、质量标签堆砌（如 masterpiece, best quality, highly detailed 放一堆）。
8. **参数设置**：Steps 固定 8，CFG 固定 0，不生成 negative prompt。
`
      : "";

  const illustriousSpecificRules =
    profile.id === "illustrious"
      ? `
## Illustrious XL 专用规则

你正在为 Illustrious XL 生成提示词。这是基于 SDXL 1.0、在 Danbooru2023 数据集上训练的动漫/插画专用模型。

### 标签格式
1. **纯 Danbooru 标签**：使用逗号分隔的 Danbooru 风格关键词。不要使用自然语言句子。
2. **权重语法**：支持 (keyword:weight) 格式。例如 (blue eyes:1.3)。
3. **标签排列**：越靠前的标签权重越高。建议顺序：角色数量（1girl/1boy）→ 角色名称 → 质量标签 → 外貌特征 → 服装 → 姿势/解剖 → 环境背景 → 额外风格/质量标签。

### 质量标签
模型支持以下质量标签：worst quality, bad quality, average quality, good quality, best quality, masterpiece。
推荐在正向提示词中包含 masterpiece, best quality。

### 负面提示词（必须）
标准负面提示词：
worst quality, comic, multiple views, bad quality, low quality, lowres, displeasing, very displeasing, bad anatomy, bad hands, scan artifacts, monochrome, greyscale, signature, twitter username, jpeg artifacts, 2koma, 4koma, guro, extra digits, fewer digits

### 构图建议
- 使用 upper body, cowboy shot, portrait, full body 等合适的构图标签。
- 不要过度使用冲突的构图标签（如同时使用 close-up 和 upside-down），会导致模型混乱。

### 参数建议
- Steps: 20-28（足够收敛，超过 28 步边际收益递减）
- CFG: 5-7.5（根据场景微调）
- Sampler: Euler a（推荐）
- 基础模型无默认风格，风格由标签和 LoRA 决定。
`
      : "";

  const animaSpecificRules =
    profile.id === "anima"
      ? `
## Anima 专用规则

你正在为 Anima 生成提示词。这是 CircleStone Labs 与 Comfy Org 合作开发的 2B 参数动漫/插画模型，基于 NVIDIA Cosmos 架构，使用 Qwen 3 0.6B 文本编码器和 Qwen Image VAE。

### 标签格式
1. **Danbooru 风格标签**：逗号分隔的关键词。使用小写，用空格代替下划线（score 标签除外，如 score_9）。
2. **Gelbooru 优先**：当 Danbooru 和 Gelbooru 标签不同时，优先使用 Gelbooru 版本。
3. **自然语言兼容**：模型同时训练了自然语言描述，可以纯标签、纯自然语言、或混合使用。混合使用时可以把质量/画师标签放在自然语言描述之前。
4. **权重语法**：支持 (keyword:weight) 格式。
5. **标签 dropout**：模型训练时使用了随机标签 dropout，不需要包含所有相关标签。

### 标签排列顺序（严格）
[质量/元数据/时间/安全标签] → [1girl/1boy/1other 等] → [角色名] → [系列/出处] → [画师] → [一般描述标签]

每个区块内部顺序自由。

### 质量标签（两套可混用）
- 人工评分：masterpiece, best quality, good quality, normal quality, low quality, worst quality
- 美学模型评分：score_9, score_8, score_7, ..., score_1
- 可以单独使用、组合使用、或不使用。

### 推荐正向前缀
masterpiece, best quality, score_7, safe,

### 推荐负面提示词
worst quality, low quality, score_1, score_2, score_3, artist name

### 安全标签
safe, sensitive, nsfw, explicit

### 画师标签
画师标签必须加 @ 前缀。例如：@big chungus。不加 @ 效果会很弱。

### 时间标签
- 具体年份：year 2025, year 2024, ...
- 时间段：newest, recent, mid, early, old

### 元数据标签
highres, absurdres, anime screenshot, jpeg artifacts, official art 等。

### 数据集标签（非动漫内容）
用于非动漫内容时，在提示词开头使用：
- ye-pop（后跟换行和描述）
- deviantart（后跟换行和作品标题/描述）

### 自然语言提示建议
- 角色和系列名使用标准英文大写规则。
- 纯自然语言时至少写 2 个句子，极短提示可能产生意外结果。
- 多角色时必须描述每个角色的外观，仅列出角色名会导致混淆。
- 可以在自然语言中嵌入质量标签和画师标签。

### 参数建议
- Steps: 30-50
- CFG: 4-5
- 推荐采样器：
  - er_sde：中性风格，平涂色彩，锐利线条（推荐默认）
  - euler_a：较柔和，线条更细，有时偏向 2.5D 风格，CFG 可以稍高
  - dpmpp_2m_sde_gpu：类似 er_sde 但更有创意变化，有时会过于狂野
- 追求写实/绘画质感时可使用 beta57 调度器（需 ComfyUI RES4LYF 节点）
- 分辨率约 1MP：1024×1024, 896×1152, 1152×896

### 限制
- 不擅长写实风格（设计如此，专注于动漫/插画/艺术）
- 短提示可能产生不理想内容，需要详细描述并使用安全标签
- 文字渲染能力有限，单词和短句可以，长文本不行
- 高分辨率（约 2MP 以上）会开始崩坏
`
      : "";

  const modelSpecificRules =
    zitSpecificRules + illustriousSpecificRules + animaSpecificRules;

  const modules = loadPromptModules();

  return `${modules}

## 目标图像模型
用户使用的是：**${profile.name}**（${profile.id.toUpperCase()}）
该模型的特点和建议：
${profile.tips}
推荐默认参数：
- Sampler: ${profile.defaultParams.sampler}
- Scheduler: ${profile.defaultParams.scheduler}
- Steps: ${profile.defaultParams.steps}（范围 ${profile.stepRange[0]}-${profile.stepRange[1]}）
- CFG Scale: ${profile.defaultParams.cfgScale}（范围 ${profile.cfgRange[0]}-${profile.cfgRange[1]}）
- 分辨率: ${profile.resolutions.join(", ")}
- 反向提示词: ${profile.negativeRequired ? "需要" : "不需要"}
- 权重语法: ${profile.weightSyntax === "parentheses" ? "支持 (keyword:weight)" : "不支持"}

${modelSpecificRules}
## 提示词风格
${STYLE_GUIDANCE[promptStyle] || STYLE_GUIDANCE.hybrid}

## 输出语言
${langInstruction}`;
}
