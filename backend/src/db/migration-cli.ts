export function formatMigrationFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `Database migration and initialization failed: ${message}`;
}
