import { notFound, redirect } from "next/navigation";

import {
  isAdminContentCollection,
} from "@/api/admin-content";
import { listAdminContent } from "@/api/admin-content.server";
import { getAdminSession } from "@/api/server";
import {
  ContentCollectionList,
  collectionLabels,
} from "@/components/admin/content-collection-list";

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
    <main className="px-4 py-7 sm:px-8 sm:py-9" id="admin-main">
      <div className="mx-auto min-w-0 max-w-7xl">
        <p className="text-sm font-medium text-[var(--color-cyan-ink)]">
          Multilingual content
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)] sm:text-3xl">
          {collectionLabels[collection]}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
          Review publication state and translation completeness for each locale.
        </p>
        <div className="mt-6">
          <ContentCollectionList
            canWrite={session.permissions.includes("content.write")}
            collection={collection}
            initialItems={items}
          />
        </div>
      </div>
    </main>
  );
}
