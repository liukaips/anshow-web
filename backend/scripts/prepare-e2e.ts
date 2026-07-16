import { eq } from "drizzle-orm";

import { initializeRuntime } from "../src/runtime-bootstrap.js";

await initializeRuntime(process.env, async () => {
  const [
    { db, sqlite },
    { migrate },
    { provisionAdministrator },
    { seedRbac },
    { seedPublicContent },
    { user },
  ] = await Promise.all([
    import("../src/db/client.js"),
    import("drizzle-orm/better-sqlite3/migrator"),
    import("../src/auth/provision-administrator.js"),
    import("../src/auth/seed-rbac.js"),
    import("../src/content/seed.js"),
    import("../src/db/schema/auth.js"),
  ]);

  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required for E2E setup.",
    );
  }

  try {
    migrate(db, {
      migrationsFolder: new URL("../migrations", import.meta.url).pathname,
    });
    seedRbac(db);
    seedPublicContent(db);

    // Keep reruns deterministic when an explicit E2E_DATABASE_PATH is reused.
    db.delete(user).where(eq(user.email, email.trim().toLowerCase())).run();
    await provisionAdministrator(db, {
      email,
      name: "E2E Administrator",
      password,
    });
  } finally {
    sqlite.close();
  }
});
