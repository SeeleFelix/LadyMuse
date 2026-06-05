# Anima Prompt Best Practices Alignment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Anima prompt guidance to match official model card best practices and refactor style guidance to file-based per-model overrides.

**Architecture:** Replace hardcoded `ANIMA_HYBRID_GUIDANCE` constant with file-based style guidance under `prompts/styles/<modelId>/<style>.md`. `system-prompt.ts` loads per-model files via `readFileSync`, falling back to generic `STYLE_GUIDANCE` when no model-specific file exists.

**Tech Stack:** TypeScript, SvelteKit, Vitest

---

### Task 1: Fix model-profiles.ts CFG range and tips

**Files:**
- Modify: `src/lib/server/agent/model-profiles.ts:158,173`

- [ ] **Step 1: Fix CFG range**

In `src/lib/server/agent/model-profiles.ts`, change line 158:

```typescript
// Before:
cfgRange: [4, 6],

// After:
cfgRange: [4, 5],
```

- [ ] **Step 2: Update tips string**

Replace the tips string for the anima profile (lines 169-174) with corrected guidance:

```typescript
tips:
  "Anima 是 CircleStone Labs 与 Comfy Org 合作的 2B 参数动漫/插画模型，基于 NVIDIA Cosmos 架构，使用 Qwen3 0.6B 文本编码器（非 CLIP）。" +
  "支持 Danbooru 标签与自然语言任意混用。标签用小写、空格代替下划线（score 标签除外）。Danbooru 与 Gelbooru 标签不同时优先 Gelbooru 版本。" +
  "官方标签顺序：[quality/meta/year/safety] [1girl/1boy/1other] [character] [series] [artist] [general tags]。" +
  "画师标签必须加 @ 前缀（如 @big chungus），不加 @ 效果很弱。混合画师用交替语法 @[artist1|artist2]，并排无效。" +
  "支持 (keyword:weight) 权重语法，权重值范围 2-5（如 (chibi:2)）。训练时有 random tag dropout，不需要穷举所有标签。" +
  "自然语言至少 2 句，太短会产生意外结果。多角色时每个角色必须命名+描述外观。Base 版本无美学调优，不加质量/画师标签时风格非常朴素。" +
  "score_9/8/7 会推向欧美画风；日式平涂需去掉或加 anime screenshot / anime coloring。" +
  "BREAK 是 SD/SDXL 专用关键词，在 Anima 里会被当字面意思解释，禁止使用。" +
  "逗号后必须有空格，缺失会显著影响生成结果。" +
  "采样器选择：er_sde（默认，锐利线条平色）、euler_a（柔和细线偏 2.5D，CFG 可略高）、dpmpp_2m_sde_gpu（更多样创意，偶尔狂野）。" +
  "追求写实/油画质感可用 beta57 scheduler（RES4LYF custom node pack）。" +
  "30-50 步，CFG 4-5。" +
  "推荐正向前缀：masterpiece, best quality, score_7, safe。推荐负面：worst quality, low quality, score_1, score_2, score_3, artist name。",
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/agent/model-profiles.ts
git commit -m "fix: correct Anima CFG range 4-6 → 4-5 and update tips"
```

---

### Task 2: Rewrite anima.md with complete best practices

**Files:**
- Modify: `src/lib/server/agent/prompts/anima.md`

- [ ] **Step 1: Replace anima.md content**

Replace the entire content of `src/lib/server/agent/prompts/anima.md` with:

