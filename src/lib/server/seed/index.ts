import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../db/schema";
import { seedKnowledge } from "./knowledge";
import { seedStyles } from "./styles";

const sqlite = new Database("./ladymuse.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite, { schema });

async function main() {
  console.log("Seeding knowledge base...");
  await seedKnowledge(db);

  console.log("Seeding styles...");
  await seedStyles(db);

  console.log("Done!");
  sqlite.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
