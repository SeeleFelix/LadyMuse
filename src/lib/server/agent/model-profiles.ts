export interface ModelProfile {
  id: string;
  name: string;
  promptStyle: "tags" | "hybrid" | "natural";
  weightSyntax: "parentheses" | "none";
  defaultParams: {
    sampler: string;
    scheduler: string;
    steps: number;
    cfgScale: number;
    width: number;
    height: number;
  };
  stepRange: [number, number];
  cfgRange: [number, number];
  resolutions: string[];
  negativeRequired: boolean;
  tips: string;
}

const profiles: ModelProfile[] = [
  {
    id: "zit",
    name: "Z Image Turbo",
    promptStyle: "natural",
    weightSyntax: "none",
    defaultParams: {
      sampler: "Euler",
      scheduler: "normal",
      steps: 8,
      cfgScale: 0,
      width: 1024,
      height: 1024,
    },
    stepRange: [4, 12],
    cfgRange: [0, 0],
    resolutions: [
      "1024×1024",
      "832×1216",
      "1216×832",
      "960×1088",
      "640×1536",
      "1536×640",
    ],
    negativeRequired: false,
    tips:
      "Z-Image-Turbo 是阿里巴巴通义实验室 6B 参数蒸馏加速模型，基于 S3-DiT 架构。" +
      "8 步极速生成，guidance_scale 必须设为 0（蒸馏模型无 CFG，负面提示词完全无效）。" +
      "使用详细自然语言描述效果最佳，不要用逗号分隔的标签或 (keyword:weight) 权重语法。" +
      "必须包含质感/材质描述词（skin texture, fabric detail, film grain 等），否则画面容易出现塑料感。" +
      "支持中英双语混用和文字渲染（将文字放在引号内指定）。" +
      "光影描述是 ZIT 最强维度，要具体描述光源类型和方向。" +
      "不需要文字时写 'absolutely no text' 防止画面出现假文字。" +
      "推荐分辨率 1024×1024，支持 512-2048 任意比例。",
  },
  {
    id: "sdxl",
    name: "Stable Diffusion XL",
    promptStyle: "hybrid",
    weightSyntax: "parentheses",
    defaultParams: {
      sampler: "DPM++ 2M Karras",
      scheduler: "karras",
      steps: 28,
      cfgScale: 7.0,
      width: 1024,
      height: 1024,
    },
    stepRange: [20, 50],
    cfgRange: [5.0, 12.0],
    resolutions: ["1024×1024", "832×1216", "1216×832"],
    negativeRequired: true,
    tips: "SDXL 混合关键词和自然语言，20-30 步通常够用。推荐 DPM++ 2M Karras sampler。",
  },
  {
    id: "sd15",
    name: "Stable Diffusion 1.5",
    promptStyle: "tags",
    weightSyntax: "parentheses",
    defaultParams: {
      sampler: "Euler a",
      scheduler: "normal",
      steps: 28,
      cfgScale: 7.0,
      width: 512,
      height: 768,
    },
    stepRange: [20, 50],
    cfgRange: [5.0, 15.0],
    resolutions: ["512×512", "512×768", "768×512"],
    negativeRequired: true,
    tips: "SD 1.5 纯关键词格式，逗号分隔。50-75 token 最佳，支持 (keyword:weight) 权重。需要 Hires fix 提升分辨率。",
  },
  {
    id: "flux",
    name: "FLUX / SD3",
    promptStyle: "natural",
    weightSyntax: "none",
    defaultParams: {
      sampler: "Euler",
      scheduler: "normal",
      steps: 20,
      cfgScale: 3.5,
      width: 1024,
      height: 1024,
    },
    stepRange: [10, 50],
    cfgRange: [1.0, 7.0],
    resolutions: ["1024×1024", "832×1216", "1216×832"],
    negativeRequired: false,
    tips: "FLUX/SD3 使用完整自然语言描述，越详细越好。不用权重语法，不用 negative prompt (FLUX Schnell 可 4 步出图)。",
  },
  {
    id: "illustrious",
    name: "Illustrious XL",
    promptStyle: "tags",
    weightSyntax: "parentheses",
    defaultParams: {
      sampler: "Euler a",
      scheduler: "normal",
      steps: 25,
      cfgScale: 5.0,
      width: 1024,
      height: 1024,
    },
    stepRange: [20, 28],
    cfgRange: [5.0, 7.5],
    resolutions: [
      "1024×1024",
      "832×1216",
      "1216×832",
      "960×1088",
      "640×1536",
      "1536×640",
    ],
    negativeRequired: true,
    tips:
      "Illustrious XL 是基于 SDXL 1.0 的动漫/插画专用模型，由 OnomaAI Research 基于 Danbooru2023 数据集训练。" +
      "使用 Danbooru 风格逗号分隔标签，推荐 Euler a 采样器，20-28 步，CFG 5-7.5。" +
      "支持质量标签：worst quality, bad quality, average quality, good quality, best quality, masterpiece。" +
      "标准负面提示词：worst quality, comic, multiple views, bad quality, low quality, lowres, displeasing, very displeasing, bad anatomy, bad hands, scan artifacts, monochrome, greyscale, signature, twitter username, jpeg artifacts, 2koma, 4koma, guro, extra digits, fewer digits。" +
      "支持 (keyword:weight) 权重语法。不要过度使用构图标签（close-up, upside-down, cowboy shot）。",
  },
  {
    id: "anima",
    name: "Anima",
    promptStyle: "tags",
    weightSyntax: "parentheses",
    defaultParams: {
      sampler: "er_sde",
      scheduler: "normal",
      steps: 35,
      cfgScale: 4.5,
      width: 1024,
      height: 1024,
    },
    stepRange: [30, 50],
    cfgRange: [4.0, 5.0],
    resolutions: ["1024×1024", "896×1152", "1152×896"],
    negativeRequired: true,
    tips:
      "Anima 是 CircleStone Labs 与 Comfy Org 合作开发的 2B 参数动漫/插画专用模型，基于 NVIDIA Cosmos 架构。" +
      "使用 Danbooru 风格标签和/或自然语言描述，可混用。" +
      "标签用小写、空格代替下划线（score 标签除外）。当 Danbooru 和 Gelbooru 标签不同时，优先使用 Gelbooru 版本。" +
      "推荐 er_sde 采样器，30-50 步，CFG 4-5。分辨率约 1MP。" +
      "推荐正向前缀：masterpiece, best quality, score_7, safe。" +
      "推荐负面：worst quality, low quality, score_1, score_2, score_3, artist name。" +
      "画师标签前缀 @（如 @big chungus）。" +
      "支持时间标签（year 2025, newest, recent, mid, early, old）。",
  },
];

export function getModelProfile(id: string): ModelProfile | undefined {
  return profiles.find((p) => p.id === id);
}

export function getDefaultProfile(): ModelProfile {
  return profiles[0]; // ZIT
}

export function getAllProfiles(): ModelProfile[] {
  return profiles;
}
