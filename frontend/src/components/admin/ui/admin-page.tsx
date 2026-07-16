import type { ReactNode } from "react";

type AdminPageProps = Readonly<{
  actions?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
}>;

export function AdminPage({
  actions,
  children,
  description,
  eyebrow,
  title,
}: AdminPageProps) {
  return (
    <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8" id="admin-main">
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <header className="flex min-w-0 flex-col gap-4 border-b border-neutral-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="mb-1 text-sm font-medium text-[var(--color-cyan-ink)]">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-2xl font-semibold text-neutral-950 sm:text-3xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-3xl text-base leading-6 text-neutral-600">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex min-h-11 shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </header>
        {children}
      </div>
    </main>
  );
}
