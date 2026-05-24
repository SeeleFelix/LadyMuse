# Anima Style Guidance Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Anima prompt quality by giving it dedicated hybrid guidance that replaces the generic SDXL-oriented hybrid rules, eliminating the contradiction between `anima.md` (metadata-tags + NL-content) and the suffix (subject-tags + NL-atmosphere).

**Architecture:** `STYLE_GUIDANCE` dictionary stays unchanged. A new `ANIMA_HYBRID_GUIDANCE` constant holds the Anima-specific hybrid rules. `buildSuffix` checks: if `promptStyle === "hybrid"` AND model is Anima, use `ANIMA_HYBRID_GUIDANCE`; otherwise use `STYLE_GUIDANCE[promptStyle]` as before.

**Tech Stack:** TypeScript

---

### Task 1: Add Anima hybrid guidance constant and wire the selection logic in buildSuffix

**Files:**
- Modify: `src/lib/server/agent/system-prompt.ts`

- [ ] **Step 1: Add ANIMA_HYBRID_GUIDANCE constant**

Insert before `buildSuffix` function (before line 73), after the `STYLE_GUIDANCE` block (after line 71):

```typescript
const ANIMA_HYBRID_GUIDANCE = `你的输出必须采用 Anima 模型的 hybrid 格式：元数据用逗号分隔的标签前缀 + 画面内容用自然语言描述。

**元数据标签前缀**（放在 prompt 最开头，逗号分隔）：
- 质量标签：masterpiece, best quality, score_7 等
- 安全标签：safe / sensitive / nsfw / explicit（必须包含一个）
- 画师标签：必须加 @ 前缀（如 @big chungus）
- 时间标签（按需）：year 2025, newest, recent 等

**画面内容用自然语言写**（紧接标签前缀后）：
- 主体角色的外观、动作、表情、姿态 —— 用 NL 写，不要用逗号标签
- 环境和场景
- 光影（光源类型、方向、色温）
- 色彩氛围
- 至少写 2 句完整的 NL 句子

示例：masterpiece, best quality, score_7, safe, @artist_name. An anime girl with medium-length blonde hair sits alone at the far end of a long empty diner counter, shoulders hunched inward. Cold white fluorescent light from above bathes everything in flat, shadowless pale blue.

关键规则：
- 标签用小写、空格代替下划线（score 标签除外，保留 score_7 格式）
- (keyword:weight) 可用，但需要比 SDXL 更高的权重值
- 画师必须加 @ 前缀，不加 @ 效果很弱
- 不需要穷举所有标签（模型训练有 random tag dropout）
- 不要输出纯标签 prompt —— Anima 的 Qwen3 编码器需要 NL 才能发挥优势`;
```

- [ ] **Step 2: Modify buildSuffix to select Anima hybrid when model is anima**

Replace `buildSuffix` function. The only diff: extract `modelId`, check `modelId === "anima" && promptStyle === "hybrid"` to select guidance.

**Current code (lines 73-101):**
```typescript
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
```

**New code:**
```typescript
function buildSuffix(
  profile: ReturnType<typeof getModelProfile>,
  promptStyle: string,
  outputLang: string,
): string {
  const langInstruction =
    outputLang === "en"
      ? `你的输出提示词必须使用英文。`
      : `你的输出提示词必须使用中文。`;

  const isAnima = profile?.id === "anima";
  const styleGuidance =
    isAnima && promptStyle === "hybrid"
      ? ANIMA_HYBRID_GUIDANCE
      : STYLE_GUIDANCE[promptStyle] || STYLE_GUIDANCE.hybrid;

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

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -5`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/server/agent/system-prompt.ts
git commit -m "fix: use Anima-specific hybrid guidance when model is Anima"
```
