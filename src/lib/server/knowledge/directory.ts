import { db } from "../db";
import { artConcepts, artPatterns } from "../db/schema";

export interface ConceptDetail {
  name: string;
  nameZh: string | null;
  category: string;
  subCategory: string | null;
  visualDescription: string | null;
  score: number;
}

export function formatCompactDirectory(
  categoryCounts: Record<string, number>,
): string {
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
  for (const [cat, count] of Object.entries(categoryCounts)) {
    const catName = dimNames[cat] || cat;
    dir += `- ${catName} (${cat}): ${count} concepts\n`;
  }
  return dir;
}

export function formatRelatedConcepts(concepts: ConceptDetail[]): string {
  if (concepts.length === 0) return "";

  let section = "### 当前意图相关概念\n\n";
  for (const c of concepts) {
    const zh = c.nameZh ? ` (${c.nameZh})` : "";
    const cat = c.subCategory ? `${c.category} > ${c.subCategory}` : c.category;
    const snippet = c.visualDescription
      ? c.visualDescription.slice(0, 120)
      : "";
    section += `- **${c.name}**${zh} [${cat}] — ${snippet}\n`;
  }
  return section;
}

export async function buildKnowledgeDirectory(): Promise<string> {
  const concepts = await db
    .select({
      category: artConcepts.category,
    })
    .from(artConcepts);

  const categoryCounts: Record<string, number> = {};
  for (const c of concepts) {
    categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
  }

  let dir = formatCompactDirectory(categoryCounts);

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
