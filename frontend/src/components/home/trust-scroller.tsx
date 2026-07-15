"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

import type { HomeItem } from "./types";

type TrustScrollerProps = {
  items: readonly HomeItem[];
  labels: { previous: string; next: string };
  title: string;
};

export function TrustScroller({ items, labels, title }: TrustScrollerProps) {
  const viewport = useRef<HTMLDivElement>(null);
  if (!items.length) return null;

  const move = (direction: number) => {
    viewport.current?.scrollBy({ behavior: "smooth", left: direction * 320 });
  };

  return (
    <section className="bg-white px-5 py-16 sm:px-8 lg:px-12">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex items-end justify-between gap-5">
          <h2 className="text-2xl font-semibold sm:text-3xl">{title}</h2>
          <div className="flex gap-2">
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
        <div className="mt-8 flex snap-x gap-4 overflow-x-auto pb-4" ref={viewport}>
          {items.map((item) => (
            <article className="min-w-[min(22rem,82vw)] snap-start border border-black/10 p-6" key={item.id}>
              <h3 className="text-xl font-semibold">{item.title}</h3>
              <p className="mt-3 leading-7 text-black/60">{item.summary}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

