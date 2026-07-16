import { redirect } from "next/navigation";

import { getAdminSession } from "@/api/server";
import {
  AdminMobileNavigation,
  AdminSidebar,
} from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <div
      className="grid min-h-dvh grid-cols-1 bg-neutral-100 text-neutral-950 md:grid-cols-[232px_minmax(0,1fr)]"
      lang="zh-CN"
    >
      <AdminSidebar permissions={session.permissions} />
      <div className="min-w-0 overflow-x-clip">
        <AdminTopbar
          email={session.user.email}
          navigation={
            <AdminMobileNavigation permissions={session.permissions} />
          }
        />
        {children}
      </div>
    </div>
  );
}
