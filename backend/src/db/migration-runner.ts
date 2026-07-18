import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import {
  seedPublicContent,
  type ContentSeeder,
  type SeedResult,
} from "../content/seed.js";
import { initializeRuntime } from "../runtime-bootstrap.js";
import type { RuntimeEnv } from "../env.js";
import type { AppDatabase } from "./client.js";
import { openDatabaseAtPath } from "./database-connection.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const defaultMigrationsFolder = resolve(currentDirectory, "../../migrations");

export type OpenedApplicationDatabase = {
  db: AppDatabase;
  close: () => void;
};

export type MigrationInitializationSummary = Pick<
  SeedResult,
  "inserted" | "upgraded" | "archived"
> & {
  preserved: number;
};

export type MigrateAndInitializeDatabaseOptions = {
  environment?: Readonly<Record<string, string | undefined>>;
  migrationsFolder?: string;
  openDatabase?: (
    environment: RuntimeEnv,
  ) => OpenedApplicationDatabase | Promise<OpenedApplicationDatabase>;
  migrate?: (database: AppDatabase, options: { migrationsFolder: string }) => void;
  seed?: ContentSeeder;
  log?: (summary: MigrationInitializationSummary) => void;
};

function openApplicationDatabase(
  environment: RuntimeEnv,
): OpenedApplicationDatabase {
  const { db, sqlite } = openDatabaseAtPath(environment.DATABASE_PATH);
  return { db, close: () => sqlite.close() };
}

function logInitializationSummary(summary: MigrationInitializationSummary) {
  console.info(
    `Database content initialized (inserted=${summary.inserted}, upgraded=${summary.upgraded}, archived=${summary.archived}, preserved=${summary.preserved}).`,
  );
}

export async function migrateAndInitializeDatabase(
  options: MigrateAndInitializeDatabaseOptions = {},
): Promise<{ seed: SeedResult }> {
  const runMigrations = options.migrate ?? migrate;
  const seed = options.seed ?? seedPublicContent;
  const openDatabase = options.openDatabase ?? openApplicationDatabase;
  const migrationsFolder = options.migrationsFolder ?? defaultMigrationsFolder;

  return initializeRuntime(options.environment ?? process.env, async (environment) => {
    const opened = await openDatabase(environment);

    try {
      runMigrations(opened.db, { migrationsFolder });
      const seedResult = seed(opened.db);
      const summary = {
        inserted: seedResult.inserted,
        upgraded: seedResult.upgraded,
        archived: seedResult.archived,
        preserved: seedResult.preserved.length,
      };
      (options.log ?? logInitializationSummary)(summary);
      return { seed: seedResult };
    } finally {
      opened.close();
    }
  });
}
