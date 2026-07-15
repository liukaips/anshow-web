import "server-only";

import { headers } from "next/headers";

import { getFrontendServerEnv } from "../env";
import type { AdminMediaAsset } from "./admin-media";
import { getEnvelope } from "./http";

type ServerReadOptions = { baseUrl?: string };

export async function listAdminMedia(
  options: ServerReadOptions = {},
): Promise<AdminMediaAsset[]> {
  const requestHeaders = await headers();
  const baseUrl = options.baseUrl ?? getFrontendServerEnv().BACKEND_INTERNAL_URL;
  return getEnvelope<AdminMediaAsset[]>(
    new URL("/api/admin/media", baseUrl).toString(),
    {
      cache: "no-store",
      headers: { cookie: requestHeaders.get("cookie") ?? "" },
    },
  );
}
