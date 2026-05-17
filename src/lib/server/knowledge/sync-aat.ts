import {
  createWriteStream,
  existsSync,
  readdirSync,
  statSync,
  mkdirSync,
  unlinkSync,
  renameSync,
  openSync,
  readSync,
  closeSync,
} from "fs";
import { finished } from "stream/promises";
import { execSync } from "child_process";
import { db } from "../db";
import { artConcepts } from "../db/schema";
import { eq } from "drizzle-orm";
import { generateEmbeddings } from "./embedding";
import { startSync, updateProgress, finishSync, failSync } from "./sync-status";

const AAT_FULL_URL = "http://aatdownloads.getty.edu/VocabData/full.zip";
const DATA_DIR = "data/aat";
const NT_FILE = "AATOut_Full.nt";

// Predicate URIs used for quick indexOf checks
const P_RDFS_LABEL = "rdf-schema#label";
const P_RDF_TYPE = "rdf-syntax-ns#type";
const P_SKOS_INS = "skos/core#inScheme";
const P_SKOS_SN = "skos/core#scopeNote";
const P_SKOS_REL = "skos/core#related";
const P_GVP_BP = "ontology#broaderPreferredExtended";
const P_RDF_VALUE = "rdf-syntax-ns#value";
const O_GVP_CONCEPT = "ontology#Concept";
const O_AAT_SCHEME = "vocab.getty.edu/aat/";
const SUBJECT_SCOPE_NOTE = "/scopeNote/";

// Concept URI: http://vocab.getty.edu/aat/3\d{8}
const CONCEPT_URI_START = "vocab.getty.edu/aat/3";

interface RawConcept {
  en: string | null;
  zh: string | null;
  sn: string[]; // scope note URIs
  broader: string[]; // broaderPreferredExtended URIs
  related: string[]; // skos:related URIs
  ok: boolean; // confirmed as gvp:Concept or inScheme aat:
}

function extractSubject(line: string): string | null {
  const end = line.indexOf(">");
  if (end === -1) return null;
  return line.slice(1, end);
}

function decodeNt(text: string): string {
  return text.replace(/\\u([\da-fA-F]{4})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16)),
  );
}

