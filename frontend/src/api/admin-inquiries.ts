import type { paths } from "@/generated/api";

import { getEnvelope } from "./http";

type ListOperation = paths["/api/admin/inquiries"]["get"];
type AssigneesOperation = paths["/api/admin/inquiries/assignees"]["get"];
type DetailOperation = paths["/api/admin/inquiries/{id}"]["get"];
type AssignOperation = paths["/api/admin/inquiries/{id}/assign"]["post"];
type PriorityOperation = paths["/api/admin/inquiries/{id}/priority"]["post"];
type StatusOperation = paths["/api/admin/inquiries/{id}/status"]["post"];
type NoteOperation = paths["/api/admin/inquiries/{id}/notes"]["post"];

export type AdminInquiry = NonNullable<
  ListOperation["responses"][200]["content"]["application/json"]["data"]
>[number];
export type AdminInquiryDetail = NonNullable<
  DetailOperation["responses"][200]["content"]["application/json"]["data"]
>;
export type AdminInquiryStatus = AdminInquiry["status"];
export type AdminInquiryPriority = AdminInquiry["priority"];
export type AdminInquiryAssignee = NonNullable<
  AssigneesOperation["responses"][200]["content"]["application/json"]["data"]
>[number];

const segment = (value: string) => encodeURIComponent(value);
const command = <T>(path: string, body?: unknown) =>
  getEnvelope<T>(path, {
    method: "POST",
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export function getAdminInquiry(id: string): Promise<AdminInquiryDetail> {
  return getEnvelope<AdminInquiryDetail>(`/api/admin/inquiries/${segment(id)}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
}

export function assignAdminInquiry(
  id: string,
  input: AssignOperation["requestBody"]["content"]["application/json"],
): Promise<AdminInquiry> {
  return command(`/api/admin/inquiries/${segment(id)}/assign`, input);
}

export function updateAdminInquiryPriority(
  id: string,
  input: PriorityOperation["requestBody"]["content"]["application/json"],
): Promise<AdminInquiry> {
  return command(`/api/admin/inquiries/${segment(id)}/priority`, input);
}

export function updateAdminInquiryStatus(
  id: string,
  input: StatusOperation["requestBody"]["content"]["application/json"],
): Promise<AdminInquiry> {
  return command(`/api/admin/inquiries/${segment(id)}/status`, input);
}

export function addAdminInquiryNote(
  id: string,
  input: NoteOperation["requestBody"]["content"]["application/json"],
) {
  return command<NonNullable<NoteOperation["responses"][200]["content"]["application/json"]["data"]>>(
    `/api/admin/inquiries/${segment(id)}/notes`,
    input,
  );
}

export function retryAdminInquiryNotification(id: string, deliveryId: string) {
  return command(`/api/admin/inquiries/${segment(id)}/notifications/${segment(deliveryId)}/retry`);
}

export function inquiryExportUrl(filters?: { status?: string; priority?: string; search?: string }): string {
  const query = new URLSearchParams();
  if (filters?.status) query.set("status", filters.status);
  if (filters?.priority) query.set("priority", filters.priority);
  if (filters?.search) query.set("search", filters.search);
  const suffix = query.toString();
  return `/api/admin/inquiries/export${suffix ? `?${suffix}` : ""}`;
}
