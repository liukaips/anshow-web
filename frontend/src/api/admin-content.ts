import type { paths } from "../generated/api";

import { getEnvelope } from "./http";

type ListOperation = paths["/api/admin/content/{collection}"]["get"];
type CreateOperation = paths["/api/admin/content/{collection}"]["post"];
type DetailOperation = paths["/api/admin/content/{collection}/{id}"]["get"];
type DraftOperation = paths["/api/admin/content/{collection}/{id}/translations/{locale}"]["put"];
type ScheduleOperation = paths["/api/admin/content/{collection}/{id}/translations/{locale}/schedule"]["post"];

export type AdminContentCollection =
  ListOperation["parameters"]["path"]["collection"];
export type AdminContentLocale =
  DraftOperation["parameters"]["path"]["locale"];
export type AdminContentItem = NonNullable<
  DetailOperation["responses"][200]["content"]["application/json"]["data"]
>;
export type AdminContentItems = NonNullable<
  ListOperation["responses"][200]["content"]["application/json"]["data"]
>;
export type CreateAdminContentInput =
  CreateOperation["requestBody"]["content"]["application/json"];
export type AdminContentTranslationInput =
  DraftOperation["requestBody"]["content"]["application/json"];
export type ScheduleAdminContentInput =
  ScheduleOperation["requestBody"]["content"]["application/json"];

export const ADMIN_CONTENT_COLLECTIONS = [
  "pages",
  "hero-slides",
  "services",
  "trade-lanes",
  "cargo-types",
  "case-studies",
  "articles",
  "partners",
  "certificates",
  "proof-metrics",
  "navigation-items",
] as const satisfies readonly AdminContentCollection[];

export function isAdminContentCollection(
  value: string,
): value is AdminContentCollection {
  return (ADMIN_CONTENT_COLLECTIONS as readonly string[]).includes(value);
}

const segment = (value: string) => encodeURIComponent(value);

function commandInit(method: "POST" | "PUT", body?: unknown): RequestInit {
  return {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

export function createAdminContent(
  collection: AdminContentCollection,
  input: CreateAdminContentInput,
): Promise<AdminContentItem> {
  return getEnvelope<AdminContentItem>(
    `/api/admin/content/${segment(collection)}`,
    commandInit("POST", input),
  );
}

export function saveAdminContentDraft(
  collection: AdminContentCollection,
  id: string,
  locale: AdminContentLocale,
  input: AdminContentTranslationInput,
): Promise<AdminContentItem> {
  return getEnvelope<AdminContentItem>(
    `/api/admin/content/${segment(collection)}/${segment(id)}/translations/${segment(locale)}`,
    commandInit("PUT", input),
  );
}

export function publishAdminContentTranslation(
  collection: AdminContentCollection,
  id: string,
  locale: AdminContentLocale,
): Promise<AdminContentItem> {
  return getEnvelope<AdminContentItem>(
    `/api/admin/content/${segment(collection)}/${segment(id)}/translations/${segment(locale)}/publish`,
    commandInit("POST"),
  );
}

export function scheduleAdminContentTranslation(
  collection: AdminContentCollection,
  id: string,
  locale: AdminContentLocale,
  input: ScheduleAdminContentInput,
): Promise<AdminContentItem> {
  return getEnvelope<AdminContentItem>(
    `/api/admin/content/${segment(collection)}/${segment(id)}/translations/${segment(locale)}/schedule`,
    commandInit("POST", input),
  );
}

export function archiveAdminContent(
  collection: AdminContentCollection,
  id: string,
): Promise<AdminContentItem> {
  return getEnvelope<AdminContentItem>(
    `/api/admin/content/${segment(collection)}/${segment(id)}/archive`,
    commandInit("POST"),
  );
}
