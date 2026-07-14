import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { db, sqlite } from "./client.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../../migrations");

try {
  migrate(db, { migrationsFolder });
  console.info(`Applied database migrations from ${migrationsFolder}`);
} finally {
  sqlite.close();
}
