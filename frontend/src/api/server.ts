import { headers } from "next/headers";

import type { components } from "@/generated/api";

export type AdminSession = components["schemas"]["AdminSessionData"];

export async function getAdminSession(): Promise<AdminSession | null> {
  const requestHeaders = await headers();
  const backendUrl =
    process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000";
  const response = await fetch(new URL("/api/admin/session", backendUrl), {
    headers: { cookie: requestHeaders.get("cookie") ?? "" },
    cache: "no-store",
  });

  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`Session API failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    data: AdminSession;
  };
  return payload.data;
}
