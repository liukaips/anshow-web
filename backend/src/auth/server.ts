import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "../db/client.js";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite" }),
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "development-only-secret-32-characters-minimum",
  baseURL: process.env.SITE_URL ?? "http://localhost:3000",
  basePath: "/api/auth",
  emailAndPassword: { enabled: true },
});
