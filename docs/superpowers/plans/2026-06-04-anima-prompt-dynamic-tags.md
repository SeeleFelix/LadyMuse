# Anima Prompt Dynamic Tag System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded Anima quality/negative/safety tag templates with scenario-indexed reference tables that the AI dynamically selects from.

**Architecture:** All model-specific operational data (quality tags, negative prompts, safety tags, sampler settings, pitfalls) is consolidated into `anima.md` as structured reference tables. Style guidance files are trimmed to format-specific instructions only, with no duplicated core rules. `model-profiles.ts` tips are updated to remove hardcoded tag recommendations.

**Tech Stack:** Markdown prompt files, TypeScript config. Content-only changes — no code logic modifications.

---

### Task 1: Rewrite `anima.md`

**Files:**
- Modify: `src/lib/server/agent/prompts/anima.md` (full rewrite)

- [ ] **Step 1: Write the new `anima.md`**

Replace the entire file content with:

```markdown
你的输出采用 Anima hybrid 格式。Anima 是 CircleStone Labs 基于 NVIDIA Cosmos 架构的 2B 参数动漫/插画模型，使用 Qwen3 0.6B 文本编码器（非 CLIP）。

## 核心格式规则

- 标签用**小写**、**空格代替下划线**（唯一例外：score 标签保留下划线，如 score_7）
- **逗号后必须有空格**（如 `masterpiece, best quality` 而非 `masterpiece,best quality`），缺失会显著影响生成结果
- (keyword:weight) 权重可用，权重值范围 2-5（如 `(chibi:2)`、`(blue eyes:4)`）
- Danbooru 和 Gelbooru 标签不同时，**优先用 Gelbooru 版本**
- 训练时有 random tag dropout，**不需要穷举所有相关标签**——选关键的就好
- **禁止使用 BREAK**——Anima 会按字面意思"破坏"解释

## 标签顺序

按此排列效果最佳，每个区块内部顺序任意：

[quality/meta/year/safety tags] [1girl/1boy/1other etc] [character] [series] [artist] [general tags]

## 画师规则

- 画师标签必须加 **@ 前缀**（如 @big chungus），不加 @ 效果很弱
- 混合画师用交替语法 **@[artist1|artist2]**，并排写 @artist1, @artist2 无效

## 质量标签

根据目标画面风格选择，不要无脑堆砌：

| 场景 | 标签 | 说明 |
|---|---|---|
| 通用 | `masterpiece, best quality` | 大多数情况够用；模型有 tag dropout |
| 日式平涂 | `masterpiece, best quality, anime screenshot, anime coloring` | 不加 score 标签——它们推向欧美画感 |
| 高质量（接受欧美偏移） | `masterpiece, best quality, score_7, score_8_up` | score_9/8/7 推向 Pony-era 美学 |
| 纯 score 体系 | `score_9, score_8_up, score_7_up` | 仅用 PonyV7 美学评分 |
| 低质/复古感 | `normal quality, score_5` | 刻意降质 |
| 高细节密度 | `masterpiece, best quality, highres, absurdres` | 叠加分辨率元标签 |
| 官方插图质感 | `masterpiece, best quality, official art` | 官方美术风格 |
| 线稿/草图 | `monochrome, sketch, lineart` | 负面词需相应调整 |

**必须包含至少一个质量标签。** Base 模型不加质量标签时风格非常朴素中性。

## 安全标签

**必须包含一个**，根据内容选择：

| 标签 | 使用场景 |
|---|---|
| `safe` | 一般内容（默认） |
| `sensitive` | 暗示性但不露骨（泳装、内衣等） |
| `nsfw` | 明确裸露 |
| `explicit` | 极端内容 |

## 负面提示词

不要用固定模板。根据画面内容**分层叠加**：

**Layer 1 — 始终包含：**
`worst quality, low quality, score_1, score_2, score_3, artist name`

**Layer 2 — 有人物时叠加：**
`bad hands, bad anatomy, missing fingers, extra digits, fewer digits, disfigured, mutation, 4 fingers, 6 fingers`

**Layer 3 — 特写/肖像时叠加：**
`bad face, ugly face, deformed face, cross-eyed`

**Layer 4 — 水印/文字排除（按需）：**
`watermark, signature, text, logo, jpeg artifacts, patreon logo, patreon username, twitter username, twitter logo`

**Layer 5 — 风格排除（按需）：**
`monochrome, sketch, multiple views, chibi, blurry, 3d`

**Layer 6 — 构图控制（按需）：**
`cropped, out of frame, multiple views, close-up`

**Layer 7 — 风景/无人物场景：**
不用 Layer 2，改用：`person, human` + 叠加 Layer 4

## 采样器与参数

| 目标 | 采样器 | CFG | Steps | Scheduler | 备注 |
|---|---|---|---|---|---|
| 锐利线条、平色 | `er_sde` | 4-5 | 25-35 | normal | 默认，中性风格 |
| 柔和、细线、2.5D | `euler_a` | 4.5-5.5 | 25-30 | normal | CFG 可略高于 5 |
| 多样、创意 | `dpmpp_2m_sde_gpu` | 4-5 | 25-30 | normal | 偶尔狂野 |
| 写实/油画质感 | `er_sde` | 4-5 | 30-35 | beta57 | RES4LYF 自定义节点 |

推荐分辨率：1024×1024, 832×1216, 1216×832, 896×1152, 1152×896

## 特殊格式

**非动漫艺术风格：** Anima 额外训练了 ye-pop（抽象/当代艺术）和 deviantart（数字绘画）数据集。在 prompt 最开头写 dataset tag 后换行：

    ye-pop
    Abstract, oil painting of three faceless figures. Bold, textured colors, minimalist style.

    deviantart
    Digital painting of a fiery dragon with glowing yellow eyes. Background gradient from dark purple to orange.

**多角色：** 每个角色必须命名 + 描述外观，不能只列名字。

**自然语言部分：** 至少 2 句，越详细越好。极短 prompt 产生意外结果。角色名和系列名在 NL 中遵循标准英文大写（如 Fern from Sousou no Frieren）。

## 注意事项

- `score_9/8/7` 推向 Pony-era 欧美美学；日式平涂不用或加 `anime screenshot` / `anime coloring` 抵消
- BREAK 按字面意思解释为"破坏"，禁止使用
- 逗号后缺空格会显著影响结果
- NL 少于 2 句会产生意外结果
- Base 模型无美学调优——不加画师/质量标签时输出很朴素
- 画师标签不加 @ 前缀效果极弱
- 混合画师必须用 `@[artist1|artist2]`，并排写无效
- 构图矛盾（close-up 和 full body 同时出现）、光影矛盾、风格矛盾都要避免
- 标签冗余（同一概念用不同标签重复描述）也要避免

## 默认回退

无法判断场景时使用：
- 质量：`masterpiece, best quality`
- 安全：`safe`
- 负面：`worst quality, low quality, score_1, score_2, score_3, artist name`
```

