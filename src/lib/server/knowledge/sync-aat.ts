import {
  createWriteStream,
  createReadStream,
  existsSync,
  readdirSync,
  statSync,
  mkdirSync,
  unlinkSync,
  renameSync,
} from "fs";
import { finished } from "stream/promises";
import { createInterface } from "readline";
import { execSync } from "child_process";
import { db } from "../db";
import { artConcepts } from "../db/schema";
import { eq } from "drizzle-orm";
import { generateEmbeddings } from "./embedding";
import { startSync, updateProgress, finishSync, failSync } from "./sync-status";

const AAT_FULL_URL = "http://aatdownloads.getty.edu/VocabData/full.zip";
const DATA_DIR = "data/aat";
const NT_FILE = "AATOut_Full.nt";

// RDF predicates
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
const SKOS_IN_SCHEME = "http://www.w3.org/2004/02/skos/core#inScheme";
const SKOS_SCOPE_NOTE = "http://www.w3.org/2004/02/skos/core#scopeNote";
const SKOS_RELATED = "http://www.w3.org/2004/02/skos/core#related";
const RDF_VALUE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#value";
const GVP_BROADER_PREFERRED =
  "http://vocab.getty.edu/ontology#broaderPreferredExtended";
const AAT_SCHEME = "http://vocab.getty.edu/aat/";
const GVP_CONCEPT = "http://vocab.getty.edu/ontology#Concept";

// Concept URI pattern: http://vocab.getty.edu/aat/3\d{8}
const CONCEPT_URI_RE = /\/aat\/3\d{8}$/;

interface Triple {
  s: string;
  p: string;
  o: string;
  oType: "uri" | "literal";
}

interface ConceptData {
  labels: Map<string, string>;
  scopeNoteUris: string[];
  broaderUris: string[];
  relatedUris: string[];
  isConcept: boolean;
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
  const litMatch = o.match(/^"(.*)"(?:@(\w[\w-]*))?$/);
  if (!litMatch) return null;
  const text = litMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
  const lang = litMatch[2] || "";
  return { s, p, o: `${text}\0${lang}`, oType: "literal" };
}

function findLatestZip(): string | null {
  if (!existsSync(DATA_DIR)) return null;
  const files = readdirSync(DATA_DIR).filter(
    (f) =>
      f.startsWith("aat_full_") &&
      f.endsWith(".zip") &&
      statSync(`${DATA_DIR}/${f}`).size > 0,
  );
  if (files.length === 0) return null;
  files.sort().reverse();
  return files[0];
}

async function downloadZip(): Promise<string> {
  const existing = findLatestZip();
  if (existing) {
    const fullPath = `${DATA_DIR}/${existing}`;
    const age = Date.now() - statSync(fullPath).mtimeMs;
    if (age < 30 * 24 * 60 * 60 * 1000) {
      console.log("[sync-aat] Using cached", fullPath);
      return fullPath;
    }
  }

  mkdirSync(DATA_DIR, { recursive: true });
  const dateStr = new Date().toISOString().slice(0, 10);
  const zipPath = `${DATA_DIR}/aat_full_${dateStr}.zip`;

  if (existsSync(zipPath) && statSync(zipPath).size > 0) {
    console.log("[sync-aat] Using cached", zipPath);
    return zipPath;
  }
  if (existsSync(zipPath) && statSync(zipPath).size === 0) {
    unlinkSync(zipPath);
  }

  console.log("[sync-aat] Downloading AAT ZIP...");
  const res = await fetch(AAT_FULL_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const fileStream = createWriteStream(zipPath);
  const reader = res.body!.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fileStream.write(Buffer.from(value));
  }
  fileStream.end();
  await finished(fileStream);
  console.log(
    "[sync-aat] Downloaded to",
    zipPath,
    `(${statSync(zipPath).size} bytes)`,
  );
  return zipPath;
}

function extractNt(zipPath: string): string {
  const ntPath = zipPath.replace(".zip", ".nt");
  if (existsSync(ntPath) && statSync(ntPath).size > 0) {
    console.log("[sync-aat] Using cached NT at", ntPath);
    return ntPath;
  }
  console.log("[sync-aat] Extracting to", ntPath);
  execSync(`unzip -o "${zipPath}" "${NT_FILE}" -d "${DATA_DIR}"`, {
    stdio: "inherit",
  });
  const extracted = `${DATA_DIR}/${NT_FILE}`;
  if (extracted !== ntPath) {
    if (existsSync(ntPath)) unlinkSync(ntPath);
    renameSync(extracted, ntPath);
  }
  return ntPath;
}

