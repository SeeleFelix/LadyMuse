# Anima Model Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Anima text-to-image model into all integration points: corrected model profile, prompt module, registry, and UI selector.

**Architecture:** Follows the existing model integration pattern (`zit`, `illustrious`). `model-profiles.ts` provides parameter defaults and tips; `anima.md` provides prompt assembly rules loaded dynamically by `system-prompt.ts`; `modules.json` registers the module; `chat/+page.svelte` exposes it in the model selector dropdown.

**Tech Stack:** TypeScript, Svelte 5, Markdown prompt modules

---

### Task 1: Fix `model-profiles.ts` Anima entry

**Files:**
- Modify: `src/lib/server/agent/model-profiles.ts:145-171`

- [ ] **Step 1: Apply corrections to the Anima profile entry**

Replace the existing Anima entry (lines 145-171) with the corrected version:

```typescript
  {
    id: "anima",
    name: "Anima",
    promptStyle: "hybrid",
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
    cfgRange: [4, 6],
    resolutions: [
      "1024×1024",
      "832×1216",
      "1216×832",
      "896×1152",
      "1152×896",
      "1216×896",
    ],
    negativeRequired: true,
    tips:
      "Anima 是 CircleStone Labs 与 Comfy Org 合作的 2B 参数动漫/插画模型，基于 NVIDIA Cosmos 架构，使用 Qwen3 0.6B 文本编码器（非 CLIP）。" +
      "支持 Danbooru 标签与自然语言任意混用。标签用小写、空格代替下划线（score 标签除外）。Danbooru 与 Gelbooru 标签不同时优先 Gelbooru 版本。" +
      "支持 (keyword:weight) 权重语法，但需比 SDXL 更高的权重值（如 (chibi:2)）。画师标签必须加 @ 前缀（如 @big chungus），否则效果很弱。训练时有 random tag dropout，不需要穷举所有标签。" +
      "自然语言至少 2 句，太短会产生意外结果。多角色时每个角色必须命名+描述外观。Base 版本无美学调优，不加质量/画师标签时风格非常朴素。" +
      "采样器选择：er_sde（默认，锐利线条平色）、euler_a（柔和细线偏 2.5D，CFG 可略高）、dpmpp_2m_sde_gpu（更多样创意，偶尔狂野）。30-50 步，CFG 4-6。" +
      "推荐正向前缀：masterpiece, best quality, score_7, safe。推荐负面：worst quality, low quality, score_1, score_2, score_3, artist name。",
  },
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: no errors in `model-profiles.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/agent/model-profiles.ts
git commit -m "fix: correct Anima model profile — hybrid prompt style, cfg 4-6, expanded resolutions and tips"
```

---

### Task 2: Create `anima.md` prompt module

**Files:**
- Create: `src/lib/server/agent/prompts/anima.md`

- [ ] **Step 1: Create the file with the full prompt assembly module**

Write file `src/lib/server/agent/prompts/anima.md`:

```markdown
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
```

- [ ] **Step 2: Verify the file exists and is readable by the module loader**

Run: `cat src/lib/server/agent/prompts/anima.md | head -5`
Expected: first 5 lines of the module

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/agent/prompts/anima.md
git commit -m "feat: add Anima prompt assembly module"
```

---

### Task 3: Register Anima in `modules.json`

**Files:**
- Modify: `src/lib/server/agent/prompts/modules.json`

- [ ] **Step 1: Add the anima entry to model_modules**

Add after the `"illustrious"` entry in `model_modules`:

```json
    "anima": {
      "file": "anima.md",
      "enabled": true
    }
```

The resulting `model_modules` block:

```json
  "model_modules": {
    "zit": {
      "file": "zit.md",
      "enabled": true
    },
    "illustrious": {
      "file": "illustrious.md",
      "enabled": true
    },
    "anima": {
      "file": "anima.md",
      "enabled": true
    }
  },
```

- [ ] **Step 2: Verify JSON is valid**

Run: `python3 -m json.tool src/lib/server/agent/prompts/modules.json > /dev/null && echo "valid"`
Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/agent/prompts/modules.json
git commit -m "feat: register Anima prompt module in modules.json"
```

---

### Task 4: Add Anima to UI model selector

**Files:**
- Modify: `src/routes/chat/+page.svelte:89-96`

- [ ] **Step 1: Add Anima entry to imageModelProfiles array**

Add after the `illustrious` entry:

```typescript
  const imageModelProfiles = [
    { id: "zit", name: "Z Image Turbo", defaultStyle: "natural" as const },
    {
      id: "illustrious",
      name: "Illustrious XL",
      defaultStyle: "tags" as const,
    },
    {
      id: "anima",
      name: "Anima",
      defaultStyle: "hybrid" as const,
    },
  ];
```

- [ ] **Step 2: Verify Svelte compilation**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -i "error\|Error" | head -10`
Expected: no errors related to `+page.svelte`

- [ ] **Step 3: Commit**

```bash
git add src/routes/chat/+page.svelte
git commit -m "feat: add Anima to UI model selector"
```

---

### Task 5: Final verification

**Files:**
- No file changes — verification only

- [ ] **Step 1: Full TypeScript compile check**

Run: `npx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: no errors

- [ ] **Step 2: Lint check on changed files**

Run: `npx eslint src/lib/server/agent/model-profiles.ts src/routes/chat/+page.svelte --max-warnings=0 2>&1 | tail -5`
Expected: no errors or warnings (note: may not be configured for these files; skip if eslint not set up)

- [ ] **Step 3: Verify all 5 integration points manually**

Run:
```bash
echo "=== model-profiles.ts ===" && grep -A2 '"anima"' src/lib/server/agent/model-profiles.ts | head -3 && \
echo "=== anima.md exists ===" && test -f src/lib/server/agent/prompts/anima.md && echo "yes" || echo "MISSING" && \
echo "=== modules.json ===" && grep -A2 '"anima"' src/lib/server/agent/prompts/modules.json && \
echo "=== chat page ===" && grep -A2 '"anima"' src/routes/chat/+page.svelte && \
echo "=== tools.ts ===" && grep -o 'Anima' src/lib/server/agent/tools.ts
```
Expected: Anima found in all 5 locations
```
```