```markdown
## Anima 提示词组装规则

你正在为 Anima 生成提示词。这是 CircleStone Labs 基于 NVIDIA Cosmos 架构的 2B 参数动漫/插画模型，使用 Qwen3 0.6B 文本编码器，与传统 CLIP 编码器模型有本质区别。

### 第一步：确定锚点

Anima 使用 hybrid 模式：**标签与自然语言可以任意顺序混合**。推荐写法是将元数据标签放在最前面，后面紧跟自然语言主体描述，但这不是唯一有效格式。

好的锚点：masterpiece, best quality, score_7, safe, @artist_name. An anime girl with medium-length blonde hair sits alone at a diner counter, shoulders hunched, hands wrapped around a cold cup.
坏的锚点：只写标签堆砌没有 NL 描述，或只有 NL 没有元数据标签前缀

多角色时，每个角色必须命名 + 描述外观，不能只列名字。

### 第二步：描述策略

**官方标签顺序**（按此排列效果最佳）：
[quality/meta/year/safety tags] [1girl/1boy/1other etc] [character] [series] [artist] [general tags]

每个标签区块内部顺序任意。

标签部分和 NL 部分的分工：

**用标签写（元数据）**：
- quality 标签：masterpiece, best quality, good quality 等人类评分体系，和/或 score_9 到 score_1 的 PonyV7 美学体系。两套可混用、单用或不用。
- 安全标签：safe, sensitive, nsfw, explicit（必须包含一个）
- 时间标签：year 2025, newest, recent, mid, early, old（按需）
- 画师标签：必须加 @ 前缀（@big chungus），不加 @ 效果很弱
  - 混合画师：用交替语法 @[artist1|artist2]，并排写 @artist1, @artist2 无效
- meta 标签：highres, absurdres, anime screenshot 等（按需）

**用自然语言写（画面内容）**：
- 主体：角色外观、动作、表情、姿势
- 环境：场景、空间关系
- 光影：光源类型、方向、色温（Qwen3 编码器对光影描述响应强）
- 色彩：色调策略、氛围

**关键规则**：
- 标签用**小写**、**空格代替下划线**（唯一例外：score 标签保留下划线，如 score_7）
- **逗号后必须有空格**（如 `masterpiece, best quality` 而非 `masterpiece,best quality`），缺失会显著影响生成结果
- (keyword:weight) 权重可用，权重值范围 2-5，效果弱时推到 4-5（如 `(chibi:2)`、`(blue eyes:4)`）
- Danbooru 和 Gelbooru 标签不同时，**优先用 Gelbooru 版本**
- 训练时有 random tag dropout，**不需要穷举所有相关标签**——选关键的就好
- 自然语言部分**至少 2 句**，太短会产生意外结果
- 角色名和系列名在 NL 中遵循标准英文大写（如 Fern from Sousou no Frieren）
- **禁止使用 BREAK**——这是 SD/SDXL 的 75-token 分隔符，Anima 会按字面意思"破坏"解释

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

**注意事项**：
- score_9, score_8, score_7 会推向欧美画风。日式平涂风格需去掉这些高分标签，或加 `anime screenshot` / `anime coloring` 来保持动漫风格

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
| 柔和、细线、偏 2.5D | euler_a | CFG 可略高于 5 |
| 多样、创意、接受偶尔狂野 | dpmpp_2m_sde_gpu | 更有变化 |
| 写实/油画质感 | er_sde + beta57 scheduler | RES4LYF custom node pack |

- Steps: 30-50，CFG: 4-5
- Scheduler: 默认即可（追求写实质感时用 beta57）
- 推荐分辨率：1024×1024, 832×1216, 1216×832, 896×1152, 1152×896

**推荐正向前缀**：
masterpiece, best quality, score_7, safe,

**推荐负面提示词**：
worst quality, low quality, score_1, score_2, score_3, artist name

**非动漫艺术风格**（可选）：
Anima 额外训练了 ye-pop（抽象/当代艺术）和 deviantart（数字绘画）数据集。使用方法是在 prompt 最开头写 dataset tag 后换行，再写描述：
```
ye-pop
Abstract, oil painting of three faceless figures. Bold, textured colors, minimalist style.

deviantart
Digital painting of a fiery dragon with glowing yellow eyes. The background is a gradient of dark purple to orange.
```

### 好的示例

prompt：
masterpiece, best quality, score_7, safe, @big chungus. An anime girl with medium-length blonde hair sits alone at the far end of a long empty diner counter, shoulders hunched inward, hands wrapped around a cold coffee cup. Cold white fluorescent light from above bathes everything in flat, shadowless pale blue, the empty counter stretching away into the background. Skin texture visible, laminate countertop reflecting faint blue.

注意：
- 元数据标签前缀（quality + safety + artist）用逗号分隔，逗号后有空格
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

**示例 4：使用了 BREAK**
masterpiece, best quality, safe BREAK An anime girl standing in a garden BREAK cherry blossoms

问题：BREAK 是 SD/SDXL 专用关键词，在 Anima 里会被当作字面意思"破坏"解释，会严重干扰画面。
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/agent/prompts/anima.md
git commit -m "fix: rewrite anima.md with official model card best practices"
```

---

### Task 3: Create style guidance files for Anima

**Files:**
- Create: `src/lib/server/agent/prompts/styles/anima/hybrid.md`
- Create: `src/lib/server/agent/prompts/styles/anima/tags.md`
- Create: `src/lib/server/agent/prompts/styles/anima/natural.md`

- [ ] **Step 1: Create styles directory**

```bash
mkdir -p src/lib/server/agent/prompts/styles/anima
```

- [ ] **Step 2: Create hybrid.md**

Write to `src/lib/server/agent/prompts/styles/anima/hybrid.md`:

