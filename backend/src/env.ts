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

    if (environment.SITE_HOST !== siteUrl.hostname) {
      context.addIssue({
        code: "custom",
        message: "SITE_HOST must match the SITE_URL hostname",
        path: ["SITE_HOST"],
      });
    }
  });

export type RuntimeEnv = z.infer<typeof RuntimeEnvSchema>;

export function parseEnv(
  environment: Readonly<Record<string, string | undefined>>,
): RuntimeEnv {
  return RuntimeEnvSchema.parse(environment);
}
