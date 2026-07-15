import { serve } from "@hono/node-server";

import { initializeRuntime } from "./runtime-bootstrap.js";

await initializeRuntime(process.env, async (environment) => {
  const [
    { createApp },
    { createContentRepository },
    { createSettingsRepository },
    { permissionsForUser },
    { createAuthRuntime },
    { db },
    { createDatabaseReadinessCheck },
    { createDrizzleContentStore },
    { createPublicRepository },
  ] = await Promise.all([
    import("./app.js"),
    import("./admin/repositories/content-repository.js"),
    import("./admin/repositories/settings-repository.js"),
    import("./auth/permission-repository.js"),
    import("./auth/runtime.js"),
    import("./db/client.js"),
    import("./routes/health-ready.js"),
    import("./content/drizzle-content-store.js"),
    import("./content/public-repository.js"),
  ]);
  const { auth, handleAuthRequest } = createAuthRuntime(db, environment);
  const app = createApp({
    checkReadiness: createDatabaseReadinessCheck(db),
    getPermissions: (userId) => permissionsForUser(db, userId),
    getSession: (headers) => auth.api.getSession({ headers }),
    handleAuthRequest,
    contentRepository: createContentRepository(db),
    publicContentRepository: createPublicRepository(
      createDrizzleContentStore(db),
    ),
    settingsRepository: createSettingsRepository(db),
  });
  const server = serve(
    {
      fetch: app.fetch,
      port: environment.PORT,
    },
    (info) => {
      console.info(`AnShow API listening on http://localhost:${info.port}`);
    },
  );

  function shutdown(signal: NodeJS.Signals): void {
    console.info(`Received ${signal}; stopping AnShow API.`);
    server.close(() => {
      process.exitCode = 0;
    });
  }

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
});
