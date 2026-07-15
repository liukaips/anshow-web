"use client";

import { RotateCcw } from "lucide-react";

export default function AdminContentError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="px-4 py-10 sm:px-8" id="admin-main">
      <div className="mx-auto max-w-3xl border-l-4 border-[var(--color-danger)] bg-white px-5 py-6">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Content could not be loaded</h1>
        <p className="mt-2 text-base text-neutral-600">The administration API did not return this workspace.</p>
        <button
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-neutral-300 px-4 text-sm font-semibold"
          onClick={reset}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          Try again
        </button>
      </div>
    </main>
  );
}
