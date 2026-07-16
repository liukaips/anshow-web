import { redirect } from "next/navigation";

import { listAdminAuditEvents } from "@/api/admin-audit.server";
import { getAdminSession } from "@/api/server";
import { AuditList } from "@/components/admin/audit/audit-list";
import { AdminPage } from "@/components/admin/ui/admin-page";

export default async function AuditPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!session.permissions.includes("audit.read")) redirect("/admin");
  const items = await listAdminAuditEvents();
  return <AdminPage description="查看员工账号和系统的重要操作，敏感信息已自动隐藏。" eyebrow="系统" title="审计日志"><AuditList items={items} /></AdminPage>;
}
