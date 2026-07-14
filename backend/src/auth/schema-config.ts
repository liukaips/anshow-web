import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/better-sqlite3";

const sqlite = new Database(":memory:");
const db = drizzle(sqlite);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite" }),
  secret: "schema-generation-only-secret-32-characters",
  baseURL: "http://localhost:3000",
  basePath: "/api/auth",
  emailAndPassword: { enabled: true },
});
