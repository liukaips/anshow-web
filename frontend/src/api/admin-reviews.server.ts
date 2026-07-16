import "server-only";

import { headers } from "next/headers";
import { getFrontendServerEnv } from "../env";
import type { AdminReview } from "./admin-reviews";
import { getEnvelope } from "./http";

export async function listAdminReviews(): Promise<readonly AdminReview[]> {
  const requestHeaders = await headers();
  return getEnvelope<AdminReview[]>(new URL("/api/admin/reviews/queue?decision=pending", getFrontendServerEnv().BACKEND_INTERNAL_URL).toString(), { cache: "no-store", headers: { cookie: requestHeaders.get("cookie") ?? "" } });
}
