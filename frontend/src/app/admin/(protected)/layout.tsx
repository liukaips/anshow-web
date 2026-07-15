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
    <div className="grid min-h-dvh grid-cols-1 bg-[var(--color-light-surface)] text-[var(--color-text)] md:grid-cols-[14rem_minmax(0,1fr)]">
      <AdminSidebar permissions={session.permissions} />
      <div className="min-w-0">
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
