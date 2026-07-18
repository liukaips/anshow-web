import { formatMigrationFailure } from "./migration-cli.js";
import { migrateAndInitializeDatabase } from "./migration-runner.js";

try {
  await migrateAndInitializeDatabase();
  console.info("Database migration and initialization complete.");
} catch (error) {
  console.error(formatMigrationFailure(error));
  process.exitCode = 1;
}
