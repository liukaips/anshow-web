import type { paths } from "../generated/api";
import { getEnvelope } from "./http";

type CreateOperation = paths["/api/admin/previews"]["post"];
type PublishOperation = paths["/api/admin/previews/{id}/publish"]["post"];
type ScheduleOperation = paths["/api/admin/previews/{id}/schedule"]["post"];
type CancelScheduleOperation = paths["/api/admin/previews/{id}/schedule/cancel"]["post"];
export type CreateAdminPreviewInput = CreateOperation["requestBody"]["content"]["application/json"];
export type CreateAdminPreviewResult = NonNullable<CreateOperation["responses"][201]["content"]["application/json"]["data"]>;

export function createAdminPreview(input: CreateAdminPreviewInput): Promise<CreateAdminPreviewResult> {
  return getEnvelope<CreateAdminPreviewResult>("/api/admin/previews", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export type PublishAdminPreviewInput = PublishOperation["requestBody"]["content"]["application/json"];
export type PublishAdminPreviewResult = NonNullable<PublishOperation["responses"][200]["content"]["application/json"]["data"]>;

export function publishAdminPreview(
  id: string,
  input: PublishAdminPreviewInput,
): Promise<PublishAdminPreviewResult> {
  return getEnvelope<PublishAdminPreviewResult>(
    `/api/admin/previews/${encodeURIComponent(id)}/publish`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export type ScheduleAdminPreviewInput = ScheduleOperation["requestBody"]["content"]["application/json"];
export type ScheduleAdminPreviewResult = NonNullable<ScheduleOperation["responses"][200]["content"]["application/json"]["data"]>;

export function scheduleAdminPreview(id: string, input: ScheduleAdminPreviewInput): Promise<ScheduleAdminPreviewResult> {
  return getEnvelope<ScheduleAdminPreviewResult>(`/api/admin/previews/${encodeURIComponent(id)}/schedule`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export type CancelScheduleAdminPreviewResult = NonNullable<CancelScheduleOperation["responses"][200]["content"]["application/json"]["data"]>;

export function cancelScheduleAdminPreview(id: string): Promise<CancelScheduleAdminPreviewResult> {
  return getEnvelope<CancelScheduleAdminPreviewResult>(`/api/admin/previews/${encodeURIComponent(id)}/schedule/cancel`, {
    method: "POST",
    credentials: "same-origin",
  });
}
