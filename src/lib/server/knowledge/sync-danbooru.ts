import { db, sqlite } from "../db";
import {
  danbooruTags,
  danbooruTagAliases,
  danbooruTagImplications,
} from "../db/schema";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { startSync, updateProgress, finishSync, failSync } from "./sync-status";

const DATA_DIR = "data/danbooru";

function findFiles(prefix: string): string[] {
  const dir = join(process.cwd(), DATA_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.includes(prefix) && f.endsWith(".json"))
    .map((f) => join(dir, f));
}

function readJsonLines<T>(files: string[]): T[] {
  const results: T[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf-8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed) results.push(JSON.parse(trimmed) as T);
    }
  }
  return results;
}

interface TagRow {
  name: string;
  post_count: string | number;
}
interface WikiRow {
  title: string;
  body: string;
  other_names?: string;
  updated_at?: string;
}
interface AliasRow {
  antecedent_name: string;
  consequent_name: string;
}
interface ImplicationRow {
  antecedent_name: string;
  consequent_name: string;
}

export async function importDanbooru() {
  if (!startSync("embedding")) throw new Error("Import already in progress");

  try {
    // --- Tags ---
    const tagsFiles = findFiles("tags");
    if (tagsFiles.length === 0)
      throw new Error("No tags JSONL found in data/danbooru/");

    updateProgress({ stage: "parsing", total: 0, done: 0 });
    const tags = new Map<string, number>();
    for (const r of readJsonLines<TagRow>(tagsFiles)) {
      tags.set(r.name, Number(r.post_count) || 0);
    }
    console.log(`[danbooru] Loaded ${tags.size} tags`);

    // --- Wiki pages ---
    const wikiFiles = findFiles("wiki");
    if (wikiFiles.length === 0)
      throw new Error("No wiki_pages JSONL found in data/danbooru/");

    const wikis = readJsonLines<WikiRow>(wikiFiles);
    console.log(`[danbooru] Loaded ${wikis.length} wiki pages`);

    // --- Join & upsert ---
    updateProgress({ stage: "importing", total: wikis.length, done: 0 });
    let inserted = 0;

    // Use ON CONFLICT to preserve embedding and id on re-import
    const upsertStmt = sqlite.prepare(
      `INSERT INTO danbooru_tags (name, post_count, body, other_names, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET
         post_count = excluded.post_count,
         body = excluded.body,
         other_names = excluded.other_names,
         updated_at = excluded.updated_at`,
    );
    const now = new Date().toISOString();

    for (const wiki of wikis) {
      if (!tags.has(wiki.title)) continue;
      upsertStmt.run(
        wiki.title,
        tags.get(wiki.title) ?? 0,
        wiki.body,
        typeof wiki.other_names === "string"
          ? wiki.other_names
          : JSON.stringify(wiki.other_names),
        now,
        wiki.updated_at || now,
      );
      inserted++;
      if (inserted % 5000 === 0) {
        console.log(`[danbooru] ${inserted} / ~50000`);
        updateProgress({ done: inserted });
      }
    }

    console.log(`[danbooru] Upserted ${inserted} tags into danbooru_tags`);
    updateProgress({ done: inserted });

    // --- Aliases ---
    const aliasFiles = findFiles("alias");
    if (aliasFiles.length > 0) {
      const aliases = readJsonLines<AliasRow>(aliasFiles);
      sqlite.exec("DELETE FROM danbooru_tag_aliases");
      const aliasStmt = sqlite.prepare(
        "INSERT INTO danbooru_tag_aliases (antecedent_name, consequent_name) VALUES (?, ?)",
      );
      const aliasTx = sqlite.transaction(() => {
        for (const a of aliases) {
          aliasStmt.run(a.antecedent_name, a.consequent_name);
        }
      });
      aliasTx();
      console.log(`[danbooru] Loaded ${aliases.length} aliases`);
    }

    // --- Implications ---
    const implFiles = findFiles("implication");
    if (implFiles.length > 0) {
      const imps = readJsonLines<ImplicationRow>(implFiles);
      sqlite.exec("DELETE FROM danbooru_tag_implications");
      const implStmt = sqlite.prepare(
        "INSERT INTO danbooru_tag_implications (antecedent_name, consequent_name) VALUES (?, ?)",
      );
      const implTx = sqlite.transaction(() => {
        for (const i of imps) {
          implStmt.run(i.antecedent_name, i.consequent_name);
        }
      });
      implTx();
      console.log(`[danbooru] Loaded ${imps.length} implications`);
    }

    updateProgress({ done: wikis.length });
    finishSync();

    console.log(`[danbooru] Import complete: ${inserted} tags`);
    return { total: inserted };
  } catch (e: any) {
    failSync(e.message);
    throw e;
  }
}
