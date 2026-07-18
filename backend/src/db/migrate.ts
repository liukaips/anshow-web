import { migrateAndInitializeDatabase } from "./migration-runner.js";

try {
  await migrateAndInitializeDatabase();
  console.info("Database migration and initialization complete.");
} catch {
  console.error("Database migration and initialization failed.");
  process.exitCode = 1;
}
