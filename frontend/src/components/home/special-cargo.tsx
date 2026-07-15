import { ArrowUpRight, Box, Snowflake, TriangleAlert, Weight } from "lucide-react";
import Link from "next/link";

import { ContentMedia } from "./content-media";
import { SectionHeading } from "./section-heading";
import type { HomeItem } from "./types";

const icons = [Box, Weight, TriangleAlert, Snowflake] as const;

type SpecialCargoProps = {
  eyebrow: string;
  items: readonly HomeItem[];
  learnMore: string;
  locale: string;
  title: string;
};

export function SpecialCargo({ eyebrow, items, learnMore, locale, title }: SpecialCargoProps) {
  if (!items.length) return null;

  return (
    <section className="bg-[var(--color-light-surface)] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto w-full max-w-7xl">
        <SectionHeading eyebrow={eyebrow} title={title} />
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
          {items.map((item, index) => {
            const Icon = icons[index % icons.length];
            return (
              <article className="group relative min-h-72 overflow-hidden bg-white" key={item.id}>
                {item.media ? (
                  <ContentMedia
                    className="absolute inset-0 size-full object-cover opacity-25 transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
                    item={item}
                  />
                ) : null}
                <div className="relative flex min-h-72 flex-col p-6 sm:p-8">
                  <Icon aria-hidden="true" className="size-8 text-[var(--color-teal)]" />
                  <h3 className="mt-10 max-w-md text-2xl font-semibold">{item.title}</h3>
                  <p className="mt-3 max-w-lg leading-7 text-black/65">{item.summary}</p>
                  <Link
                    className="mt-auto inline-flex min-h-11 items-center gap-2 pt-6 font-semibold"
                    href={`/${locale}/special-cargo/${encodeURIComponent(item.slug)}`}
                  >
                    {learnMore}
                    <ArrowUpRight aria-hidden="true" className="size-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
