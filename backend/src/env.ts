import { z } from "zod";

const RuntimeEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    SITE_URL: z.url(),
    SITE_HOST: z.string().trim().min(1),
    DATABASE_PATH: z.string().trim().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    RATE_LIMIT_SECRET: z.string().min(32),
    MEDIA_DRIVER: z.enum(["local", "cos"]).default("local"),
    COS_BUCKET: z.string().trim().min(1).optional(),
    COS_REGION: z.string().trim().min(1).optional(),
    COS_PUBLIC_BASE_URL: z.url().optional(),
    COS_SECRET_ID: z.string().min(1).optional(),
    COS_SECRET_KEY: z.string().min(1).optional(),
    BACKUP_DIR: z.string().trim().min(1).optional(),
    BACKUP_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/).optional(),
    BACKUP_INTERVAL_HOURS: z.coerce.number().int().min(1).max(168).optional(),
    SMTP_HOST: z.string().trim().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).optional(),
    SMTP_USER: z.string().trim().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    SMTP_FROM: z.string().email().optional(),
    SALES_EMAIL: z.string().email().optional(),
    TRANSLATION_API_URL: z.url().optional(),
    TRANSLATION_API_KEY: z.string().min(1).optional(),
    TRANSLATION_MODEL: z.string().trim().min(1).optional(),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  })
  .superRefine((environment, context) => {
    const siteUrl = new URL(environment.SITE_URL);

    if (environment.NODE_ENV === "production" && siteUrl.protocol !== "https:") {
      context.addIssue({
        code: "custom",
        message: "SITE_URL must use HTTPS in production",
        path: ["SITE_URL"],
      });
    }

    if (
      environment.NODE_ENV === "production" &&
      (siteUrl.username !== "" ||
        siteUrl.password !== "" ||
        siteUrl.pathname !== "/" ||
        environment.SITE_URL.includes("?") ||
        environment.SITE_URL.includes("#") ||
        siteUrl.port !== "")
    ) {
      context.addIssue({
        code: "custom",
        message: "SITE_URL must be a clean production origin",
        path: ["SITE_URL"],
      });
    }

    if (environment.SITE_HOST !== siteUrl.hostname) {
      context.addIssue({
        code: "custom",
        message: "SITE_HOST must match the SITE_URL hostname",
        path: ["SITE_HOST"],
      });
    }

    if (environment.MEDIA_DRIVER === "cos") {
      for (const key of ["COS_BUCKET", "COS_REGION", "COS_PUBLIC_BASE_URL", "COS_SECRET_ID", "COS_SECRET_KEY"] as const) {
        if (!environment[key]) {
          context.addIssue({ code: "custom", message: `${key} is required when MEDIA_DRIVER=cos`, path: [key] });
        }
      }
    }

    const translationKeys = [
      "TRANSLATION_API_URL",
      "TRANSLATION_API_KEY",
      "TRANSLATION_MODEL",
    ] as const;
    if (translationKeys.some((key) => environment[key])) {
      for (const key of translationKeys) {
        if (!environment[key]) {
          context.addIssue({
            code: "custom",
            message: `${key} is required when translation is configured`,
            path: [key],
          });
        }
      }
    }

    const smtpKeys = [
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_PASSWORD",
      "SMTP_FROM",
      "SALES_EMAIL",
    ] as const;
    if (smtpKeys.some((key) => environment[key] !== undefined)) {
      for (const key of smtpKeys) {
        if (environment[key] === undefined) {
          context.addIssue({
            code: "custom",
            message: `${key} is required when SMTP notifications are configured`,
            path: [key],
          });
        }
      }
    }
  });

export type RuntimeEnv = z.infer<typeof RuntimeEnvSchema>;

export function parseEnv(
  environment: Readonly<Record<string, string | undefined>>,
): RuntimeEnv {
  const normalized = Object.fromEntries(
    Object.entries(environment).map(([key, value]) => [
      key,
      typeof value === "string" && value.trim() === "" ? undefined : value,
    ]),
  );
  return RuntimeEnvSchema.parse(normalized);
}
