import { readFileSync } from "fs";
import { join } from "path";
import { getConfig } from "../config";
import { getModelProfile, getDefaultProfile } from "./model-profiles";
import { buildKnowledgeDirectory } from "../knowledge/directory";
import defaultModulesJson from "./prompts/modules.json";
import mod00 from "./prompts/00-persona.md?raw";
import mod01 from "./prompts/01-creative-methodology.md?raw";
import mod02 from "./prompts/02-civitai-guidance.md?raw";
import mod03 from "./prompts/03-light-methodology.md?raw";
import mod04 from "./prompts/04-composition-methodology.md?raw";
import mod05 from "./prompts/05-color-methodology.md?raw";
import mod06 from "./prompts/06-camera-methodology.md?raw";
import mod07 from "./prompts/07-texture-methodology.md?raw";
import mod08 from "./prompts/08-danbooru-guidance.md?raw";
import modAnima from "./prompts/anima.md?raw";
import modIllustrious from "./prompts/illustrious.md?raw";
import modInteractive from "./prompts/interactive-persona.md?raw";
import modZit from "./prompts/zit.md?raw";
import styleAnimaHybrid from "./prompts/styles/anima/hybrid.md?raw";
import styleAnimaNatural from "./prompts/styles/anima/natural.md?raw";
import styleAnimaTags from "./prompts/styles/anima/tags.md?raw";

const promptFiles: Record<string, string> = {
  "00-persona.md": mod00,
  "01-creative-methodology.md": mod01,
  "02-civitai-guidance.md": mod02,
  "03-light-methodology.md": mod03,
  "04-composition-methodology.md": mod04,
  "05-color-methodology.md": mod05,
  "06-camera-methodology.md": mod06,
  "07-texture-methodology.md": mod07,
  "08-danbooru-guidance.md": mod08,
  "anima.md": modAnima,
  "illustrious.md": modIllustrious,
  "interactive-persona.md": modInteractive,
  "zit.md": modZit,
  "styles/anima/hybrid.md": styleAnimaHybrid,
  "styles/anima/natural.md": styleAnimaNatural,
  "styles/anima/tags.md": styleAnimaTags,
};

function readPromptFile(relativePath: string): string {
  if (relativePath in promptFiles) return promptFiles[relativePath];
  throw new Error(`Prompt file not found: ${relativePath}`);
}

interface ModuleConfig {
  file: string;
  enabled: boolean;
  exclusive_group?: string;
}

interface PromptConfig {
  shared_modules: ModuleConfig[];
  model_modules: Record<string, ModuleConfig>;
}

function readDefaults(): PromptConfig {
  return defaultModulesJson;
}

async function loadPromptModules(targetModelId: string): Promise<string> {
  // File defaults are the source of truth for which modules exist.
  // DB config only overrides enabled/disabled for modules it knows about;
  // new modules added to the file automatically appear in all environments.
  const modulesJson = await getConfig("agent_modules");
  const defaults = readDefaults();
  const dbOverrides: ModuleConfig[] = modulesJson
    ? JSON.parse(modulesJson)
    : [];
  const overrideMap = new Map(
    dbOverrides.map((m: ModuleConfig) => [m.file, m]),
  );
  const sharedModules: ModuleConfig[] = defaults.shared_modules.map((m) =>
    overrideMap.has(m.file)
      ? { ...m, enabled: overrideMap.get(m.file)!.enabled }
      : m,
  );

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
    .map((m) => readPromptFile(m.file))
    .join("\n\n");

  const modelModule = defaults.model_modules[targetModelId];
  const modelPart =
    modelModule && modelModule.enabled
      ? "\n\n" + readPromptFile(modelModule.file)
      : "";

  return shared + modelPart;
}

