import "server-only";

import { headers } from "next/headers";

import { getFrontendServerEnv } from "@/env";
import type { components } from "@/generated/api";

export type AdminDashboardData = components["schemas"]["AdminDashboard"];

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const requestHeaders = await headers();
  const response = await fetch(
    new URL("/api/admin/dashboard", getFrontendServerEnv().BACKEND_INTERNAL_URL),
    {
      cache: "no-store",
      headers: { cookie: requestHeaders.get("cookie") ?? "" },
    },
  );
  if (!response.ok) throw new Error(`工作台加载失败（${response.status}）`);
  const payload = (await response.json()) as { data: AdminDashboardData };
  return payload.data;
}