- [ ] **Step 2: Verify the file reads correctly**

Read `src/lib/server/agent/prompts/anima.md` and confirm:
- No hardcoded "推荐正向前缀" or "推荐负面提示词"
- Quality tags section is a scenario table, not a fixed template
- Negative prompts section is layered composition, not a fixed string
- Safety tags section is a scenario table
- Core rules are present (lowercase, spaces, BREAK ban, weight syntax, tag order, artist rules)
- Fallback defaults are present
- No content that belongs only in style guidance files

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/agent/prompts/anima.md
git commit -m "rewrite: replace hardcoded Anima tag templates with scenario-indexed reference tables"
```

---

### Task 2: Trim `styles/anima/hybrid.md`

**Files:**
- Modify: `src/lib/server/agent/prompts/styles/anima/hybrid.md`

- [ ] **Step 1: Write the trimmed `hybrid.md`**

Replace the entire file content with:

```markdown
你的输出采用 Anima hybrid 格式：**标签与自然语言可以任意顺序混合**。

推荐写法（与官方示例一致）是将元数据标签放在最前面，后面紧跟 NL 画面描述。

**画面内容用自然语言写**（紧接标签前缀后）：
- 主体角色的外观、动作、表情、姿态
- 环境和场景
- 光影（光源类型、方向、色温）
- 色彩氛围
- 至少写 2 句完整的 NL 句子

示例：masterpiece, best quality, anime screenshot, anime coloring, safe, @artist_name. An anime girl with medium-length blonde hair sits alone at the far end of a long empty diner counter, shoulders hunched inward. Cold white fluorescent light from above bathes everything in flat, shadowless pale blue.

