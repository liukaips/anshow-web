"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

export default function PublicError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const translate = useTranslations();
  return (
    <main className="grid min-h-[70dvh] place-items-center bg-[var(--color-carbon)] px-5 py-16 text-white">
      <div className="w-full max-w-3xl border-l border-[var(--color-action)] pl-6 sm:pl-10">
        <p className="font-mono text-xs uppercase text-[var(--color-action)]">ANSHOW / ERROR</p>
        <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-6xl">
          {translate("Errors.unexpected")}
        </h1>
        <button
          className="mt-8 inline-flex min-h-12 items-center gap-3 bg-[var(--color-action)] px-5 font-semibold text-[var(--color-carbon)]"
          onClick={reset}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="size-5" />
          {translate("Common.retry")}
        </button>
      </div>
    </main>
  );
}
