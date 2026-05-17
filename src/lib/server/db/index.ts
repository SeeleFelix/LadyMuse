import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import * as sqliteVec from "sqlite-vec";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../../../../ladymuse.db");

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Load sqlite-vec extension
sqliteVec.load(sqlite);

// Ensure vec0 virtual table exists for concept embeddings
sqlite.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS vec_concepts USING vec0(
    embedding float[1536]
  );
`);

export const db = drizzle(sqlite, { schema });
export { sqlite };
export type DB = typeof db;