```markdown
你的输出采用 Anima hybrid 格式：**标签与自然语言可以任意顺序混合**。

推荐写法（与官方示例一致）是将元数据标签放在最前面，后面紧跟 NL 画面描述：

**元数据标签前缀**（放在 prompt 最开头，逗号分隔，逗号后必须有空格）：
- 质量标签：masterpiece, best quality, score_7 等
- 安全标签：safe / sensitive / nsfw / explicit（必须包含一个）
- 画师标签：必须加 @ 前缀（如 @big chungus）
  - 混合画师用交替语法：@[artist1|artist2]
- 时间标签（按需）：year 2025, newest, recent 等

**画面内容用自然语言写**（紧接标签前缀后）：
- 主体角色的外观、动作、表情、姿态
- 环境和场景
- 光影（光源类型、方向、色温）
- 色彩氛围
- 至少写 2 句完整的 NL 句子

示例：masterpiece, best quality, score_7, safe, @artist_name. An anime girl with medium-length blonde hair sits alone at the far end of a long empty diner counter, shoulders hunched inward. Cold white fluorescent light from above bathes everything in flat, shadowless pale blue.

关键规则：
- 标签用小写、空格代替下划线（score 标签除外，保留 score_7 格式）
- 逗号后必须有空格
- (keyword:weight) 可用，权重值范围 2-5
- 画师必须加 @ 前缀，不加 @ 效果很弱
- 不需要穷举所有标签（模型训练有 random tag dropout）
- 角色名和系列名在 NL 中遵循标准英文大写
- 禁止使用 BREAK（Anima 会按字面意思解释）
- 不要输出纯标签 prompt —— Anima 的 Qwen3 编码器需要 NL 才能发挥优势
```

- [ ] **Step 3: Create tags.md**

Write to `src/lib/server/agent/prompts/styles/anima/tags.md`:

```markdown
你的输出采用 Anima 纯标签格式：逗号分隔的 Danbooru/Gelbooru 风格关键词。注意 Anima 使用 Qwen3 编码器，不是 CLIP，没有 75 token 限制。

**标签顺序**（按此排列效果最佳）：
[quality/meta/year/safety tags] [1girl/1boy/1other etc] [character] [series] [artist] [general tags]

**关键规则**：
- 标签用小写、空格代替下划线（score 标签除外，保留 score_7 格式）
- 逗号后必须有空格
- 画师标签必须加 @ 前缀（如 @big chungus），混合画师用交替语法 @[artist1|artist2]
- (keyword:weight) 权重可用，权重值范围 2-5（比 SDXL 高得多）
- 不需要穷举所有标签（模型训练有 random tag dropout）
- Danbooru 与 Gelbooru 标签不同时优先 Gelbooru 版本
- 禁止使用 BREAK（Anima 会按字面意思解释）

**必须包含**：
- 至少一个 quality 标签（masterpiece, best quality 等）
- 一个安全标签（safe / sensitive / nsfw / explicit）

示例：year 2025, newest, normal quality, score_5, highres, safe, 1girl, oomuro sakurako, yuru yuri, @nnn yryr, smile, brown hair, hat, solo, fur-trimmed gloves, open mouth, long hair
```

- [ ] **Step 4: Create natural.md**

Write to `src/lib/server/agent/prompts/styles/anima/natural.md`:

```markdown
你的输出采用 Anima 纯自然语言格式：流畅的段落式英文描述。Anima 使用 Qwen3 编码器，对复杂自然语言有很强的理解能力。

**结构建议**：
- 先明确主体（角色/场景）
- 然后描述外观和动作细节
- 接着环境背景
- 再描述光影氛围（光源类型、方向、色温）
- 最后补充风格媒介和品质约束

**可以在 NL prompt 开头放质量/画师标签**（官方明确支持）：
masterpiece, best quality, @artist_name. Natural language description continues here...

**关键规则**：
- 至少 2 句完整句子（极短 prompt 会产生意外结果）
- 角色名和系列名遵循标准英文大写（如 Fern from Sousou no Frieren）
- (keyword:weight) 权重可用，权重值范围 2-5
- 可以包含质感/材质词增强效果
- 禁止使用 BREAK（Anima 会按字面意思解释）

**多角色**：每个角色必须命名并描述外观，不能只列名字。
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/agent/prompts/styles/
git commit -m "feat: add per-model style guidance files for Anima"
```

---

### Task 4: Refactor system-prompt.ts to load file-based style guidance

**Files:**
- Modify: `src/lib/server/agent/system-prompt.ts:73-111`
- Test: `src/lib/server/agent/__tests__/system-prompt.test.ts`

- [ ] **Step 1: Write failing test**

