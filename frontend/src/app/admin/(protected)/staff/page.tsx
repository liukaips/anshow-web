import { redirect } from "next/navigation";

import { listAdminRoles, listAdminStaff } from "@/api/admin-staff.server";
import { getAdminSession } from "@/api/server";
import { RoleMatrix } from "@/components/admin/role-matrix";
import { StaffForm } from "@/components/admin/staff-form";
import { AdminPage } from "@/components/admin/ui/admin-page";

export default async function StaffPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!session.permissions.includes("staff.manage")) redirect("/admin");

  const [staff, roles] = await Promise.all([
    listAdminStaff(),
    listAdminRoles(),
  ]);

  return (
    <AdminPage
      description="分配员工角色、管理账号状态，并在权限变化后撤销现有登录会话。"
      eyebrow="系统管理"
      title="员工与权限"
    >
      <StaffForm
        currentUserId={session.user.id}
        roles={roles}
        staff={staff}
      />
      <RoleMatrix roles={roles} />
    </AdminPage>
  );
}
