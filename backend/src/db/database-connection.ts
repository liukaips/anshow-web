import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema/index.js";

type ConfigurableDatabaseConnection = {
  pragma: (source: string) => unknown;
  close: () => void;
};

export function configureOpenedDatabase<T extends ConfigurableDatabaseConnection>(
  sqlite: T,
): T {
  try {
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("busy_timeout = 5000");
    return sqlite;
  } catch (error) {
    try {
      sqlite.close();
    } catch {
      // Preserve the configuration failure as the actionable root cause.
    }
    throw error;
  }
}

export function openDatabaseAtPath(databasePath: string) {
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const sqlite = configureOpenedDatabase(new Database(databasePath));

  return { sqlite, db: drizzle(sqlite, { schema }) };
}
