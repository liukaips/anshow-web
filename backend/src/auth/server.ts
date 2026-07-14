import * as argon2 from "argon2";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import type { AppDatabase } from "../db/client.js";

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
      password: {
        hash: (password) =>
          argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 19_456,
            timeCost: 2,
            parallelism: 1,
          }),
        verify: ({ hash, password }) => argon2.verify(hash, password),
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
