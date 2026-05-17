import { spawn } from "child_process";
import { createWriteStream, unlinkSync, existsSync } from "fs";
import { createInterface } from "readline";
import { db } from "../db";
import { artConcepts } from "../db/schema";
import { eq } from "drizzle-orm";
import { generateEmbeddings } from "./embedding";
import { startSync, updateProgress, finishSync, failSync } from "./sync-status";

const AAT_FULL_URL = "http://aatdownloads.getty.edu/VocabData/full.zip";
const ZIP_FILE = "/tmp/aat_full.zip";
const NT_FILE = "AATOut_Full.nt";

// AAT RDF predicates
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
const SKOS_IN_SCHEME = "http://www.w3.org/2004/02/skos/core#inScheme";
const SKOS_SCOPE_NOTE = "http://www.w3.org/2004/02/skos/core#scopeNote";
const RDF_VALUE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#value";
const GVP_BROADER_PREFERRED =
  "http://vocab.getty.edu/ontology#broaderPreferredExtended";
const AAT_SCHEME = "http://vocab.getty.edu/aat/";
const GVP_CONCEPT = "http://vocab.getty.edu/ontology#Concept";

interface Triple {
  s: string;
  p: string;
  o: string;
  oType: "uri" | "literal";
}

interface ConceptRecord {
  uri: string;
  labels: Map<string, string>; // lang -> text
  scopeNoteUris: string[];
  broaderUris: string[];
  isAatConcept: boolean;
}

function parseTriple(line: string): Triple | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const match = trimmed.match(/^<(.+?)>\s+<(.+?)>\s+(.+?)\s*\.$/);
  if (!match) return null;
  const [, s, p, o] = match;
  if (o.startsWith("<")) {
    return { s, p, o: o.slice(1, -1), oType: "uri" };
  }
  // Literal: extract text and optional language tag
  const litMatch = o.match(/^"(.*)"(?:@(\w[\w-]*))?$/);
  if (!litMatch) return null;
  const text = litMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
  const lang = litMatch[2] || "";
  return { s, p, o: `${text}\0${lang}`, oType: "literal" };
}

async function downloadZip(): Promise<void> {
  if (existsSync(ZIP_FILE)) {
    console.log("[sync-aat] Using cached ZIP at", ZIP_FILE);
    return;
  }

  console.log("[sync-aat] Downloading AAT ZIP...");
  const res = await fetch(AAT_FULL_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const fileStream = createWriteStream(ZIP_FILE);
  const reader = res.body!.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fileStream.write(Buffer.from(value));
  }
  fileStream.end();
  console.log("[sync-aat] Downloaded to", ZIP_FILE);
}

function streamNtriples(): Promise<{
  concepts: Map<string, ConceptRecord>;
  scopeNotes: Map<string, string>;
}> {
  return new Promise((resolve, reject) => {
    const concepts = new Map<string, ConceptRecord>();
    const scopeNotes = new Map<string, string>();
    let lineCount = 0;

    const getOrCreate = (uri: string): ConceptRecord => {
      if (!concepts.has(uri)) {
        concepts.set(uri, {
          uri,
          labels: new Map(),
          scopeNoteUris: [],
          broaderUris: [],
          isAatConcept: false,
        });
      }
      return concepts.get(uri)!;
    };

    const unzip = spawn("unzip", ["-p", ZIP_FILE, NT_FILE], {
      stdio: ["ignore", "pipe", "ignore"],
    });

    const rl = createInterface({ input: unzip.stdout! });

    rl.on("line", (line: string) => {
      lineCount++;
      const t = parseTriple(line);
      if (!t) return;

      if (t.p === RDF_TYPE) {
        if (t.o === GVP_CONCEPT) {
          getOrCreate(t.s).isAatConcept = true;
        }
        return;
      }

      if (t.p === SKOS_IN_SCHEME && t.o === AAT_SCHEME) {
        getOrCreate(t.s).isAatConcept = true;
        return;
      }

      if (t.p === RDFS_LABEL && t.oType === "literal") {
        const [text, lang] = t.o.split("\0");
        getOrCreate(t.s).labels.set(lang, text);
        return;
      }

      if (t.p === SKOS_SCOPE_NOTE && t.oType === "uri") {
        getOrCreate(t.s).scopeNoteUris.push(t.o);
        return;
      }

      if (t.p === GVP_BROADER_PREFERRED && t.oType === "uri") {
        getOrCreate(t.s).broaderUris.push(t.o);
        return;
      }

      if (
        t.p === RDF_VALUE &&
        t.oType === "literal" &&
        t.s.includes("scopeNote")
      ) {
        const [text] = t.o.split("\0");
        scopeNotes.set(t.s, text);
        return;
      }

      // Progress every 1M lines
      if (lineCount % 1_000_000 === 0) {
        console.log(
          `[sync-aat] Parsed ${lineCount} lines, ${concepts.size} subjects`,
        );
        updateProgress({ done: lineCount });
      }
    });

    rl.on("close", () => {
      console.log(
        `[sync-aat] Parse complete: ${lineCount} lines, ${concepts.size} subjects, ${scopeNotes.size} scope notes`,
      );
      resolve({ concepts, scopeNotes });
    });

    unzip.on("error", reject);
    rl.on("error", reject);
  });
}

function buildHierarchyPath(
  uri: string,
  concepts: Map<string, ConceptRecord>,
): string[] {
  const path: string[] = [];
  const visited = new Set<string>();
  let current = uri;

  while (current && !visited.has(current)) {
    visited.add(current);
    const rec = concepts.get(current);
    if (!rec) break;

    // Use English label, fallback to first available
    const label = rec.labels.get("en") || rec.labels.values().next().value;
    if (label) path.unshift(label);

    current = rec.broaderUris[0] || "";
  }

  return path;
}

