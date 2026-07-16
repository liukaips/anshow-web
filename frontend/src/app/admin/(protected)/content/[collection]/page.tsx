import { notFound, redirect } from "next/navigation";

import {
  isAdminContentCollection,
} from "@/api/admin-content";
import { listAdminContent } from "@/api/admin-content.server";
import { getAdminSession } from "@/api/server";
import {
  ContentCollectionList,
} from "@/components/admin/content-collection-list";
import {
  collectionDescriptions,
  collectionPageTitles,
} from "@/components/admin/content/content-labels";
import { AdminPage } from "@/components/admin/ui/admin-page";

export default async function AdminContentCollectionPage({
  params,
}: {
  params: Promise<{ collection: string }>;
}) {
  const { collection } = await params;
  if (!isAdminContentCollection(collection)) notFound();
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const items = await listAdminContent(collection);

  return (
    <AdminPage
      description={collectionDescriptions[collection]}
      eyebrow="内容管理"
      title={collectionPageTitles[collection]}
    >
      <ContentCollectionList
        canWrite={session.permissions.includes("content.write")}
        collection={collection}
        initialItems={items}
      />
    </AdminPage>
  );
}
