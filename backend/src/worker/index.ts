import { initializeRuntime } from "../runtime-bootstrap.js";
import { createEncryptedBackup } from "../backup/backup-service.js";
import { processInquiryNotification } from "./notification-worker.js";

await initializeRuntime(process.env, async (environment) => {
  const [{ db }, { createInquiryRepository }, { createMailer }] = await Promise.all([
    import("../db/client.js"),
    import("../inquiries/repository.js"),
    import("./mailer.js"),
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
  const backupTimer = environment.BACKUP_ENCRYPTION_KEY
    ? setInterval(() => void createEncryptedBackup({ databasePath: environment.DATABASE_PATH, mediaDir: "/media", outputDir: environment.BACKUP_DIR ?? "data/backups", encryptionKey: environment.BACKUP_ENCRYPTION_KEY! }).catch((error) => console.error("Backup failed", error)), (environment.BACKUP_INTERVAL_HOURS ?? 24) * 3_600_000)
    : undefined;

  function shutdown(signal: NodeJS.Signals): void {
    console.info(`Received ${signal}; stopping AnShow worker.`);
    clearInterval(keepAlive);
    if (notificationTimer) clearInterval(notificationTimer);
    if (backupTimer) clearInterval(backupTimer);
    process.exitCode = 0;
  }

  console.info("AnShow worker is ready", {
    encryptedBackups: backupTimer ? "enabled" : "disabled",
    inquiryNotifications: notificationTimer ? "enabled" : "disabled",
  });

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
});
