import { initializeRuntime } from "../runtime-bootstrap.js";
import { processInquiryNotification } from "./notification-worker.js";

await initializeRuntime(process.env, async (environment) => {
  const [
    { db },
    { createInquiryRepository },
    { createMailer },
    { createSettingsRepository },
    { createRuntimeBackupManager },
    { runBackupScheduleTick },
    { createDrizzleContentStore },
    { createPublicRepository },
    { createPreviewService },
    { processDueScheduledSnapshots },
  ] = await Promise.all([
    import("../db/client.js"),
    import("../inquiries/repository.js"),
    import("./mailer.js"),
    import("../admin/repositories/settings-repository.js"),
    import("../backup/backup-runtime.js"),
    import("../backup/backup-scheduler.js"),
    import("../content/drizzle-content-store.js"),
    import("../content/public-repository.js"),
    import("../preview/preview-service.js"),
    import("../preview/scheduled-publish-worker.js"),
  ]);
  const keepAlive = setInterval(() => undefined, 60_000);
  const inquiryRepository = createInquiryRepository(db);
  const smtpConfigured = Boolean(
    environment.SMTP_HOST &&
      environment.SMTP_PORT &&
      environment.SMTP_USER &&
      environment.SMTP_PASSWORD &&
      environment.SMTP_FROM &&
      environment.SALES_EMAIL,
  );
  const mailer = smtpConfigured
    ? createMailer({
        host: environment.SMTP_HOST!,
        port: environment.SMTP_PORT!,
        user: environment.SMTP_USER!,
        password: environment.SMTP_PASSWORD!,
        from: environment.SMTP_FROM!,
      })
    : undefined;
  const workerId = `worker-${crypto.randomUUID()}`;
  let notificationRunning = false;
  const processNotifications = async () => {
    if (!mailer || !environment.SALES_EMAIL || notificationRunning) return;
    notificationRunning = true;
    try {
      while (
        (await processInquiryNotification(
          inquiryRepository,
          mailer,
          environment.SALES_EMAIL,
          workerId,
        )).processed
      ) {
        // Drain the due queue before waiting for the next poll.
      }
    } catch (error) {
      console.error("Inquiry notification worker failed", error);
    } finally {
      notificationRunning = false;
    }
  };
  const notificationTimer = mailer
    ? setInterval(() => void processNotifications(), 5_000)
    : undefined;
  void processNotifications();
  const backupManager = createRuntimeBackupManager({
    database: db,
    settingsRepository: createSettingsRepository(db, {
      encryptionConfigured: Boolean(environment.BACKUP_ENCRYPTION_KEY),
    }),
    environment,
  });
  const processBackups = () => runBackupScheduleTick(backupManager);
  const backupTimer = setInterval(() => void processBackups(), 5 * 60_000);
  void processBackups();
  const previewService = createPreviewService(
    db,
    createPublicRepository(createDrizzleContentStore(db, { includeDrafts: true })),
  );
  let publicationRunning = false;
  const processScheduledPublications = async () => {
    if (publicationRunning) return;
    publicationRunning = true;
    try {
      await processDueScheduledSnapshots(previewService, workerId);
    } catch (error) {
      console.error("Scheduled preview publication worker failed", error);
    } finally {
      publicationRunning = false;
    }
  };
  const publicationTimer = setInterval(() => void processScheduledPublications(), 5_000);
  void processScheduledPublications();

  function shutdown(signal: NodeJS.Signals): void {
    console.info(`Received ${signal}; stopping AnShow worker.`);
    clearInterval(keepAlive);
    if (notificationTimer) clearInterval(notificationTimer);
    clearInterval(backupTimer);
    clearInterval(publicationTimer);
    process.exitCode = 0;
  }

  console.info("AnShow worker is ready", {
    encryptedBackups: environment.BACKUP_ENCRYPTION_KEY ? "configured" : "not-configured",
    inquiryNotifications: notificationTimer ? "enabled" : "disabled",
    scheduledPreviewPublication: "enabled",
  });

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
});
