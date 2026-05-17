import JSZip from "jszip";
import { db } from "../db";
import { artConcepts } from "../db/schema";
import { eq } from "drizzle-orm";
import { generateEmbeddings } from "./embedding";
import { startSync, updateProgress, finishSync, failSync } from "./sync-status";

// AAT 层级路径前缀 → 我们的维度
const AAT_HIERARCHY_MAPPING: Record<string, string> = {
  // 光影
  "Associated Concepts Facet > ... > light-related concepts": "lighting",
  "Physical Attributes Facet > light": "lighting",
  // 构图
  "Associated Concepts Facet > ... > form and composition concepts":
    "composition",
  "Associated Concepts Facet > ... > perspective": "composition",
  // 色彩
  "Physical Attributes Facet > Color": "color",
  // 质感
  "Physical Attributes Facet > ... > texture": "texture",
  "Materials Facet > ... > texture": "texture",
  // 场景
  "Objects Facet > Built Environment": "setting",
  "Objects Facet > Settlements and Landscapes": "setting",
  // 主体 — AAT 没有直接对应，需 Wikipedia 补充
  // 风格
  "Styles and Periods Facet": "style",
  // 技术
  "Activities Facet > Processes and Techniques": "technical",
};

const AAT_FULL_URL = "https://vocab.getty.edu/dataset/aat/full.zip";

const PREF_LABEL = "http://www.w3.org/2004/02/skos/core#prefLabel";
const SCOPE_NOTE = "http://www.w3.org/2004/02/skos/core#scopeNote";
const ALT_LABEL = "http://www.w3.org/2004/02/skos/core#altLabel";
const RELATED = "http://www.w3.org/2004/02/skos/core#related";
const BROADER = "http://www.w3.org/2004/02/skos/core#broader";
const BROADER_PREFERRED = "http://vocab.getty.edu/ontology#broaderPreferred";
const IN_SCHEME = "http://www.w3.org/2004/02/skos/core#inScheme";
const AAT_SCHEME = "http://vocab.getty.edu/aat/";

interface AatConcept {
  uri: string;
  prefLabel: string;
  prefLabelZh?: string;
  scopeNote?: string;
  altLabels: string[];
  hierarchyPath: string;
  relatedUris: string[];
}

interface Triple {
  subject: string;
  predicate: string;
  object: { type: "uri" | "literal"; value: string };
}

function parseNtriples(text: string): Triple[] {
  const triples: Triple[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^<(.+?)>\s+<(.+?)>\s+(.+?)\s*\.$/);
    if (!match) continue;
    const [, subject, predicate, objectRaw] = match;
    let object: Triple["object"];
    if (objectRaw.startsWith("<")) {
      object = { type: "uri", value: objectRaw.slice(1, -1) };
    } else {
      const value = objectRaw
        .replace(/^"|"(@\w+)?$/g, "")
        .replace(/^"(.*)"$/, "$1");
      object = { type: "literal", value };
    }
    triples.push({ subject, predicate, object });
  }
  return triples;
}

function buildHierarchyPath(
  uri: string,
  bySubject: Map<string, Triple[]>,
): string {
  const pathParts: string[] = [];
  const visited = new Set<string>();
  let current = uri;

  while (current && !visited.has(current)) {
    visited.add(current);
    const ts = bySubject.get(current);
    if (!ts) break;

    const label = ts.find(
      (t) => t.predicate === PREF_LABEL && t.object.type === "literal",
    )?.object.value;
    if (label) pathParts.unshift(label);

    const broader = ts.find(
      (t) =>
        (t.predicate === BROADER_PREFERRED || t.predicate === BROADER) &&
        t.object.type === "uri",
    );
    current = broader?.object.value || "";
  }

  return pathParts.join(" > ");
}

