type AuthEnvironment = Readonly<
  Record<string, string | undefined>
>;

const DEVELOPMENT_SECRET = "development-only-secret-32-characters-minimum";

export function resolveBetterAuthSecret(
  environment: AuthEnvironment = process.env,
): string {
  const secret = environment.BETTER_AUTH_SECRET;
  if (secret) return secret;

  if (environment.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET is required in production");
  }

  return DEVELOPMENT_SECRET;
}
