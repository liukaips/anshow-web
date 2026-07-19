import { ArrowRight, ArrowUpRight, Container } from "lucide-react";
import Link from "next/link";

import type { SupportedLocale } from "@/lib/app-config";

import { ContentMedia } from "./content-media";
import { homeHref, type HomeItem } from "./types";

type Fact = {
  key: string;
  label: string;
  unit?: string;
  value: string;
};

function caseFacts(item: HomeItem): Fact[] {
  return (
    item.structuredBody?.sections.flatMap((section) =>
      section.type === "fact-list" ? section.items : [],
    ) ?? []
  );
}

export function EvidenceCases({
  allCases,
  eyebrow,
  items,
  learnMore,
  locale,
  pathPrefix = "",
  title,
}: {
  allCases: string;
  eyebrow: string;
  items: readonly HomeItem[];
  learnMore: string;
  locale: SupportedLocale;
  pathPrefix?: string;
  title: string;
}) {
  const cases = items.slice(0, 4);
  if (!cases.length) return null;

  return (
    <section className="bg-[var(--color-light-surface)] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <header className="max-w-3xl">
            <p className="font-mono text-xs uppercase text-[var(--color-cyan-ink)]">{eyebrow}</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight text-[var(--color-text)] sm:text-4xl">{title}</h2>
          </header>
          <Link className="inline-flex min-h-11 w-fit items-center gap-2 border-b border-black/30 font-semibold" href={homeHref(pathPrefix, locale, "case-studies")}>
            {allCases}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {cases.map((item) => {
            const facts = caseFacts(item).slice(0, 3);
            return (
              <article className="group flex min-w-0 flex-col overflow-hidden border border-black/10 bg-white" key={item.id}>
                <div className="relative aspect-[4/3] overflow-hidden bg-[var(--color-dark-surface)]">
                  {item.media ? (
                    <ContentMedia className="absolute inset-0 size-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]" item={item} />
                  ) : (
                    <div aria-hidden="true" className="absolute inset-0 grid place-items-center bg-[var(--color-dark-surface)] text-[var(--color-cyan)]">
                      <Container className="size-12" strokeWidth={1.25} />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-xl font-semibold leading-snug text-[var(--color-text)]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-black/65">{item.summary}</p>
                  {facts.length ? (
                    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-black/10 py-4">
                      {facts.map((fact) => (
                        <div className="min-w-0" key={fact.key}>
                          <dt className="truncate text-[0.7rem] text-black/65">{fact.label}</dt>
                          <dd className="mt-1 flex flex-wrap items-baseline gap-1 font-mono text-lg font-semibold tabular-nums text-[var(--color-text)]">
                            {fact.value}
                            {fact.unit ? <span className="text-xs font-normal text-black/55">{fact.unit}</span> : null}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  <Link
                    aria-label={`${learnMore}: ${item.title}`}
                    className="mt-auto inline-flex min-h-11 items-center gap-2 pt-5 font-semibold text-[var(--color-teal-ink)]"
                    href={homeHref(pathPrefix, locale, "case-studies", item.slug)}
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
