import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import * as sqliteVec from "sqlite-vec";
import path from "path";

const dbPath = path.resolve(process.cwd(), "ladymuse.db");

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Load sqlite-vec extension
sqliteVec.load(sqlite);

// Ensure vec0 tables have correct schema (with id column — was missing in v1)
const vecVersion = sqlite
  .prepare("SELECT value FROM user_config WHERE key = ?")
  .get("vec_schema_version") as { value: string } | undefined;

if (vecVersion?.value !== "2") {
  sqlite.exec(`DROP TABLE IF EXISTS vec_concepts`);
  sqlite.exec(`DROP TABLE IF EXISTS vec_patterns`);
  sqlite.exec(`DROP TABLE IF EXISTS vec_references`);

  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_concepts USING vec0(
      id TEXT,
      embedding float[1536]
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS vec_patterns USING vec0(
      id TEXT,
      embedding float[1536]
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS vec_references USING vec0(
      id TEXT,
      embedding float[1536]
    );
  `);

  sqlite
    .prepare("INSERT OR REPLACE INTO user_config (key, value) VALUES (?, ?)")
    .run("vec_schema_version", "2");
}

// Ensure vec_danbooru exists (new table, not part of version migration)
sqlite.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS vec_danbooru USING vec0(
    id TEXT,
    embedding float[1536]
  );
`);

// Migrate JSON embeddings from art_concepts into vec_concepts (one-time, idempotent)
migrateEmbeddingsToVec0();

export const db = drizzle(sqlite, { schema });
export { sqlite };
export type DB = typeof db;

function migrateEmbeddingsToVec0() {
  const done = sqlite
    .prepare("SELECT value FROM user_config WHERE key = ?")
    .get("vec_migration_done") as { value: string } | undefined;

  if (done?.value === "1") return;

  const rows = sqlite
    .prepare(
      "SELECT name, embedding FROM art_concepts WHERE embedding IS NOT NULL",
    )
    .all() as { name: string; embedding: string }[];

  if (rows.length === 0) {
    sqlite
      .prepare("INSERT OR REPLACE INTO user_config (key, value) VALUES (?, ?)")
      .run("vec_migration_done", "1");
    return;
  }

  console.log(
    `[vec migration] migrating ${rows.length} embeddings to vec_concepts...`,
  );

  const insert = sqlite.prepare(
    "INSERT OR REPLACE INTO vec_concepts (id, embedding) VALUES (?, ?)",
  );

  let failed = 0;

  const tx = sqlite.transaction(() => {
    for (const r of rows) {
      try {
        const arr = JSON.parse(r.embedding) as number[];
        const vec = new Float32Array(arr);
        const blob = Buffer.from(vec.buffer);
        insert.run(r.name, blob);
      } catch (e) {
        console.error(
          `[vec migration] failed to migrate "${r.name}":`,
          (e as Error).message,
        );
        failed++;
      }
    }
  });

  tx();

  sqlite
    .prepare("INSERT OR REPLACE INTO user_config (key, value) VALUES (?, ?)")
    .run("vec_migration_done", "1");

  console.log(
    `[vec migration] done — ${rows.length - failed} migrated` +
      (failed > 0 ? `, ${failed} failed (see errors above)` : ""),
  );
}
