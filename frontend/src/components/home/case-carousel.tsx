"use client";

import { ArrowUpRight } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import { ContentMedia } from "./content-media";
import { SectionHeading } from "./section-heading";
import type { HomeItem } from "./types";

type CaseCarouselProps = {
  eyebrow: string;
  items: readonly HomeItem[];
  labels: { previous: string; next: string };
  learnMore: string;
  locale: string;
  title: string;
};

export function CaseCarousel({ eyebrow, items, labels, learnMore, locale, title }: CaseCarouselProps) {
  const viewport = useRef<HTMLDivElement>(null);
  if (!items.length) return null;

  const move = (direction: number) => {
    viewport.current?.scrollBy({ behavior: "smooth", left: direction * 540 });
  };

  return (
    <section className="bg-white px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex items-end justify-between gap-5">
          <SectionHeading eyebrow={eyebrow} title={title} />
          <div className={`flex gap-2 ${items.length <= 3 ? "lg:hidden" : ""}`}>
            <button
              aria-label={labels.previous}
              className="grid size-11 place-items-center border border-black/20"
              onClick={() => move(-1)}
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
            <button
              aria-label={labels.next}
              className="grid size-11 place-items-center border border-black/20"
              onClick={() => move(1)}
              type="button"
            >
              <ChevronRight aria-hidden="true" className="size-5" />
            </button>
          </div>
        </div>
        <div
          className={`mt-12 gap-5 pb-5 ${
            items.length <= 3
              ? "flex snap-x overflow-x-auto lg:grid lg:grid-cols-3 lg:overflow-visible"
              : "flex snap-x overflow-x-auto"
          }`}
          ref={viewport}
        >
          {items.map((item) => (
            <article
              className={`snap-start border border-black/10 ${
                items.length <= 3 ? "min-w-[min(32rem,88vw)] lg:min-w-0" : "min-w-[min(32rem,88vw)]"
              }`}
              key={item.id}
            >
              {item.media ? (
                <ContentMedia className="aspect-[16/9] w-full object-cover" item={item} />
              ) : (
                <div aria-hidden="true" className="aspect-[16/9] bg-[var(--color-dark-surface)]" />
              )}
              <div className="p-6 sm:p-8">
                <h3 className="text-2xl font-semibold">{item.title}</h3>
                <p className="mt-3 leading-7 text-black/60">{item.summary}</p>
                <Link
                  className="mt-5 inline-flex min-h-11 items-center gap-2 font-semibold"
                  href={`/${locale}/case-studies/${encodeURIComponent(item.slug)}`}
                >
                  {learnMore}
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
