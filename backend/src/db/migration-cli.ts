const FAILURE_PREFIX = "Database migration and initialization failed: ";
const NON_ERROR_PLACEHOLDER = "[non-Error thrown value]";

function safeThrownValue(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
    const name = error.name;
    return typeof name === "string" && name.length > 0 ? name : "Error";
  }

  if (error === null) return "null";

  switch (typeof error) {
    case "string":
      return error;
    case "number":
      return Number.isFinite(error) ? String(error) : NON_ERROR_PLACEHOLDER;
    case "boolean":
    case "bigint":
      return String(error);
    case "undefined":
      return "undefined";
    default:
      return NON_ERROR_PLACEHOLDER;
  }
}

export function formatMigrationFailure(error: unknown): string {
  try {
    return `${FAILURE_PREFIX}${safeThrownValue(error)}`;
  } catch {
    return `${FAILURE_PREFIX}${NON_ERROR_PLACEHOLDER}`;
  }
}
