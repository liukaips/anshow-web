import { redirect } from "next/navigation";

import { listAdminMedia } from "@/api/admin-media.server";
import { getAdminSession } from "@/api/server";
import { MediaLibrary } from "@/components/admin/media-library";
import { AdminPage } from "@/components/admin/ui/admin-page";

export default async function AdminMediaPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const items = await listAdminMedia();

  return (
    <AdminPage
      description="上传网站图片、维护三语言图片说明，并通过主体位置控制不同屏幕下的裁切效果。"
      eyebrow="内容资源"
      title="媒体库"
    >
      <MediaLibrary
        canWrite={session.permissions.includes("media.write")}
        initialItems={items}
      />
    </AdminPage>
  );
}
