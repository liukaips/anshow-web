import { ArrowUpRight, Boxes, Container, FileCheck2, Plane, Ship, TrainFront, Warehouse } from "lucide-react";
import Link from "next/link";

import { ContentMedia } from "./content-media";
import { SectionHeading } from "./section-heading";
import { homeHref, type HomeItem } from "./types";

const icons = [Ship, Plane, TrainFront, Container, Boxes, FileCheck2, Warehouse] as const;

type ServiceGridProps = {
  eyebrow: string;
  items: readonly HomeItem[];
  learnMore: string;
  locale: string;
  pathPrefix?: string;
  title: string;
};

export function ServiceGrid({ eyebrow, items, learnMore, locale, pathPrefix = "", title }: ServiceGridProps) {
  if (!items.length) return null;

  return (
    <section className="bg-[var(--color-surface)] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto w-full max-w-7xl">
        <SectionHeading eyebrow={eyebrow} title={title} />
        <div className="mt-12 grid grid-cols-1 gap-px bg-black/10 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item, index) => {
            const Icon = icons[index % icons.length];
            return (
              <article
                className="group relative min-h-72 overflow-hidden bg-[var(--color-light-surface)] p-6 sm:p-7"
                key={item.id}
              >
                {item.media ? (
                  <ContentMedia
                    className="absolute inset-0 size-full object-cover opacity-20 transition-[opacity,transform] duration-500 motion-safe:group-hover:scale-[1.03] group-hover:opacity-30"
                    item={item}
                  />
                ) : null}
                <div className="relative flex h-full flex-col">
                  <span className="grid size-12 place-items-center border border-black/15 bg-white">
                    <Icon aria-hidden="true" className="size-6 text-[var(--color-teal)]" />
                  </span>
                  <p className="mt-8 font-mono text-xs text-black/65">0{index + 1}</p>
                  <h3 className="mt-3 text-2xl font-semibold">{item.title}</h3>
                  <p className="mt-4 max-w-sm leading-7 text-black/65">{item.summary}</p>
                  <Link
                    className="mt-auto inline-flex min-h-11 items-center gap-2 pt-8 font-semibold text-[var(--color-text)]"
                    href={homeHref(pathPrefix, locale, "services", item.slug)}
                  >
                    {learnMore}
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-4 transition-transform motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5"
                    />
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
