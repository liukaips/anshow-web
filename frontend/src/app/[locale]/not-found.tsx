"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { isLocale } from "@/i18n/routing";

export default function NotFound() {
  const translate = useTranslations("Errors");
  const pathname = usePathname();
  const candidate = pathname.split("/")[1];
  const locale = isLocale(candidate) ? candidate : "en";

  return (
    <main className="grid min-h-[70dvh] place-items-center bg-[var(--color-carbon)] px-5 py-16 text-white">
      <div className="w-full max-w-3xl border-l border-[var(--color-cyan)] pl-6 sm:pl-10">
        <p className="font-mono text-xs uppercase text-[var(--color-cyan)]">ANSHOW / 404</p>
        <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-6xl">
          {translate("notFoundTitle")}
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--color-muted-inverse)]">
          {translate("notFoundBody")}
        </p>
        <Link
          className="mt-8 inline-flex min-h-12 items-center gap-3 bg-[var(--color-action)] px-5 font-semibold text-[var(--color-carbon)]"
          href={`/${locale}`}
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
          AnShow
        </Link>
      </div>
    </main>
  );
}
