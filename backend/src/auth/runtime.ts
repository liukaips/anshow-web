import { db } from "../db/client.js";
import { resolveBetterAuthSecret } from "./config.js";
import { createAuth, createAuthHandler } from "./server.js";

export const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

export const auth = createAuth(db, {
  production: process.env.NODE_ENV === "production",
  secret: resolveBetterAuthSecret(),
  siteUrl,
});

export const handleAuthRequest = createAuthHandler(auth, siteUrl);
