import { headers } from "next/headers";

import type { components } from "@/generated/api";

import { getFrontendServerEnv } from "../env";

export type AdminSession = components["schemas"]["AdminSessionData"];

export async function getAdminSession(): Promise<AdminSession | null> {
  const requestHeaders = await headers();
  const { BACKEND_INTERNAL_URL } = getFrontendServerEnv();
  const response = await fetch(new URL("/api/admin/session", BACKEND_INTERNAL_URL), {
    headers: { cookie: requestHeaders.get("cookie") ?? "" },
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) {
    throw new Error(`Session API failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    data: AdminSession;
  };
  return payload.data;
}
