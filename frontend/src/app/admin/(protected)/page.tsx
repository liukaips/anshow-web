import { redirect } from "next/navigation";

import { getAdminDashboard } from "@/api/admin-dashboard.server";
import { getAdminSession } from "@/api/server";
import { AdminDashboard } from "@/components/admin/dashboard/admin-dashboard";
import { AdminPage } from "@/components/admin/ui/admin-page";

export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const data = await getAdminDashboard();
  return (
    <AdminPage
      description="查看真实业务数据并直接进入今天需要处理的任务。"
      eyebrow="运营工作台"
      title="管理后台"
    >
      <AdminDashboard data={data} />
    </AdminPage>
  );
}
