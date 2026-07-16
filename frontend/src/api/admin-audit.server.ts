import "server-only";

import { headers } from "next/headers";

import type { AdminAuditEvent } from "@/components/admin/audit/audit-list";
import { getFrontendServerEnv } from "@/env";

export async function listAdminAuditEvents(): Promise<readonly AdminAuditEvent[]> {
  const requestHeaders = await headers();
  const response = await fetch(new URL("/api/admin/audit?page=1&pageSize=100", getFrontendServerEnv().BACKEND_INTERNAL_URL), {
    cache: "no-store",
    headers: { cookie: requestHeaders.get("cookie") ?? "" },
  });
  if (!response.ok) throw new Error(`审计日志加载失败（${response.status}）`);
  const payload = await response.json() as { data: { items: AdminAuditEvent[] } };
  return payload.data.items;
}
