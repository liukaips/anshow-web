import { redirect } from "next/navigation";
import { getAdminSession } from "@/api/server";
import { listAdminRoles, listAdminStaff } from "@/api/admin-staff.server";
import { RoleMatrix } from "@/components/admin/role-matrix";
import { StaffForm } from "@/components/admin/staff-form";

export default async function StaffPage() { const session = await getAdminSession(); if (!session) redirect("/admin/login"); if (!session.permissions.includes("staff.manage")) redirect("/admin"); const [staff, roles] = await Promise.all([listAdminStaff(), listAdminRoles()]); return <main className="px-4 py-7 sm:px-8 sm:py-9"><div className="mx-auto grid max-w-7xl gap-6"><div><p className="text-sm font-medium text-[var(--color-cyan-ink)]">Administration</p><h1 className="mt-1 text-3xl font-semibold">Staff & roles</h1><p className="mt-2 max-w-2xl text-base leading-6 text-neutral-600">Control who can publish, manage enquiries, and change site configuration.</p></div><StaffForm staff={staff} /><RoleMatrix roles={roles} /></div></main>; }
