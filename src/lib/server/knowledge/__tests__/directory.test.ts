import { describe, it, expect } from "vitest";
import { formatCompactDirectory, formatRelatedConcepts } from "../directory";
import type { ConceptDetail } from "../directory";

describe("formatCompactDirectory", () => {
  it("renders dimension names in Chinese with concept counts", () => {
    const counts = {
      lighting: 1205,
      composition: 890,
    };

    const result = formatCompactDirectory(counts);

    expect(result).toContain("## 知识库目录");
    expect(result).toContain("- 光影 (lighting): 1205 concepts");
    expect(result).toContain("- 构图 (composition): 890 concepts");
  });

  it("shows only category-level counts, never individual names", () => {
    const counts = { lighting: 500 };

    const result = formatCompactDirectory(counts);

    expect(result).not.toMatch(/: rembrandt_lighting/);
    expect(result).not.toMatch(/: golden_hour/);
    expect(result).toContain("500 concepts");
  });

  it("handles empty input", () => {
    const result = formatCompactDirectory({});
    expect(result).toBe("## 知识库目录\n\n");
  });
});

describe("formatRelatedConcepts", () => {
  it("formats concepts with name, Chinese name, category path, and snippet", () => {
    const concepts: ConceptDetail[] = [
      {
        name: "rembrandt_lighting",
        nameZh: "伦勃朗光",
        category: "lighting",
        subCategory: "studio",
        visualDescription:
          "A lighting technique with a triangular patch under one eye",
        score: 0.92,
      },
      {
        name: "chiaroscuro",
        nameZh: "明暗对照法",
        category: "lighting",
        subCategory: "dramatic",
        visualDescription: "Strong contrasts between light and dark areas",
        score: 0.87,
      },
    ];

    const result = formatRelatedConcepts(concepts);

    expect(result).toContain("### 当前意图相关概念");
    expect(result).toContain("**rembrandt_lighting** (伦勃朗光)");
    expect(result).toContain("[lighting > studio]");
    expect(result).toContain("triangular patch under one eye");
    expect(result).toContain("**chiaroscuro** (明暗对照法)");
    expect(result).toContain("[lighting > dramatic]");
  });

  it("handles concepts without Chinese name", () => {
    const concepts: ConceptDetail[] = [
      {
        name: "golden_hour",
        nameZh: null,
        category: "lighting",
        subCategory: "natural",
        visualDescription:
          "Warm golden light shortly after sunrise or before sunset",
        score: 0.95,
      },
    ];

    const result = formatRelatedConcepts(concepts);

    expect(result).toContain("**golden_hour** [lighting > natural]");
    expect(result).not.toContain("(null)");
  });

  it("truncates visual description to 120 chars", () => {
    const longDesc = "A".repeat(200);
    const concepts: ConceptDetail[] = [
      {
        name: "test_concept",
        nameZh: null,
        category: "lighting",
        subCategory: null,
        visualDescription: longDesc,
        score: 0.8,
      },
    ];

    const result = formatRelatedConcepts(concepts);

    expect(result).toContain("A".repeat(120));
    expect(result).not.toContain("A".repeat(121));
  });

  it("returns empty string for empty array", () => {
    expect(formatRelatedConcepts([])).toBe("");
  });
});
