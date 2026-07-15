import "server-only";
import { headers } from "next/headers";
import { getFrontendServerEnv } from "../env";

export type BackupSettings = {
  enabled: boolean;
  intervalHours: number;
  retentionDays: number;
  target: "local" | "cos";
  cosBucket: string;
  cosRegion: string;
  encryptionConfigured: boolean;
};

export type AdminSettings = { backup?: BackupSettings } & Record<string, unknown>;

export async function getAdminSettings(): Promise<AdminSettings> {
  const requestHeaders = await headers();
  const response = await fetch(new URL("/api/admin/settings", getFrontendServerEnv().BACKEND_INTERNAL_URL), {
    cache: "no-store",
    headers: { cookie: requestHeaders.get("cookie") ?? "" },
  });
  if (!response.ok) throw new Error(`Settings API failed (${response.status})`);
  return ((await response.json()) as { data: AdminSettings }).data;
}
