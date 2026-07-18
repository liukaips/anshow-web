import { openDatabaseAtPath } from "./database-connection.js";

export { openDatabaseAtPath } from "./database-connection.js";

const databasePath = process.env.DATABASE_PATH ?? "data/anshow.db";

export const { db, sqlite } = openDatabaseAtPath(databasePath);
export type AppDatabase = typeof db;
