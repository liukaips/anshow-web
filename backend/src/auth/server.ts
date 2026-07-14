import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "../db/client.js";
import { resolveBetterAuthSecret } from "./config.js";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite" }),
  secret: resolveBetterAuthSecret(),
  baseURL: process.env.SITE_URL ?? "http://localhost:3000",
  basePath: "/api/auth",
  emailAndPassword: { enabled: true },
});
