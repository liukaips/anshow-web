export default function AdminDashboardPage() {
  return (
    <main id="admin-main" className="px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-medium text-[var(--color-cyan-ink)]">
          运营工作台
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--color-text)]">
          管理后台
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-neutral-600">
          从左侧导航进入对应模块，管理 AnShow 内容与业务运营。
        </p>
      </div>
    </main>
  );
}
