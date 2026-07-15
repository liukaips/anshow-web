import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  isAdminContentCollection,
} from "@/api/admin-content";
import { getAdminContent } from "@/api/admin-content.server";
import { ApiError } from "@/api/http";
import { getAdminSession } from "@/api/server";
import { collectionLabels } from "@/components/admin/content-collection-list";
import { ContentEditor } from "@/components/admin/content-editor";

export default async function AdminContentEditorPage({
  params,
}: {
  params: Promise<{ collection: string; id: string }>;
}) {
  const { collection, id } = await params;
  if (!isAdminContentCollection(collection)) notFound();

  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  let item;
  try {
    item = await getAdminContent(collection, id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  return (
    <main className="px-4 py-7 sm:px-8 sm:py-9" id="admin-main">
      <div className="mx-auto min-w-0 max-w-6xl">
        <Link
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-cyan-ink)] hover:underline"
          href={`/admin/content/${collection}`}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {collectionLabels[collection]}
        </Link>
        <div className="mt-3 border-b border-neutral-200 pb-5">
          <p className="break-words text-sm font-medium text-neutral-500">{item.code}</p>
          <h1 className="mt-1 break-words text-2xl font-semibold text-[var(--color-text)] sm:text-3xl">
            Edit multilingual content
          </h1>
        </div>
        <ContentEditor
          canPublish={Boolean(session?.permissions.includes("content.publish"))}
          canWrite={session.permissions.includes("content.write")}
          collection={collection}
          initialItem={item}
        />
      </div>
    </main>
  );
}