function groupIntoConcepts(triples: Triple[]): AatConcept[] {
  const bySubject = new Map<string, Triple[]>();
  for (const t of triples) {
    if (!bySubject.has(t.subject)) bySubject.set(t.subject, []);
    bySubject.get(t.subject)!.push(t);
  }

  const aatSubjects = new Set(
    triples
      .filter((t) => t.predicate === IN_SCHEME && t.object.value === AAT_SCHEME)
      .map((t) => t.subject),
  );

  const concepts: AatConcept[] = [];
  for (const [uri, ts] of bySubject) {
    if (!aatSubjects.has(uri)) continue;

    const prefLabel = ts.find(
      (t) => t.predicate === PREF_LABEL && t.object.type === "literal",
    )?.object.value;
    if (!prefLabel) continue;

    const scopeNote = ts.find(
      (t) => t.predicate === SCOPE_NOTE && t.object.type === "literal",
    )?.object.value;

    const altLabels = ts
      .filter((t) => t.predicate === ALT_LABEL && t.object.type === "literal")
      .map((t) => t.object.value);

    const relatedUris = ts
      .filter((t) => t.predicate === RELATED && t.object.type === "uri")
      .map((t) => t.object.value);

    const hierarchyPath = buildHierarchyPath(uri, bySubject);

    concepts.push({
      uri,
      prefLabel,
      scopeNote,
      altLabels,
      hierarchyPath,
      relatedUris,
    });
  }
  return concepts;
}

async function downloadAndParse(): Promise<AatConcept[]> {
  const res = await fetch(AAT_FULL_URL);
  if (!res.ok) throw new Error(`Failed to download AAT: ${res.status}`);

  const buffer = await res.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const ntFile = Object.values(zip.files).find(
    (f) => f.name.endsWith(".nt") || f.name.endsWith(".ntriples"),
  );
  if (!ntFile) throw new Error("No N-Triples file found in AAT archive");

  const text = await ntFile.async("string");
  const triples = parseNtriples(text);
  return groupIntoConcepts(triples);
}

function mapToDimension(hierarchyPath: string): string {
  for (const [prefix, dim] of Object.entries(AAT_HIERARCHY_MAPPING)) {
    if (hierarchyPath.startsWith(prefix)) return dim;
  }
  return "other";
}

function extractSubCategory(hierarchyPath: string): string {
  const parts = hierarchyPath.split(" > ");
  return parts[parts.length - 1] || "";
}

function extractNameFromUri(uri: string): string {
  return uri.split("/").pop() || uri;
}

export async function syncAat(): Promise<{
  inserted: number;
  updated: number;
}> {
  if (!startSync("aat")) {
    throw new Error("Sync already in progress");
  }

  try {
    updateProgress({ stage: "downloading" });
    const concepts = await downloadAndParse();

    const relevant = concepts.filter((c) => {
      const dim = mapToDimension(c.hierarchyPath);
      return dim !== "other";
    });

    updateProgress({ stage: "importing", total: relevant.length, done: 0 });

    let inserted = 0;
    let updated = 0;

    const embeddingTexts: string[] = [];
    const embeddingTargets: { name: string }[] = [];

    for (let i = 0; i < relevant.length; i++) {
      const c = relevant[i];
      const category = mapToDimension(c.hierarchyPath);
      const subCategory = extractSubCategory(c.hierarchyPath);
      const scopeNote = c.scopeNote || "";

      const existing = await db
        .select({ id: artConcepts.id })
        .from(artConcepts)
        .where(eq(artConcepts.name, c.prefLabel));

      const data = {
        name: c.prefLabel,
        nameZh: c.prefLabelZh || null,
        category,
        subCategory,
        visualDescription: scopeNote,
        tags: JSON.stringify(c.altLabels),
        relatedConcepts: JSON.stringify(c.relatedUris.map(extractNameFromUri)),
        source: "aat" as const,
        sourceId: c.uri,
      };

      if (existing.length > 0) {
        await db
          .update(artConcepts)
          .set(data)
          .where(eq(artConcepts.id, existing[0].id));
        updated++;
      } else {
        await db.insert(artConcepts).values(data);
        inserted++;
      }

      embeddingTexts.push(
        `${scopeNote} ${c.altLabels.join(" ")} ${c.prefLabel}`,
      );
      embeddingTargets.push({ name: c.prefLabel });

      if (i % 100 === 0) {
        updateProgress({ done: Math.min(i + 1, relevant.length) });
      }
    }

    if (embeddingTexts.length > 0) {
      updateProgress({ stage: "embedding" });
      const embeddings = await generateEmbeddings(embeddingTexts);
      for (let i = 0; i < embeddings.length; i++) {
        await db
          .update(artConcepts)
          .set({ embedding: JSON.stringify(embeddings[i]) })
          .where(eq(artConcepts.name, embeddingTargets[i].name));
      }
    }

    finishSync();
    return { inserted, updated };
  } catch (e: any) {
    failSync(e.message);
    throw e;
  }
}
