import { ArrowRight, MapPin, MoveRight } from "lucide-react";
import Link from "next/link";

import { SectionHeading } from "./section-heading";
import type { HomeItem } from "./types";

type TradeLanesProps = {
  eyebrow: string;
  items: readonly HomeItem[];
  laneLabel: string;
  learnMore: string;
  locale: string;
  title: string;
};

export function TradeLanes({ eyebrow, items, laneLabel, learnMore, locale, title }: TradeLanesProps) {
  if (!items.length) return null;

  return (
    <section className="overflow-hidden bg-[var(--color-carbon)] px-5 py-20 text-[var(--color-text-inverse)] sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto w-full max-w-7xl">
        <SectionHeading eyebrow={eyebrow} inverse title={title} />
        <div className="relative mt-12 border-y border-white/15">
          <div aria-hidden="true" className="absolute bottom-0 left-5 top-0 w-px bg-[var(--color-cyan)]/35 sm:left-8" />
          {items.map((item, index) => (
            <article
              className="group grid gap-4 border-b border-white/15 py-7 pl-12 last:border-b-0 sm:grid-cols-[minmax(0,0.55fr)_minmax(0,1fr)_auto] sm:items-center sm:pl-16"
              key={item.id}
            >
              <div className="relative">
                <MapPin
                  aria-hidden="true"
                  className="absolute -left-[2.85rem] top-0 size-5 fill-[var(--color-carbon)] text-[var(--color-cyan)] sm:-left-[3.55rem]"
                />
                <p className="font-mono text-xs text-[var(--color-cyan)]">
                  {laneLabel} 0{index + 1}
                </p>
                <h3 className="mt-2 text-xl font-semibold sm:text-2xl">{item.title}</h3>
              </div>
              <p className="max-w-2xl leading-7 text-[var(--color-muted-inverse)]">{item.summary}</p>
              <Link
                aria-label={`${learnMore}: ${item.title}`}
                className="inline-flex min-h-11 items-center gap-3 font-semibold text-[var(--color-cyan)]"
                href={`/${locale}/trade-lanes/${encodeURIComponent(item.slug)}`}
              >
                <span className="sm:hidden">{learnMore}</span>
                <MoveRight
                  aria-hidden="true"
                  className="size-6 transition-transform motion-safe:group-hover:translate-x-1"
                />
              </Link>
            </article>
          ))}
        </div>
        <Link
          className="mt-8 inline-flex min-h-11 items-center gap-2 border-b border-[var(--color-cyan)] font-semibold"
          href={`/${locale}/trade-lanes`}
        >
          {title}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </section>
  );
}
