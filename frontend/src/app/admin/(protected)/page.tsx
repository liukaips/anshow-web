export default function AdminDashboardPage() {
  return (
    <main id="admin-main" className="px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-medium text-[var(--color-cyan-ink)]">
          Operations workspace
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--color-text)]">
          Administration
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-neutral-600">
          Select an authorized workspace from the navigation to manage AnShow
          content and operations.
        </p>
      </div>
    </main>
  );
}
