import "server-only";

import { headers } from "next/headers";

import { getFrontendServerEnv } from "../env";
import type { AdminBackupRun } from "./admin-backups";

export async function getAdminBackups(): Promise<AdminBackupRun[]> {
  const requestHeaders = await headers();
  const response = await fetch(
    new URL(
      "/api/admin/backups?limit=50",
      getFrontendServerEnv().BACKEND_INTERNAL_URL,
    ),
    {
      cache: "no-store",
      headers: { cookie: requestHeaders.get("cookie") ?? "" },
    },
  );
  if (!response.ok) {
    throw new Error(`Backup API failed (${response.status})`);
  }
  return ((await response.json()) as { data: AdminBackupRun[] }).data;
}