不要输出纯标签 prompt —— Anima 的 Qwen3 编码器需要 NL 才能发挥优势。
```

Note: Core rules (lowercase, spaces, BREAK ban, weight syntax, artist @ prefix, etc.) are NOT repeated here — they live in `anima.md`. This file only covers what's unique to hybrid format.

- [ ] **Step 2: Verify no duplicated core rules**

Confirm the file does NOT contain:
- "小写" / "空格代替下划线" / "逗号后必须有空格" (in anima.md)
- "BREAK" rule (in anima.md)
- "(keyword:weight)" rule (in anima.md)
- Quality tag recommendations (in anima.md)
- Negative prompt template (in anima.md)

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/agent/prompts/styles/anima/hybrid.md
git commit -m "trim: remove duplicated core rules from Anima hybrid style guidance"
```

---

### Task 3: Trim `styles/anima/tags.md`

**Files:**
- Modify: `src/lib/server/agent/prompts/styles/anima/tags.md`

- [ ] **Step 1: Write the trimmed `tags.md`**

Replace the entire file content with:

```markdown
你的输出采用 Anima 纯标签格式：逗号分隔的 Danbooru/Gelbooru 风格关键词。Anima 使用 Qwen3 编码器，没有 75 token 限制。

示例：year 2025, newest, masterpiece, best quality, highres, safe, 1girl, oomuro sakurako, yuru yuri, @nnn yryr, smile, brown hair, hat, solo, fur-trimmed gloves, open mouth, long hair
```

Note: Core rules, tag order, quality tags, negative prompts, safety tags — all in `anima.md`. This file only defines the format and gives one example.

- [ ] **Step 2: Verify no duplicated core rules**

Confirm the file does NOT contain:
- "小写" / "空格代替下划线" / "逗号后必须有空格"
- "BREAK" rule
- "(keyword:weight)" rule
- Tag order guidance
- Quality/safety tag "必须包含" requirements

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/agent/prompts/styles/anima/tags.md
git commit -m "trim: remove duplicated core rules from Anima tags style guidance"
```

---

### Task 4: Trim `styles/anima/natural.md`

**Files:**
- Modify: `src/lib/server/agent/prompts/styles/anima/natural.md`

- [ ] **Step 1: Write the trimmed `natural.md`**

Replace the entire file content with:

```markdown
你的输出采用 Anima 纯自然语言格式：流畅的段落式英文描述。Anima 的 Qwen3 编码器对复杂自然语言有很强的理解能力。

可以在 NL prompt 开头放质量/画师标签（官方明确支持）：
masterpiece, best quality, @artist_name. Natural language description continues here...

结构建议：主体 → 外观动作 → 环境背景 → 光影氛围 → 风格品质。至少 2 句完整句子。

多角色时每个角色必须命名并描述外观，不能只列名字。
```

- [ ] **Step 2: Verify no duplicated core rules**

Confirm the file does NOT contain:
- "(keyword:weight)" rule
- "BREAK" rule
- "角色名和系列名遵循标准英文大写" (moved to anima.md)
- Detailed quality/safety/negative tag guidance

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/agent/prompts/styles/anima/natural.md
git commit -m "trim: remove duplicated core rules from Anima natural style guidance"
```

---

### Task 5: Update `model-profiles.ts` tips

**Files:**
- Modify: `src/lib/server/agent/model-profiles.ts:168-181` (Anima tips string)

- [ ] **Step 1: Update the Anima tips**

Replace the `tips` string in the Anima profile (lines 168-181) with:

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
      "25-35 步，CFG 4-5。" +
      "质量标签、安全标签、负面提示词不要使用固定模板——根据画面风格和内容从系统提示词的场景参考表中选择最合适的组合。",
```

Key changes:
- Removed last line: "推荐正向前缀：masterpiece, best quality, score_7, safe。推荐负面：worst quality, low quality, score_1, score_2, score_3, artist name。"
- Added: pointer to scenario reference tables in system prompt
- Changed "30-50 步" to "25-35 步" (matches research data)

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: no errors related to model-profiles.ts

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/agent/model-profiles.ts
git commit -m "update: remove hardcoded Anima tag recommendations from model profile tips"
```

---

## Self-Review

**Spec coverage:**
- Quality tags scenario table → Task 1 ✓
- Safety tags scenario table → Task 1 ✓
- Negative prompts layered composition → Task 1 ✓
- Sampler & parameters table → Task 1 ✓
- Pitfalls & caveats → Task 1 ✓
- Fallback defaults → Task 1 ✓
- Style files cleanup (hybrid/tags/natural) → Tasks 2, 3, 4 ✓
- model-profiles.ts tips update → Task 5 ✓

**Placeholder scan:** No TBD, TODO, or vague steps. All file contents are specified in full.

**Type consistency:** Only Task 5 touches TypeScript code. The `tips` property is a string — the replacement maintains string concatenation format matching surrounding profiles.