const STYLE_GUIDANCE: Record<string, string> = {
  tags: `你的输出必须是纯标签格式：逗号分隔的关键词/短语。例如："1girl, long hair, blue eyes, standing in rain, neon lights, cinematic lighting, masterpiece, best quality"。需要强调时使用 (keyword:weight) 语法。总长度控制在 75 token 以内效果最佳。`,
  hybrid: `你的输出应该是关键词和自然语言的混合。开头用关键主体标签，然后用描述性自然语言表达氛围和细节。例如："1girl, elegant dress, standing in a moonlit garden, soft ethereal glow filtering through ancient trees, petals drifting in a gentle breeze, cinematic composition, masterpiece"。重要元素可以使用 (keyword:weight) 强调。`,
  natural: `你的输出必须是流畅的自然语言段落式描述。按此结构组织：先明确图片类型和主体（最重要，放最前面），然后描述主体的外观和动作细节，接着是环境背景，再描述光影氛围（光源类型、方向、色温），最后补充风格媒介和品质约束。每个视觉元素要具体：不说"好看的光"，说"柔和的侧光从窗户透入，在脸上形成温暖的明暗过渡"。不要使用权重语法或逗号分隔的标签。必须包含质感/材质词（如 skin texture, fabric detail, film grain）。不需要文字渲染时写 "absolutely no text"。`,
};

function loadStyleGuidance(modelId: string, promptStyle: string): string {
  try {
    return readPromptFile(`styles/${modelId}/${promptStyle}.md`);
  } catch {
    return STYLE_GUIDANCE[promptStyle] ?? STYLE_GUIDANCE.hybrid;
  }
}

function buildSuffix(
  profile: ReturnType<typeof getModelProfile>,
  promptStyle: string,
  outputLang: string,
): string {
  const langInstruction =
    outputLang === "en"
      ? `你的输出提示词必须使用英文。`
      : `你的输出提示词必须使用中文。`;

  const styleGuidance = loadStyleGuidance(profile!.id, promptStyle);

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
${styleGuidance}

## 输出语言
${langInstruction}`;
}

export function assemblePrompt(
  modules: string,
  directory: string,
  relatedConcepts: string,
  suffix: string,
): string {
  const conceptsSection = relatedConcepts.trim()
    ? `${relatedConcepts.trim()}\n\n`
    : "";
  return `${modules}\n\n${conceptsSection}${directory}\n\n${suffix}`;
}

export async function buildSystemPrompt(userMessage?: string): Promise<string> {
  const targetModelId = (await getConfig("target_image_model")) || "zit";
  const outputLang = (await getConfig("output_language")) || "zh";

  const profile = getModelProfile(targetModelId) || getDefaultProfile();
  // Model profile defines the canonical prompt style; config override is secondary.
  const promptStyle = (await getConfig("prompt_style")) || profile.promptStyle;

  const modules = await loadPromptModules(targetModelId);
  const directory = await buildKnowledgeDirectory();

  let relatedConcepts = "";
  if (userMessage) {
    relatedConcepts = await findRelatedConceptsForPrompt(userMessage);
  }

  return assemblePrompt(
    modules,
    directory,
    relatedConcepts,
    buildSuffix(profile, promptStyle, outputLang),
  );
}

async function findRelatedConceptsForPrompt(
  userMessage: string,
): Promise<string> {
  const { generateEmbedding } = await import("../knowledge/embedding");
  const { sqlite } = await import("../db");
  const { db } = await import("../db");
  const { artConcepts } = await import("../db/schema");
  const { eq, or, and } = await import("drizzle-orm");
  const { formatRelatedConcepts } = await import("../knowledge/directory");

  const embedding = await generateEmbedding(userMessage);
  const vec = new Float32Array(embedding);
  const blob = Buffer.from(vec.buffer);

  const rows = sqlite
    .prepare(
      `SELECT id, distance FROM vec_concepts WHERE embedding MATCH ? AND k = ? ORDER BY distance`,
    )
    .all(blob, 20) as { id: string; distance: number }[];

  if (rows.length === 0) return "";

  const scoreMap = new Map(rows.map((r) => [r.id, 1 - r.distance]));
  const names = rows.filter((r) => scoreMap.get(r.id)! > 0.5).map((r) => r.id);

  if (names.length === 0) return "";

  const concepts = await db
    .select({
      name: artConcepts.name,
      nameZh: artConcepts.nameZh,
      category: artConcepts.category,
      subCategory: artConcepts.subCategory,
      visualDescription: artConcepts.visualDescription,
    })
    .from(artConcepts)
    .where(and(or(...names.map((n) => eq(artConcepts.name, n)))));

  const details = concepts
    .map((c) => ({
      name: c.name,
      nameZh: c.nameZh,
      category: c.category,
      subCategory: c.subCategory,
      visualDescription: c.visualDescription,
      score: scoreMap.get(c.name) ?? 0,
    }))
    .sort((a, b) => b.score - a.score);

  return formatRelatedConcepts(details);
}
