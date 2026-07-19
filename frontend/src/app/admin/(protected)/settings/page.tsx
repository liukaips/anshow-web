import { redirect } from "next/navigation";

import { getAdminSettings } from "@/api/admin-settings.server";
import { getAdminBackups } from "@/api/admin-backups.server";
import { getAdminSession } from "@/api/server";
import { BackupOperations } from "@/components/admin/backup-operations";
import { BackupSettingsForm } from "@/components/admin/backup-settings-form";
import { SiteSettingsForm } from "@/components/admin/site-settings-form";
import { AdminPage } from "@/components/admin/ui/admin-page";

export default async function SettingsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!session.permissions.includes("settings.manage")) redirect("/admin");

  const [settings, backups] = await Promise.all([
    getAdminSettings(),
    getAdminBackups(),
  ]);
  return (
    <AdminPage
      description="配置官网展示、语言默认、询价接收和备份策略，敏感密钥始终由部署环境管理。"
      eyebrow="系统管理"
      title="系统设置"
    >
      <div className="space-y-5">
        <SiteSettingsForm settings={settings} />
        <BackupSettingsForm settings={settings} />
        <BackupOperations initialRuns={backups} />
      </div>
    </AdminPage>
  );
}