function parseNtFile(ntPath: string): Promise<{
  concepts: Map<string, ConceptData>;
  scopeNoteTexts: Map<string, string>;
}> {
  return new Promise((resolve, reject) => {
    const concepts = new Map<string, ConceptData>();
    const scopeNoteTexts = new Map<string, string>();
    let lineCount = 0;

    const getOrCreate = (uri: string): ConceptData => {
      if (!concepts.has(uri)) {
        concepts.set(uri, {
          labels: new Map(),
          scopeNoteUris: [],
          broaderUris: [],
          relatedUris: [],
          isConcept: false,
        });
      }
      return concepts.get(uri)!;
    };

    const rl = createInterface({ input: createReadStream(ntPath) });

    rl.on("line", (line: string) => {
      lineCount++;
      const t = parseTriple(line);
      if (!t) return;

      // Scope note text — always collect (they're small, tens of thousands)
      if (
        t.p === RDF_VALUE &&
        t.oType === "literal" &&
        t.s.includes("scopeNote")
      ) {
        const [text] = t.o.split("\0");
        scopeNoteTexts.set(t.s, text);
        return;
      }

      // Only process concept URIs: http://vocab.getty.edu/aat/3\d{8}
      if (!CONCEPT_URI_RE.test(t.s)) return;

      const rec = getOrCreate(t.s);

      if (t.p === RDF_TYPE && t.o === GVP_CONCEPT) {
        rec.isConcept = true;
      } else if (t.p === SKOS_IN_SCHEME && t.o === AAT_SCHEME) {
        rec.isConcept = true;
      } else if (t.p === RDFS_LABEL && t.oType === "literal") {
        const [text, lang] = t.o.split("\0");
        rec.labels.set(lang, text);
      } else if (t.p === SKOS_SCOPE_NOTE && t.oType === "uri") {
        rec.scopeNoteUris.push(t.o);
      } else if (t.p === GVP_BROADER_PREFERRED && t.oType === "uri") {
        rec.broaderUris.push(t.o);
      } else if (t.p === SKOS_RELATED && t.oType === "uri") {
        rec.relatedUris.push(t.o);
      }

      if (lineCount % 1_000_000 === 0) {
        console.log(`[sync-aat] ${lineCount} lines, ${concepts.size} concepts`);
        updateProgress({ done: lineCount });
      }
    });

    rl.on("close", () => {
      console.log(
        `[sync-aat] Parse complete: ${lineCount} lines, ${concepts.size} concepts (${[...concepts.values()].filter((c) => c.isConcept).length} confirmed), ${scopeNoteTexts.size} scope notes`,
      );
      resolve({ concepts, scopeNoteTexts });
    });
    rl.on("error", reject);
  });
}

function buildHierarchyPath(
  uri: string,
  concepts: Map<string, ConceptData>,
): string {
  const parts: string[] = [];
  const visited = new Set<string>();
  let current = uri;
  while (current && !visited.has(current)) {
    visited.add(current);
    const rec = concepts.get(current);
    if (!rec) break;
    const label = rec.labels.get("en") || rec.labels.values().next().value;
    if (label) parts.unshift(label);
    current = rec.broaderUris[0] || "";
  }
  return parts.join(" > ");
}

function mapToDimension(path: string): string {
  const p = path.toLowerCase();
  if (p.includes("light")) return "lighting";
  if (p.includes("composit") || p.includes("perspective")) return "composition";
  if (p.includes("color") || p.includes("couleur")) return "color";
  if (p.includes("texture")) return "texture";
  if (
    p.includes("built environment") ||
    p.includes("settlement") ||
    p.includes("landscape") ||
    p.includes("architecture")
  )
    return "setting";
  if (p.includes("styles and periods") || p.includes("style")) return "style";
  if (
    p.includes("processes and techniques") ||
    p.includes("technique") ||
    p.includes("activity")
  )
    return "technical";
  return "other";
}

