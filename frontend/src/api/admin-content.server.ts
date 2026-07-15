import "server-only";

import { headers } from "next/headers";

import { getFrontendServerEnv } from "../env";
import type {
  AdminContentCollection,
  AdminContentItem,
  AdminContentItems,
} from "./admin-content";
import { getEnvelope } from "./http";

type ServerReadOptions = { baseUrl?: string };

const segment = (value: string) => encodeURIComponent(value);

async function serverRead<T>(
  path: string,
  options: ServerReadOptions,
): Promise<T> {
  const requestHeaders = await headers();
  const baseUrl = options.baseUrl ?? getFrontendServerEnv().BACKEND_INTERNAL_URL;
  return getEnvelope<T>(new URL(path, baseUrl).toString(), {
    cache: "no-store",
    headers: { cookie: requestHeaders.get("cookie") ?? "" },
  });
}

export function listAdminContent(
  collection: AdminContentCollection,
  options: ServerReadOptions = {},
): Promise<AdminContentItems> {
  return serverRead<AdminContentItems>(
    `/api/admin/content/${segment(collection)}`,
    options,
  );
}

export function getAdminContent(
  collection: AdminContentCollection,
  id: string,
  options: ServerReadOptions = {},
): Promise<AdminContentItem> {
  return serverRead<AdminContentItem>(
    `/api/admin/content/${segment(collection)}/${segment(id)}`,
    options,
  );
}
