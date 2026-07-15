import "server-only";
import { headers } from "next/headers";
import { getFrontendServerEnv } from "../env";
import type { StaffMember, StaffRole } from "./admin-staff";

async function read<T>(path: string): Promise<T> {
  const h = await headers();
  const response = await fetch(new URL(path, getFrontendServerEnv().BACKEND_INTERNAL_URL), { cache: "no-store", headers: { cookie: h.get("cookie") ?? "" } });
  if (!response.ok) throw new Error(`Staff API failed (${response.status})`);
  return ((await response.json()) as { data: T }).data;
}
export const listAdminStaff = () => read<StaffMember[]>("/api/admin/staff");
export const listAdminRoles = () => read<StaffRole[]>("/api/admin/staff-roles");
