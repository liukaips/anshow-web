import "server-only";

import { headers } from "next/headers";

import { getFrontendServerEnv } from "@/env";

import type { AdminInquiry, AdminInquiryAssignee, AdminInquiryDetail } from "./admin-inquiries";

async function readAdmin<T>(path: string): Promise<T> {
  const requestHeaders = await headers();
  const response = await fetch(
    new URL(path, getFrontendServerEnv().BACKEND_INTERNAL_URL),
    {
      cache: "no-store",
      headers: { cookie: requestHeaders.get("cookie") ?? "" },
    },
  );
  if (!response.ok) throw new Error(`询盘加载失败（${response.status}）`);
  const payload = (await response.json()) as { data: T };
  return payload.data;
}

export async function listAdminInquiries(): Promise<readonly AdminInquiry[]> {
  return readAdmin<AdminInquiry[]>("/api/admin/inquiries?limit=100&offset=0");
}

export async function getAdminInquiryServer(id: string): Promise<AdminInquiryDetail> {
  return readAdmin<AdminInquiryDetail>(`/api/admin/inquiries/${encodeURIComponent(id)}`);
}

export async function listAdminInquiryAssignees(): Promise<readonly AdminInquiryAssignee[]> {
  return readAdmin<AdminInquiryAssignee[]>("/api/admin/inquiries/assignees");
}