function extractObject(line: string): { text: string; isUri: boolean } | null {
  // Find the object part — starts after the second ">"
  let gtCount = 0;
  let i = 0;
  for (i = 0; i < line.length; i++) {
    if (line[i] === ">") {
      gtCount++;
      if (gtCount === 2) break;
    }
  }
  if (gtCount < 2) return null;
  let objStart = i + 2; // skip "> "
  if (objStart >= line.length) return null;

  const raw = line.slice(objStart, -2); // remove trailing " ."
  if (raw.startsWith("<")) {
    return { text: raw.slice(1, -1), isUri: true };
  }
  // Literal: "text"@lang or "text"
  const firstQuote = raw.indexOf('"');
  if (firstQuote === -1) return null;
  const lastQuote = raw.lastIndexOf('"');
  if (lastQuote <= firstQuote) return null;
  return { text: decodeNt(raw.slice(firstQuote + 1, lastQuote)), isUri: false };
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

function parseNtFile(ntPath: string): Map<string, RawConcept> {
  const concepts = new Map<string, RawConcept>();
  const scopeNoteTexts = new Map<string, string>();
  const fd = openSync(ntPath, "r");
  const buf = Buffer.alloc(256 * 1024);
  let leftover = "";
  let lineCount = 0;

  const getOrCreate = (uri: string): RawConcept => {
    if (!concepts.has(uri)) {
      concepts.set(uri, {
        en: null,
        zh: null,
        sn: [],
        broader: [],
        related: [],
        ok: false,
      });
    }
    return concepts.get(uri)!;
  };

  while (true) {
    const n = readSync(fd, buf, 0, buf.length, null);
    if (n === 0) break;
    const chunk = leftover + buf.toString("utf8", 0, n);
    const lines = chunk.split("\n");
    leftover = lines.pop() || "";

    for (const line of lines) {
      lineCount++;
      if (!line || line.startsWith("#")) continue;

      // Scope note value — collect before concept URI check (subject is scopeNote URI)
      if (line.includes(SUBJECT_SCOPE_NOTE) && line.includes(P_RDF_VALUE)) {
        const obj = extractObject(line);
        if (obj && !obj.isUri) {
          const subj = extractSubject(line);
          if (subj) scopeNoteTexts.set(subj, obj.text);
        }
        continue;
      }

      // Quick filter: must contain a concept URI pattern
      if (!line.includes(CONCEPT_URI_START)) continue;

      const subj = extractSubject(line);
      if (!subj || !subj.includes("/aat/3")) continue;

      if (line.includes(P_RDF_TYPE) && line.includes(O_GVP_CONCEPT)) {
        getOrCreate(subj).ok = true;
      } else if (line.includes(P_SKOS_INS) && line.includes(O_AAT_SCHEME)) {
        getOrCreate(subj).ok = true;
      } else if (line.includes(P_RDFS_LABEL)) {
        const obj = extractObject(line);
        if (!obj || obj.isUri) continue;
        const langIdx = line.lastIndexOf("@");
        const lang =
          langIdx > 0 ? line.slice(langIdx + 1, line.lastIndexOf(" ")) : "";
        const rec = getOrCreate(subj);
        if (lang.startsWith("en") && !rec.en) {
          rec.en = obj.text;
        } else if (
          (lang.startsWith("zh-hant") || lang.startsWith("zh")) &&
          !rec.zh
        ) {
          rec.zh = obj.text;
        }
      } else if (line.includes(P_SKOS_SN)) {
        const obj = extractObject(line);
        if (obj && obj.isUri) getOrCreate(subj).sn.push(obj.text);
      } else if (line.includes(P_GVP_BP)) {
        const obj = extractObject(line);
        if (obj && obj.isUri) getOrCreate(subj).broader.push(obj.text);
      } else if (line.includes(P_SKOS_REL)) {
        const obj = extractObject(line);
        if (obj && obj.isUri) getOrCreate(subj).related.push(obj.text);
      }

      if (lineCount % 1_000_000 === 0) {
        console.log(`[sync-aat] ${lineCount} lines, ${concepts.size} concepts`);
        updateProgress({ done: lineCount });
      }
    }
  }
  closeSync(fd);

  // Merge scope notes into concepts
  for (const [, rec] of concepts) {
    for (const snUri of rec.sn) {
      const text = scopeNoteTexts.get(snUri);
      if (text) {
        rec.sn = [text];
        break;
      } // replace URIs with first found text
    }
  }

  console.log(
    `[sync-aat] Parse complete: ${lineCount} lines, ${concepts.size} concepts`,
  );
  return concepts;
}

function buildHierarchyPath(
  uri: string,
  concepts: Map<string, RawConcept>,
): string {
  const parts: string[] = [];
  const visited = new Set<string>();
  let current = uri;
  while (current && !visited.has(current)) {
    visited.add(current);
    const rec = concepts.get(current);
    if (!rec) break;
    const label = rec.en || rec.zh || "";
    if (label) parts.unshift(label);
    current = rec.broader[0] || "";
  }
  return parts.join(" > ");
}

function mapToDimension(path: string): string {
  const p = path.toLowerCase();
  if (p.includes("light")) return "lighting";
  if (p.includes("composit") || p.includes("perspective")) return "composition";
  if (p.includes("color")) return "color";
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

function resolveRelatedName(
  uri: string,
  concepts: Map<string, RawConcept>,
): string | null {
  const rec = concepts.get(uri);
  if (!rec) return null;
  return rec.en || rec.zh || null;
}

export async function syncAat(): Promise<{
  inserted: number;
  updated: number;
}> {
  if (!startSync("aat")) throw new Error("Sync already in progress");

  try {
    updateProgress({ stage: "downloading" });
    const zipPath = await downloadZip();

    updateProgress({ stage: "parsing", total: 27_000_000 });
    const ntPath = extractNt(zipPath);
    const allConcepts = parseNtFile(ntPath);

    // Filter to confirmed AAT concepts
    const confirmed: RawConcept[] = [];
    const confirmedUris: string[] = [];
    for (const [uri, c] of allConcepts) {
      if (c.ok && c.en) {
        confirmed.push(c);
        confirmedUris.push(uri);
      }
    }
    console.log(`[sync-aat] Confirmed AAT concepts: ${confirmed.length}`);

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

    for (let i = 0; i < confirmed.length; i++) {
      const c = confirmed[i];
      const uri = confirmedUris[i];
      const path = buildHierarchyPath(uri, allConcepts);
      const dim = mapToDimension(path);
      if (dim === "other") continue;

      // Scope note text (stored in sn[0] if found)
      const visualDescription =
        typeof c.sn[0] === "string" && !c.sn[0].startsWith("http")
          ? c.sn[0]
          : null;

      // Related concepts resolved to names
      const relatedNames: string[] = [];
      for (const relUri of c.related) {
        const name = resolveRelatedName(relUri, allConcepts);
        if (name && !relatedNames.includes(name)) relatedNames.push(name);
      }

      entries.push({
        name: c.en!,
        nameZh: c.zh,
        category: dim,
        subCategory: subCategory(path),
        visualDescription,
        tags: "[]",
        relatedConcepts: JSON.stringify(relatedNames),
      });
    }

    console.log(`[sync-aat] Mapped to dimensions: ${entries.length}`);

    updateProgress({ stage: "importing", total: entries.length, done: 0 });

    let inserted = 0;
    let updated = 0;
    const embTexts: string[] = [];
    const embNames: string[] = [];

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

      embTexts.push(`${e.visualDescription || ""} ${e.name} ${e.nameZh || ""}`);
      embNames.push(e.name);

      if (i % 200 === 0) updateProgress({ done: i + 1 });
    }

    const totalBatches = Math.ceil(embTexts.length / 20);
    const totalSteps = entries.length + totalBatches;
    updateProgress({
      stage: "embedding",
      total: totalSteps,
      done: entries.length,
    });

    if (embTexts.length > 0) {
      const B = 20;
      for (let i = 0; i < embTexts.length; i += B) {
        const batch = embTexts.slice(i, i + B);
        const names = embNames.slice(i, i + B);
        const embeddings = await generateEmbeddings(batch);
        for (let j = 0; j < embeddings.length; j++) {
          await db
            .update(artConcepts)
            .set({ embedding: JSON.stringify(embeddings[j]) })
            .where(eq(artConcepts.name, names[j]));
        }
        updateProgress({ done: entries.length + Math.floor(i / B) + 1 });
      }
    }

    finishSync();
    return { inserted, updated };
  } catch (e: any) {
    failSync(e.message);
    throw e;
  }
}
