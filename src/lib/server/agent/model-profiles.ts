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
    promptStyle: "hybrid",
    weightSyntax: "parentheses",
    defaultParams: {
      sampler: "Euler",
      scheduler: "normal",
      steps: 6,
      cfgScale: 1.5,
      width: 1024,
      height: 1024,
    },
    stepRange: [4, 12],
    cfgRange: [1.0, 4.0],
    resolutions: ["1024×1024", "832×1216", "1216×832", "960×1088"],
    negativeRequired: true,
    tips: "ZIT 是快速模型，建议 4-8 步，低 CFG (1.0-4.0)。关键词和自然语言混合使用效果最佳，支持 (keyword:weight) 权重语法。",
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
