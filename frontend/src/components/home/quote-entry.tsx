import { ArrowRight, Box, MapPinned, UserRound } from "lucide-react";
import Link from "next/link";

import type { SupportedLocale } from "@/lib/app-config";

import { homeHref } from "./types";

export type QuoteEntryLabels = {
  cargoText: string;
  cargoTitle: string;
  contactText: string;
  contactTitle: string;
  cta: string;
  eyebrow: string;
  routeText: string;
  routeTitle: string;
  summary: string;
  title: string;
};

export function QuoteEntry({
  labels,
  locale,
  pathPrefix = "",
}: {
  labels: QuoteEntryLabels;
  locale: SupportedLocale;
  pathPrefix?: string;
}) {
  const guidance = [
    { Icon: MapPinned, text: labels.routeText, title: labels.routeTitle },
    { Icon: Box, text: labels.cargoText, title: labels.cargoTitle },
    { Icon: UserRound, text: labels.contactText, title: labels.contactTitle },
  ] as const;

  return (
    <section className="bg-[var(--color-carbon)] px-5 py-16 text-[var(--color-text-inverse)] sm:px-8 lg:px-12 lg:py-20">
      <div className="mx-auto w-full max-w-7xl">
        <div className="grid gap-8 border-b border-white/15 pb-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <header className="max-w-3xl">
            <p className="font-mono text-xs uppercase text-[var(--color-cyan)]">{labels.eyebrow}</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">{labels.title}</h2>
            <p className="mt-4 max-w-2xl leading-7 text-[var(--color-muted-inverse)]">{labels.summary}</p>
          </header>
          <Link
            className="inline-flex min-h-12 w-fit items-center gap-3 bg-[var(--color-action)] px-5 font-semibold text-[var(--color-carbon)] transition-colors hover:bg-orange-500"
            href={homeHref(pathPrefix, locale, "quote")}
          >
            {labels.cta}
            <ArrowRight aria-hidden="true" className="size-5" />
          </Link>
        </div>
        <ol className="grid md:grid-cols-3">
          {guidance.map(({ Icon, text, title }, index) => (
            <li className="border-b border-white/15 py-7 md:border-b-0 md:border-r md:px-7 md:first:pl-0 md:last:border-r-0 md:last:pr-0" key={title}>
              <div className="flex items-center justify-between gap-4">
                <Icon aria-hidden="true" className="size-5 text-[var(--color-cyan)]" />
                <span className="font-mono text-xs tabular-nums text-white/50">0{index + 1}</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--color-muted-inverse)]">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
