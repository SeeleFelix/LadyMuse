import { db } from "../db";
import {
  danbooruTags,
  danbooruTagAliases,
  danbooruTagImplications,
} from "../db/schema";
import { eq } from "drizzle-orm";
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
    let updated = 0;

    for (const wiki of wikis) {
      if (!tags.has(wiki.title)) continue;

      const existing = await db
        .select({ name: danbooruTags.name })
        .from(danbooruTags)
        .where(eq(danbooruTags.name, wiki.title));

      const data = {
        postCount: tags.get(wiki.title) ?? 0,
        body: wiki.body,
        otherNames: wiki.other_names || null,
        updatedAt: wiki.updated_at || new Date().toISOString(),
      };

      if (existing.length > 0) {
        await db
          .update(danbooruTags)
          .set(data)
          .where(eq(danbooruTags.name, wiki.title));
        updated++;
      } else {
        await db.insert(danbooruTags).values({
          name: wiki.title,
          ...data,
          createdAt: new Date().toISOString(),
        });
        inserted++;
      }

      if ((inserted + updated) % 1000 === 0) {
        updateProgress({ done: inserted + updated });
      }
    }

    // --- Aliases ---
    const aliasFiles = findFiles("alias");
    if (aliasFiles.length > 0) {
      const aliases = readJsonLines<AliasRow>(aliasFiles);
      await db.delete(danbooruTagAliases);
      for (const a of aliases) {
        await db.insert(danbooruTagAliases).values({
          antecedentName: a.antecedent_name,
          consequentName: a.consequent_name,
        });
      }
      console.log(`[danbooru] Loaded ${aliases.length} aliases`);
    }

    // --- Implications ---
    const implFiles = findFiles("implication");
    if (implFiles.length > 0) {
      const imps = readJsonLines<ImplicationRow>(implFiles);
      await db.delete(danbooruTagImplications);
      for (const i of imps) {
        await db.insert(danbooruTagImplications).values({
          antecedentName: i.antecedent_name,
          consequentName: i.consequent_name,
        });
      }
      console.log(`[danbooru] Loaded ${imps.length} implications`);
    }

    updateProgress({ done: wikis.length });
    finishSync();

    console.log(
      `[danbooru] Import complete: ${inserted} inserted, ${updated} updated`,
    );
    return { inserted, updated, total: inserted + updated };
  } catch (e: any) {
    failSync(e.message);
    throw e;
  }
}
