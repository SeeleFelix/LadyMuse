import { readFileSync } from "fs";
import { join } from "path";
import { getConfig } from "../config";
import { getModelProfile, getDefaultProfile } from "./model-profiles";
import { buildKnowledgeDirectory } from "../knowledge/directory";

interface ModuleConfig {
  file: string;
  enabled: boolean;
  exclusive_group?: string;
}

interface PromptConfig {
  shared_modules: ModuleConfig[];
  model_modules: Record<string, ModuleConfig>;
}

const DEFAULT_PATH = join(import.meta.dirname, "prompts", "modules.json");

function readDefaults(): PromptConfig {
  return JSON.parse(readFileSync(DEFAULT_PATH, "utf-8"));
}

async function loadPromptModules(targetModelId: string): Promise<string> {
  const dir = join(import.meta.dirname, "prompts");

  // Read module config from database, fallback to file
  const modulesJson = await getConfig("agent_modules");
  const defaults = readDefaults();
  const sharedModules: ModuleConfig[] = modulesJson
    ? JSON.parse(modulesJson)
    : defaults.shared_modules;

  // Filter enabled modules, respecting exclusive_group (only first enabled per group)
  const seenGroups = new Set<string>();
  const shared = sharedModules
    .filter((m) => {
      if (!m.enabled) return false;
      if (m.exclusive_group) {
        if (seenGroups.has(m.exclusive_group)) return false;
        seenGroups.add(m.exclusive_group);
      }
      return true;
    })
    .map((m) => readFileSync(join(dir, m.file), "utf-8"))
    .join("\n\n");

  const modelModule = defaults.model_modules[targetModelId];
  const modelPart =
    modelModule && modelModule.enabled
      ? "\n\n" + readFileSync(join(dir, modelModule.file), "utf-8")
      : "";

  return shared + modelPart;
}

const STYLE_GUIDANCE: Record<string, string> = {
  tags: `你的输出必须是纯标签格式：逗号分隔的关键词/短语。例如："1girl, long hair, blue eyes, standing in rain, neon lights, cinematic lighting, masterpiece, best quality"。需要强调时使用 (keyword:weight) 语法。总长度控制在 75 token 以内效果最佳。`,
  hybrid: `你的输出应该是关键词和自然语言的混合。开头用关键主体标签，然后用描述性自然语言表达氛围和细节。例如："1girl, elegant dress, standing in a moonlit garden, soft ethereal glow filtering through ancient trees, petals drifting in a gentle breeze, cinematic composition, masterpiece"。重要元素可以使用 (keyword:weight) 强调。`,
  natural: `你的输出必须是流畅的自然语言段落式描述。按此结构组织：先明确图片类型和主体（最重要，放最前面），然后描述主体的外观和动作细节，接着是环境背景，再描述光影氛围（光源类型、方向、色温），最后补充风格媒介和品质约束。每个视觉元素要具体：不说"好看的光"，说"柔和的侧光从窗户透入，在脸上形成温暖的明暗过渡"。不要使用权重语法或逗号分隔的标签。必须包含质感/材质词（如 skin texture, fabric detail, film grain）。不需要文字渲染时写 "absolutely no text"。`,
};

function buildSuffix(
  profile: ReturnType<typeof getModelProfile>,
  promptStyle: string,
  outputLang: string,
): string {
  const langInstruction =
    outputLang === "en"
      ? `你的输出提示词必须使用英文。`
      : `你的输出提示词必须使用中文。`;

  return `## 目标图像模型
当前目标模型：**${profile!.name}**（${profile!.id.toUpperCase()}）

${profile!.tips}
推荐默认参数：
- Sampler: ${profile!.defaultParams.sampler}
- Scheduler: ${profile!.defaultParams.scheduler}
- Steps: ${profile!.defaultParams.steps}（范围 ${profile!.stepRange[0]}-${profile!.stepRange[1]}）
- CFG Scale: ${profile!.defaultParams.cfgScale}（范围 ${profile!.cfgRange[0]}-${profile!.cfgRange[1]}）
- 分辨率: ${profile!.resolutions.join(", ")}
- 反向提示词: ${profile!.negativeRequired ? "需要" : "不需要"}
- 权重语法: ${profile!.weightSyntax === "parentheses" ? "支持 (keyword:weight)" : "不支持"}

## 提示词风格
${STYLE_GUIDANCE[promptStyle] || STYLE_GUIDANCE.hybrid}

## 输出语言
${langInstruction}`;
}

export async function buildSystemPrompt(): Promise<string> {
  const targetModelId = (await getConfig("target_image_model")) || "zit";
  const outputLang = (await getConfig("output_language")) || "zh";
  const promptStyle = (await getConfig("prompt_style")) || "hybrid";

  const profile = getModelProfile(targetModelId) || getDefaultProfile();

  const modules = await loadPromptModules(targetModelId);
  const directory = await buildKnowledgeDirectory();

  return `${modules}\n\n${directory}\n\n${buildSuffix(profile, promptStyle, outputLang)}`;
}
