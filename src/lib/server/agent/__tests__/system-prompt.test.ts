import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { assemblePrompt } from "../system-prompt";

describe("assemblePrompt", () => {
  it("injects related concepts between modules and directory when provided", () => {
    const modules = "## 角色\n你是一个创意助手";
    const directory =
      "## 知识库目录\n### 光影 (lighting)\n  natural: 5 concepts";
    const relatedConcepts =
      "### 当前意图相关概念\n- **rembrandt_lighting** (伦勃朗光) [lighting > studio] — A lighting technique";
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

describe("Anima style guidance files", () => {
  const stylesDir = join(import.meta.dirname, "..", "prompts", "styles");

  it("loads anima hybrid guidance from file with arbitrary mixing", () => {
    const hybridFile = readFileSync(
      join(stylesDir, "anima", "hybrid.md"),
      "utf-8",
    );
    expect(hybridFile).toContain("任意顺序混合");
    expect(hybridFile).not.toContain(
      "必须采用 Anima 模型的 hybrid 格式：元数据用逗号分隔的标签前缀",
    );
  });

  it("loads anima tags guidance without 75-token limit", () => {
    const tagsFile = readFileSync(join(stylesDir, "anima", "tags.md"), "utf-8");
    expect(tagsFile).toContain("没有 75 token 限制");
  });

  it("loads anima natural guidance with NL format instructions", () => {
    const naturalFile = readFileSync(
      join(stylesDir, "anima", "natural.md"),
      "utf-8",
    );
    expect(naturalFile).toContain("自然语言");
    expect(naturalFile).not.toContain("不要使用权重语法");
  });
});