function mapToDimension(hierarchyPath: string): string {
  // Check if hierarchy path contains any of our dimension keywords
  const lowerPath = hierarchyPath.toLowerCase();

  if (lowerPath.includes("light") || lowerPath.includes("lumière"))
    return "lighting";
  if (lowerPath.includes("composit") || lowerPath.includes("perspective"))
    return "composition";
  if (lowerPath.includes("color") || lowerPath.includes("couleur"))
    return "color";
  if (lowerPath.includes("texture")) return "texture";
  if (
    lowerPath.includes("built environment") ||
    lowerPath.includes("settlement") ||
    lowerPath.includes("landscape") ||
    lowerPath.includes("architecture")
  )
    return "setting";
  if (lowerPath.includes("styles and periods") || lowerPath.includes("style"))
    return "style";
  if (
    lowerPath.includes("processes and techniques") ||
    lowerPath.includes("technique") ||
    lowerPath.includes("activity")
  )
    return "technical";

  return "other";
}

function extractSubCategory(hierarchyPath: string): string {
  const parts = hierarchyPath.split(" > ");
  // Return the last meaningful part
  return parts[parts.length - 1] || parts[0] || "";
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
    await downloadZip();

    updateProgress({ stage: "parsing" });
    const { concepts, scopeNotes } = await streamNtriples();

    // Filter to only AAT concepts (gvp:Concept + inScheme aat:)
    const aatConcepts = new Map(
      [...concepts.entries()].filter(([_, c]) => c.isAatConcept),
    );
    console.log(`[sync-aat] AAT concepts: ${aatConcepts.size}`);

    const relevant: {
      name: string;
      nameZh: string | null;
      category: string;
      subCategory: string;
      visualDescription: string | null;
      tags: string;
      relatedConcepts: string;
    }[] = [];

    for (const [uri, c] of aatConcepts) {
      const hierarchyPath = buildHierarchyPath(uri, concepts).join(" > ");
      const category = mapToDimension(hierarchyPath);
      if (category === "other") continue;

      const enLabel =
        c.labels.get("en") ||
        c.labels.values().next().value ||
        uri.split("/").pop()!;
      const zhLabel = c.labels.get("zh-hant") || c.labels.get("zh") || null;

      // Collect all labels as tags (excluding the primary English and Chinese ones)
      const tags: string[] = [];
      for (const [lang, text] of c.labels) {
        if (lang !== "en" && lang !== "zh-hant" && lang !== "zh") {
          tags.push(text);
        }
      }

      // Get scope note text
      let visualDescription: string | null = null;
      for (const snUri of c.scopeNoteUris) {
        const text = scopeNotes.get(snUri);
        if (text) {
          visualDescription = text;
          break;
        }
      }

      relevant.push({
        name: enLabel,
        nameZh: zhLabel,
        category,
        subCategory: extractSubCategory(hierarchyPath),
        visualDescription,
        tags: JSON.stringify(tags),
        relatedConcepts: "[]", // Will be populated from broaderUris if needed
      });
    }

    console.log(
      `[sync-aat] Relevant concepts (in our 7 dimensions): ${relevant.length}`,
    );

    updateProgress({ stage: "importing", total: relevant.length, done: 0 });

    let inserted = 0;
    let updated = 0;
    const embeddingTexts: string[] = [];
    const embeddingNames: string[] = [];

    for (let i = 0; i < relevant.length; i++) {
      const c = relevant[i];

      const existing = await db
        .select({ id: artConcepts.id })
        .from(artConcepts)
        .where(eq(artConcepts.name, c.name));

      if (existing.length > 0) {
        await db
          .update(artConcepts)
          .set({
            nameZh: c.nameZh,
            category: c.category,
            subCategory: c.subCategory,
            visualDescription: c.visualDescription,
            tags: c.tags,
            source: "aat",
            sourceId: null,
          })
          .where(eq(artConcepts.id, existing[0].id));
        updated++;
      } else {
        await db.insert(artConcepts).values({
          name: c.name,
          nameZh: c.nameZh,
          category: c.category,
          subCategory: c.subCategory,
          visualDescription: c.visualDescription,
          tags: c.tags,
          source: "aat",
        });
        inserted++;
      }

      const scopeNote = c.visualDescription || "";
      embeddingTexts.push(`${scopeNote} ${c.name} ${c.nameZh || ""}`);
      embeddingNames.push(c.name);

      if (i % 200 === 0) {
        updateProgress({ done: i + 1 });
      }
    }

    updateProgress({ stage: "embedding", done: relevant.length });

    if (embeddingTexts.length > 0) {
      const batchSize = 20;
      for (let i = 0; i < embeddingTexts.length; i += batchSize) {
        const batch = embeddingTexts.slice(i, i + batchSize);
        const names = embeddingNames.slice(i, i + batchSize);
        const embeddings = await generateEmbeddings(batch);
        for (let j = 0; j < embeddings.length; j++) {
          await db
            .update(artConcepts)
            .set({ embedding: JSON.stringify(embeddings[j]) })
            .where(eq(artConcepts.name, names[j]));
        }
        updateProgress({ done: relevant.length + i + batch.length });
      }
    }

    finishSync();
    return { inserted, updated };
  } catch (e: any) {
    failSync(e.message);
    throw e;
  }
}
