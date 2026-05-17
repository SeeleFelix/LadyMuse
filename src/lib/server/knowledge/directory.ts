import { db } from "../db";
import { artConcepts, artPatterns } from "../db/schema";

export async function buildKnowledgeDirectory(): Promise<string> {
  // 概念：按 category → sub_category 分组
  const concepts = await db
    .select({
      category: artConcepts.category,
      subCategory: artConcepts.subCategory,
      name: artConcepts.name,
    })
    .from(artConcepts)
    .orderBy(artConcepts.category, artConcepts.subCategory, artConcepts.name);

  // 按 category → sub_category 分组
  const grouped: Record<string, Record<string, string[]>> = {};
  for (const c of concepts) {
    const cat = c.category;
    const sub = c.subCategory || "other";
    if (!grouped[cat]) grouped[cat] = {};
    if (!grouped[cat][sub]) grouped[cat][sub] = [];
    grouped[cat][sub].push(c.name);
  }

  // 维度名中文映射
  const dimNames: Record<string, string> = {
    lighting: "光影",
    composition: "构图",
    color: "色彩",
    texture: "质感",
    setting: "场景",
    subject: "主体",
    style: "风格",
    technical: "技术",
  };

  let dir = "## 知识库目录\n\n";
  for (const [cat, subs] of Object.entries(grouped)) {
    const catName = dimNames[cat] || cat;
    dir += `### ${catName} (${cat})\n`;
    for (const [sub, names] of Object.entries(subs)) {
      dir += `  ${sub}: ${names.join(", ")}\n`;
    }
    dir += "\n";
  }

  // 模式清单
  const patterns = await db
    .select({ name: artPatterns.name, intent: artPatterns.intent })
    .from(artPatterns)
    .orderBy(artPatterns.name);

  if (patterns.length > 0) {
    dir += "### 创作模式 (patterns)\n";
    for (const p of patterns) {
      const intent = p.intent ? ` — ${p.intent}` : "";
      dir += `  ${p.name}${intent}\n`;
    }
  }

  return dir;
}
