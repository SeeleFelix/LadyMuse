# WikiArt 风格库调研

## 概述

WikiArt（wikiart.org，"Visual Art Encyclopedia"）收录了 200+ 艺术风格，按时代和地域层级分类。提供 7 种语言支持（含中文、日文）。LadyMuse 目前只有 8 个风格家族 17 个风格，差距巨大。

## 结构

按时代→地域→风格层级分类。

### 覆盖范围
- **西方艺术**: 从古埃及到当代，涵盖所有主要流派
- **中国艺术**: 工笔（Gongbi）、水墨/写意（Ink/wash painting）
- **日本艺术**: 浮世绘（Ukiyo-e）、水墨画（Sumi-e）、琳派（Rinpa）、狩野派（Kano school）
- **伊斯兰艺术**
- **韩国艺术**
- **原住民艺术**

### LadyMuse 当前缺口

LadyMuse 现有 17 个风格（8 家族）：
- anime, photorealistic, oil painting, watercolor, digital art, cyberpunk, fantasy, chinese art

WikiArt 200+ 风格中我们完全缺失的：
- **西方经典**: 浪漫主义、现实主义、象征主义、表现主义、超现实主义、达达主义、波普艺术、极简主义、概念艺术
- **亚洲传统**: 工笔、写意、山水、琳派、狩野派、日本画
- **当代数字**: vaporwave, synthwave, weirdcore, dreamcore, cottagecore

## 访问方式

### API
- 有 API 但需要注册审批
- 可以通过模拟 web 访问获取数据（类似现有 Civitai 集成方式）

### 页面访问
- 风格列表页：`https://www.wikiart.org/en/paintings-by-style/`
- 前端有 JSON 接口，可以抓取
- 跟 `src/lib/server/civitai.ts` 同样的模式

### 能拿到什么
- 风格列表（名称 + 时代 + 描述）
- 每个风格的代表画作
- 中文/日文名称
- 风格间层级关系

### 拿不到的
- positiveTemplate、negativePrompt、recommendedParams（LadyMuse 特有）
- 深度技法描述（每个风格只有一两句话）

## 许可

- API 需注册审批
- 艺术品图片有各自版权状态
- 通过模拟 web 访问可以获取结构化数据

## 对 LadyMuse 的价值

**中高。** 主要用于风格库大幅扩展：
1. 将风格从 17 个扩展到 50-100 个
2. 补充亚洲传统艺术风格（工笔、写意、山水）
3. 补充西方经典流派
4. 获取中英文风格名称
5. positiveTemplate/negativePrompt/recommendedParams 需要自己生成或让 LLM 辅助