function subCategory(path: string): string {
  const parts = path.split(" > ");
  return parts[parts.length - 1] || "";
}

function resolveConceptName(
  uri: string,
  concepts: Map<string, ConceptData>,
): string | null {
  const rec = concepts.get(uri);
  if (!rec) return null;
  return rec.labels.get("en") || rec.labels.values().next().value || null;
}

export async function syncAat(): Promise<{
  inserted: number;
  updated: number;
}> {
  if (!startSync("aat")) throw new Error("Sync already in progress");

  try {
    updateProgress({ stage: "downloading" });
    const zipPath = await downloadZip();

    updateProgress({ stage: "parsing" });
    const ntPath = extractNt(zipPath);
    const { concepts, scopeNoteTexts } = await parseNtFile(ntPath);

    // Filter to confirmed AAT concepts only
    const aatConcepts = new Map(
      [...concepts.entries()].filter(([_, c]) => c.isConcept),
    );
    console.log(`[sync-aat] AAT concepts: ${aatConcepts.size}`);

    // Build entries
    const entries: {
      name: string;
      nameZh: string | null;
      category: string;
      subCategory: string;
      visualDescription: string | null;
      tags: string;
      relatedConcepts: string;
    }[] = [];

    for (const [uri, c] of aatConcepts) {
      const path = buildHierarchyPath(uri, concepts);
      const dim = mapToDimension(path);
      if (dim === "other") continue;

      const enLabel = c.labels.get("en") || c.labels.values().next().value;
      if (!enLabel) continue;
      const zhLabel = c.labels.get("zh-hant") || c.labels.get("zh") || null;

      // Alt labels as tags (non-en, non-zh)
      const tags: string[] = [];
      for (const [lang, text] of c.labels) {
        if (lang !== "en" && lang !== "zh-hant" && lang !== "zh")
          tags.push(text);
      }

      // Scope note
      let visualDescription: string | null = null;
      for (const snUri of c.scopeNoteUris) {
        const text = scopeNoteTexts.get(snUri);
        if (text) {
          visualDescription = text;
          break;
        }
      }

      // Related concepts resolved to names
      const relatedNames: string[] = [];
      for (const relUri of c.relatedUris) {
        const name = resolveConceptName(relUri, concepts);
        if (name) relatedNames.push(name);
      }

      entries.push({
        name: enLabel,
        nameZh: zhLabel,
        category: dim,
        subCategory: subCategory(path),
        visualDescription,
        tags: JSON.stringify(tags),
        relatedConcepts: JSON.stringify(relatedNames),
      });
    }

    console.log(`[sync-aat] Relevant: ${entries.length}`);

    updateProgress({ stage: "importing", total: entries.length, done: 0 });

    let inserted = 0;
    let updated = 0;
    const embeddingTexts: string[] = [];
    const embeddingNames: string[] = [];

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const existing = await db
        .select({ id: artConcepts.id })
        .from(artConcepts)
        .where(eq(artConcepts.name, e.name));

      if (existing.length > 0) {
        await db
          .update(artConcepts)
          .set({
            nameZh: e.nameZh,
            category: e.category,
            subCategory: e.subCategory,
            visualDescription: e.visualDescription,
            tags: e.tags,
            relatedConcepts: e.relatedConcepts,
            source: "aat",
          })
          .where(eq(artConcepts.id, existing[0].id));
        updated++;
      } else {
        await db.insert(artConcepts).values({
          name: e.name,
          nameZh: e.nameZh,
          category: e.category,
          subCategory: e.subCategory,
          visualDescription: e.visualDescription,
          tags: e.tags,
          relatedConcepts: e.relatedConcepts,
          source: "aat",
        });
        inserted++;
      }

      embeddingTexts.push(
        `${e.visualDescription || ""} ${e.name} ${e.nameZh || ""}`,
      );
      embeddingNames.push(e.name);

      if (i % 200 === 0) updateProgress({ done: i + 1 });
    }

    updateProgress({ stage: "embedding", done: entries.length });

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
        updateProgress({ done: entries.length + i + batch.length });
      }
    }

    finishSync();
    return { inserted, updated };
  } catch (e: any) {
    failSync(e.message);
    throw e;
  }
}
