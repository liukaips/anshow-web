import { redirect } from "next/navigation";

import { listAdminMedia } from "@/api/admin-media.server";
import { getAdminSession } from "@/api/server";
import { MediaLibrary } from "@/components/admin/media-library";

export default async function AdminMediaPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const items = await listAdminMedia();

  return (
    <main className="px-4 py-7 sm:px-8 sm:py-9" id="admin-main">
      <div className="mx-auto min-w-0 max-w-7xl">
        <p className="text-sm font-medium text-[var(--color-cyan-ink)]">
          Managed assets
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--color-text)] sm:text-3xl">
          Media Library
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-6 text-neutral-600">
          Review optimized image variants, localized alternative text, focal
          points, and content references.
        </p>
        <div className="mt-6">
          <MediaLibrary
            canWrite={session.permissions.includes("media.write")}
            initialItems={items}
          />
        </div>
      </div>
    </main>
  );
}
