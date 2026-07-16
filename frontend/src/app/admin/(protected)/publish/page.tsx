import { redirect } from "next/navigation";

import { getAdminSession } from "@/api/server";
import { PublishCenter } from "@/components/admin/publish/publish-center";
import { AdminPage } from "@/components/admin/ui/admin-page";

export default async function PublishPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!session.permissions.includes("preview.create")) redirect("/admin");
  return <AdminPage description="生成与正式网站完全隔离的内容快照，确认三种语言和页面布局后再发布已审核变更。" eyebrow="内容" title="预览与发布"><PublishCenter canPublish={session.permissions.includes("content.publish")} /></AdminPage>;
}
