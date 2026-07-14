import { redirect } from "next/navigation";

import { getAdminSession } from "@/api/server";
import { AnShowLogo } from "@/components/brand/anshow-logo";

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <main className="min-h-screen bg-[var(--color-light-surface)] text-[var(--color-text)]">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <AnShowLogo />
          <span className="max-w-[55vw] truncate text-sm text-neutral-600">
            {session.user.email}
          </span>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <h1 className="text-3xl font-semibold">Administration</h1>
      </section>
    </main>
  );
}