Add tests to `src/lib/server/agent/__tests__/system-prompt.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { assemblePrompt } from "../system-prompt";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

describe("assemblePrompt", () => {
  it("injects related concepts between modules and directory when provided", () => {
    const modules = "## 角色\n你是一个创意助手";
    const directory = "## 知识库目录\n### 光影 (lighting)\n  natural: 5 concepts";
    const relatedConcepts = "### 当前意图相关概念\n- **rembrandt_lighting** (伦勃朗光) [lighting > studio] — A lighting technique";
    const suffix = "## 目标图像模型\nzit";

    const result = assemblePrompt(modules, directory, relatedConcepts, suffix);

    expect(result).toContain("## 角色");
    expect(result).toContain("### 当前意图相关概念");
    expect(result).toContain("## 知识库目录");
    expect(result).toContain("## 目标图像模型");

    // Related concepts should appear before directory
    const conceptsIndex = result.indexOf("### 当前意图相关概念");
    const dirIndex = result.indexOf("## 知识库目录");
    expect(conceptsIndex).toBeLessThan(dirIndex);

    // Modules should appear first
    const modulesIndex = result.indexOf("## 角色");
    expect(modulesIndex).toBeLessThan(conceptsIndex);
  });

  it("omits related concepts section when empty string", () => {
    const result = assemblePrompt("modules", "directory", "", "suffix");

    expect(result).not.toContain("当前意图相关概念");
    expect(result).toBe("modules\n\ndirectory\n\nsuffix");
  });

  it("omits related concepts section when only whitespace", () => {
    const result = assemblePrompt("modules", "directory", "   \n  ", "suffix");

    expect(result).not.toContain("当前意图相关概念");
  });
});

describe("loadStyleGuidance", () => {
  const stylesDir = join(import.meta.dirname, "prompts", "styles");

  it("returns model-specific file content when it exists", () => {
    // Anima style files should exist after Task 3
    const animaHybrid = readFileSync(join(stylesDir, "anima", "hybrid.md"), "utf-8");
    expect(animaHybrid).toContain("Anima hybrid");
  });

  it("loads anima hybrid guidance from file, not hardcoded constant", () => {
    const hybridFile = readFileSync(join(stylesDir, "anima", "hybrid.md"), "utf-8");
    // File-based guidance should mention arbitrary mixing, not rigid prefix format
    expect(hybridFile).toContain("任意顺序混合");
    // Should not use the old rigid phrasing
    expect(hybridFile).not.toContain("必须采用 Anima 模型的 hybrid 格式：元数据用逗号分隔的标签前缀");
  });

  it("loads anima tags guidance without 75-token limit", () => {
    const tagsFile = readFileSync(join(stylesDir, "anima", "tags.md"), "utf-8");
    expect(tagsFile).toContain("没有 75 token 限制");
  });

  it("loads anima natural guidance that supports weight syntax", () => {
    const naturalFile = readFileSync(join(stylesDir, "anima", "natural.md"), "utf-8");
    expect(naturalFile).toContain("(keyword:weight)");
    expect(naturalFile).not.toContain("不要使用权重语法");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail on new assertions**

Run: `npx vitest run src/lib/server/agent/__tests__/system-prompt.test.ts`
Expected: New `loadStyleGuidance` tests pass (files exist from Task 3), but confirm the content assertions work.

- [ ] **Step 3: Refactor system-prompt.ts**

In `src/lib/server/agent/system-prompt.ts`:

1. **Delete** the `ANIMA_HYBRID_GUIDANCE` constant (lines 73-95).

2. **Replace** `buildSuffix` function (lines 97-131) with:

```typescript
function loadStyleGuidance(modelId: string, promptStyle: string): string {
  const styleFile = join(
    import.meta.dirname,
    "prompts",
    "styles",
    modelId,
    `${promptStyle}.md`,
  );
  try {
    return readFileSync(styleFile, "utf-8");
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
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/agent/system-prompt.ts src/lib/server/agent/__tests__/system-prompt.test.ts
git commit -m "refactor: replace hardcoded ANIMA_HYBRID_GUIDANCE with file-based per-model style loading"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run TypeScript type check**

Run: `npx svelte-kit sync && npx svelte-check --tsconfig ./tsconfig.json`
Expected: No type errors.

- [ ] **Step 3: Verify file structure**

Run: `find src/lib/server/agent/prompts/styles -type f`
Expected:
```
src/lib/server/agent/prompts/styles/anima/hybrid.md
src/lib/server/agent/prompts/styles/anima/tags.md
src/lib/server/agent/prompts/styles/anima/natural.md
```

- [ ] **Step 4: Verify no references to deleted constant remain**

Run: `grep -r "ANIMA_HYBRID_GUIDANCE" src/`
Expected: No results (constant fully removed).
