import { parseEnv, type RuntimeEnv } from "./env.js";

export async function initializeRuntime<T>(
  environment: Readonly<Record<string, string | undefined>>,
  loadRuntime: (environment: RuntimeEnv) => T | Promise<T>,
): Promise<T> {
  const validatedEnvironment = parseEnv(environment);
  return loadRuntime(validatedEnvironment);
}
