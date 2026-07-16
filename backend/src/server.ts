import { serve } from "@hono/node-server";

import { initializeRuntime } from "./runtime-bootstrap.js";

await initializeRuntime(process.env, async (environment) => {
  const [
    { createApp },
    { createContentRepository },
    { createSettingsRepository },
    { createMediaRepository },
    { createMediaService },
    { createLocalMediaStorage },
    { createCosMediaStorage },
    { permissionsForUser },
    { createAuthRuntime },
    { db },
    { createDatabaseReadinessCheck },
    { createDrizzleContentStore },
    { createPublicRepository },
    { createStaffRepository },
    { createTranslationProvider },
    { createTranslationService },
    { createAuditQueryRepository },
    { createPreviewService },
  ] = await Promise.all([
    import("./app.js"),
    import("./admin/repositories/content-repository.js"),
    import("./admin/repositories/settings-repository.js"),
    import("./admin/repositories/media-repository.js"),
    import("./media/media-service.js"),
    import("./media/local-storage.js"),
    import("./media/cos-storage.js"),
    import("./auth/permission-repository.js"),
    import("./auth/runtime.js"),
    import("./db/client.js"),
    import("./routes/health-ready.js"),
    import("./content/drizzle-content-store.js"),
    import("./content/public-repository.js"),
    import("./admin/repositories/staff-repository.js"),
    import("./translation/translation-provider.js"),
    import("./translation/translation-service.js"),
    import("./admin/repositories/audit-query-repository.js"),
    import("./preview/preview-service.js"),
  ]);
  const { auth, handleAuthRequest } = createAuthRuntime(db, environment);
  const contentRepository = createContentRepository(db);
  const translationService = environment.TRANSLATION_API_URL && environment.TRANSLATION_API_KEY && environment.TRANSLATION_MODEL
    ? createTranslationService(
        db,
        contentRepository,
        createTranslationProvider({
          apiUrl: environment.TRANSLATION_API_URL,
          apiKey: environment.TRANSLATION_API_KEY,
          model: environment.TRANSLATION_MODEL,
        }),
      )
    : undefined;
  const previewService = createPreviewService(
    db,
    createPublicRepository(createDrizzleContentStore(db, { includeDrafts: true })),
  );
  const app = createApp({
    checkReadiness: createDatabaseReadinessCheck(db),
    getPermissions: (userId) => permissionsForUser(db, userId),
    getSession: (headers) => auth.api.getSession({ headers }),
    handleAuthRequest,
    contentRepository,
    ...(translationService ? { translationService } : {}),
    auditRepository: createAuditQueryRepository(db),
    previewService,
    publicContentRepository: createPublicRepository(
      createDrizzleContentStore(db),
    ),
    settingsRepository: createSettingsRepository(db),
    mediaService: createMediaService({
      repository: createMediaRepository(db),
      storage:
        environment.MEDIA_DRIVER === "cos"
          ? createCosMediaStorage({
              bucket: environment.COS_BUCKET!,
              region: environment.COS_REGION!,
              publicBaseUrl: environment.COS_PUBLIC_BASE_URL!,
              secretId: environment.COS_SECRET_ID!,
              secretKey: environment.COS_SECRET_KEY!,
            })
          : createLocalMediaStorage(),
    }),
    staffRepository: createStaffRepository(db),
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
