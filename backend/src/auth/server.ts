import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import type { AppDatabase } from "../db/client.js";
import {
  hashCredentialPassword,
  verifyCredentialPassword,
} from "./credential-password.js";

export type AuthRuntimeOptions = Readonly<{
  production: boolean;
  secret: string;
  siteUrl: string;
}>;

export function createAuth(
  database: AppDatabase,
  options: AuthRuntimeOptions,
) {
  return betterAuth({
    database: drizzleAdapter(database, { provider: "sqlite" }),
    secret: options.secret,
    baseURL: options.siteUrl,
    basePath: "/api/auth",
    trustedOrigins: [options.siteUrl],
    advanced: {
      disableOriginCheck: false,
      useSecureCookies: options.production,
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      password: {
        hash: hashCredentialPassword,
        verify: verifyCredentialPassword,
      },
    },
    session: {
      expiresIn: 60 * 60 * 8,
      updateAge: 60 * 30,
    },
  });
}

export function createAuthHandler(
  auth: ReturnType<typeof createAuth>,
  siteUrl: string,
) {
  const trustedOrigin = new URL(siteUrl).origin;

  return (request: Request) => {
    if (!["GET", "HEAD"].includes(request.method)) {
      const requestOrigin = request.headers.get("origin");
      if (requestOrigin !== trustedOrigin) {
        return Promise.resolve(
          Response.json(
            { code: "UNTRUSTED_ORIGIN", message: "Origin is not allowed" },
            { status: 403 },
          ),
        );
      }
    }

    return auth.handler(request);
  };
}
