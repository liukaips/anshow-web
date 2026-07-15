import { redirect } from "next/navigation";
import { getAdminSession } from "@/api/server";
import { getAdminSettings } from "@/api/admin-settings.server";
import { BackupSettingsForm } from "@/components/admin/backup-settings-form";

export default async function SettingsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!session.permissions.includes("settings.manage")) redirect("/admin");
  const settings = await getAdminSettings();
  return <main className="px-4 py-7 sm:px-8 sm:py-9"><div className="mx-auto grid max-w-7xl gap-6"><div><p className="text-sm font-medium text-[var(--color-cyan-ink)]">System</p><h1 className="mt-1 text-3xl font-semibold">Site settings</h1><p className="mt-2 max-w-2xl text-base leading-6 text-neutral-600">Manage deployment-safe configuration without exposing secrets.</p></div><BackupSettingsForm settings={settings} /></div></main>;
}
