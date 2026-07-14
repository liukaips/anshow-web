import type { AppDatabase } from "../db/client.js";
import type { RuntimeEnv } from "../env.js";
import { createAuth, createAuthHandler } from "./server.js";

export function createAuthRuntime(database: AppDatabase, environment: RuntimeEnv) {
  const auth = createAuth(database, {
    production: environment.NODE_ENV === "production",
    secret: environment.BETTER_AUTH_SECRET,
    siteUrl: environment.SITE_URL,
  });

  return {
    auth,
    handleAuthRequest: createAuthHandler(auth, environment.SITE_URL),
  };
}
