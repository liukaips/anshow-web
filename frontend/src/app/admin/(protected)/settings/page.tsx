import { redirect } from "next/navigation";

import { getAdminSettings } from "@/api/admin-settings.server";
import { getAdminSession } from "@/api/server";
import { BackupSettingsForm } from "@/components/admin/backup-settings-form";
import { AdminPage } from "@/components/admin/ui/admin-page";

export default async function SettingsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!session.permissions.includes("settings.manage")) redirect("/admin");

  const settings = await getAdminSettings();
  return (
    <AdminPage
      description="配置服务器与腾讯云 COS 备份策略，敏感密钥始终由部署环境管理。"
      eyebrow="系统管理"
      title="系统设置"
    >
      <BackupSettingsForm settings={settings} />
    </AdminPage>
  );
}
