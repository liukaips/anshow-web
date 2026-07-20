import {
  ArrowRight,
  BadgeCheck,
  Box,
  FileText,
  Globe2,
  Route,
} from "lucide-react";
import Link from "next/link";

import { ContentMedia } from "../home/content-media";
import type { SupportedLocale } from "../../lib/app-config";

import type { PublicItem } from "./public-content.server";
import { StructuredContent } from "./structured-content";
import {
  getPublicCopy,
  type PublicCollection,
} from "./public-copy";

const collectionIcons = {
  services: Box,
  "trade-lanes": Route,
  "special-cargo": Box,
  insights: FileText,
  "case-studies": Globe2,
} satisfies Record<PublicCollection, typeof Box>;

function PlaceholderMedia({ compact = false }: { compact?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`${compact ? "aspect-[4/3]" : "aspect-[16/9]"} relative overflow-hidden bg-[var(--color-dark-surface)]`}
      data-testid="media-placeholder"
    >
      <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--color-border-inverse-strong)]" />
      <div className="absolute left-1/2 top-0 h-full w-px bg-[var(--color-border-inverse)]" />
      <div className="absolute bottom-5 left-5 size-2 bg-[var(--color-cyan)]" />
    </div>
  );
}

function PublicMedia({
  item,
  compact = false,
  eager = false,
}: {
  item: PublicItem;
  compact?: boolean;
  eager?: boolean;
}) {
  if (!item.media) return <PlaceholderMedia compact={compact} />;
  return (
    <div className={`${compact ? "aspect-[4/3]" : "aspect-[16/9]"} overflow-hidden bg-[var(--color-dark-surface)]`}>
      <ContentMedia
        className="size-full object-cover"
        eager={eager}
        item={item}
      />
    </div>
  );
}

export function Breadcrumbs({
  collection,
  current,
  locale,
  pathPrefix = "",
}: {
  collection?: PublicCollection;
  current: string;
  locale: SupportedLocale;
  pathPrefix?: string;
}) {
  const labels = getPublicCopy(locale);
  const collectionLabel = collection
    ? labels.collections[collection].title
    : undefined;

  return (
    <nav aria-label={labels.breadcrumb} className="border-b border-white/10">
      <ol className="mx-auto flex min-h-12 w-full max-w-7xl flex-wrap items-center gap-2 px-5 py-2 text-sm text-[var(--color-muted-inverse)] sm:px-8 lg:px-12">
        <li>
          <Link className="inline-flex min-h-11 items-center hover:text-white" href={`${pathPrefix}/${locale}`}>
            {labels.home}
          </Link>
        </li>
        {collection && collectionLabel ? (
          <>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                className="inline-flex min-h-11 items-center hover:text-white"
                href={`${pathPrefix}/${locale}/${collection}`}
              >
                {collectionLabel}
              </Link>
            </li>
          </>
        ) : null}
        <li aria-hidden="true">/</li>
        <li aria-current="page" className="py-3 text-white">
          {current}
        </li>
      </ol>
    </nav>
  );
}

export function QuoteCta({ locale, pathPrefix = "" }: { locale: SupportedLocale; pathPrefix?: string }) {
  const labels = getPublicCopy(locale);
  return (
    <section className="bg-[var(--color-teal)] px-5 py-12 text-[var(--color-carbon)] sm:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="max-w-3xl text-2xl font-semibold leading-tight sm:text-3xl">
          {labels.quote.title}
        </h2>
        <Link
          className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 bg-[var(--color-carbon)] px-5 font-semibold text-white transition-transform duration-[var(--motion-fast)] motion-safe:hover:-translate-y-px"
          href={`${pathPrefix}/${locale}/quote`}
        >
          {labels.quoteAction}
          <ArrowRight aria-hidden="true" className="size-5" />
        </Link>
      </div>
    </section>
  );
}

export function PublicCollectionPage({
  collection,
  items,
  locale,
  pathPrefix = "",
}: {
  collection: PublicCollection;
  items: readonly PublicItem[];
  locale: SupportedLocale;
  pathPrefix?: string;
}) {
  const labels = getPublicCopy(locale);
  const section = labels.collections[collection];
  const Icon = collectionIcons[collection];

  return (
    <main>
      <header className="bg-[var(--color-carbon)] px-5 py-16 text-white sm:px-8 sm:py-20 lg:px-12 lg:py-24">
        <div className="mx-auto w-full max-w-7xl">
          <p className="font-mono text-xs uppercase text-[var(--color-cyan)]">ANSHOW / {section.eyebrow}</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-6xl">
            {section.title}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--color-muted-inverse)]">
            {section.description}
          </p>
        </div>
      </header>

      <section className="bg-[var(--color-light-surface)] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
        <div className="mx-auto w-full max-w-7xl">
          {items.length ? (
            <div className="grid grid-cols-1 gap-px overflow-hidden bg-black/10 sm:grid-cols-2 xl:grid-cols-6">
              {items.map((item, index) => {
                const isLast = index === items.length - 1;
                const isTabletFeature = items.length % 2 === 1 && isLast;
                const desktopRemainder = items.length % 3;
                const isDesktopFullFeature = isLast && desktopRemainder === 1;
                const isDesktopWideRemainder =
                  desktopRemainder === 2 && index >= items.length - 2;
                const isDesktopFeature = isDesktopFullFeature;
                const desktopFeatureClassName = isDesktopFullFeature
                  ? "xl:col-span-6 xl:grid xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
                  : isDesktopWideRemainder
                    ? "xl:col-span-3"
                    : "xl:col-span-2";
                return (
                <article className={`group bg-white ${isTabletFeature ? "sm:col-span-2" : ""} ${isTabletFeature && !isDesktopFeature ? "xl:col-span-1" : ""} ${desktopFeatureClassName}`} key={item.id}>
                  <PublicMedia compact={!isDesktopFeature && !isDesktopWideRemainder} eager={isTabletFeature || isDesktopFeature || isDesktopWideRemainder} item={item} />
                  <div className={`p-6 sm:p-7 ${isDesktopFeature ? "xl:flex xl:flex-col xl:justify-center" : ""}`}>
                    <Icon aria-hidden="true" className="size-6 text-[var(--color-teal-ink)]" />
                    <h2 className="mt-6 text-2xl font-semibold leading-tight">{item.title}</h2>
                    <p className="mt-3 min-h-24 leading-7 text-black/65">{item.summary}</p>
                    <Link
                      className="mt-5 inline-flex min-h-11 items-center gap-2 font-semibold text-[var(--color-teal-ink)]"
                      href={`${pathPrefix}/${locale}/${collection}/${encodeURIComponent(item.slug)}`}
                    >
                      <span>{labels.learnMore}</span>
                      <span className="sr-only">: {item.title}</span>
                      <ArrowRight
                        aria-hidden="true"
                        className="size-4 transition-transform duration-[var(--motion-fast)] motion-safe:group-hover:translate-x-1"
                      />
                    </Link>
                  </div>
                </article>
                );
              })}
            </div>
          ) : (
            <div className="border-y border-black/10 py-12">
              <p className="max-w-2xl text-lg leading-8 text-black/65">{labels.empty}</p>
            </div>
          )}
        </div>
      </section>
      <QuoteCta locale={locale} pathPrefix={pathPrefix} />
    </main>
  );
}

export function PublicDetailPage({
  collection,
  item,
  locale,
  process,
  pathPrefix = "",
}: {
  collection: PublicCollection;
  item: PublicItem;
  locale: SupportedLocale;
  process?: React.ReactNode;
  pathPrefix?: string;
}) {
  const labels = getPublicCopy(locale);
  const isArticle = collection === "insights" || collection === "case-studies";

  return (
    <main>
      <div className="bg-[var(--color-carbon)] text-white">
        <Breadcrumbs collection={collection} current={item.title} locale={locale} pathPrefix={pathPrefix} />
        <header className="px-5 pb-12 pt-12 sm:px-8 lg:px-12 lg:pb-20 lg:pt-16">
          <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,1.1fr)] lg:items-center">
            <div>
              <p className="font-mono text-xs uppercase text-[var(--color-cyan)]">
                ANSHOW / {labels.collections[collection].eyebrow}
              </p>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-6xl">
                {item.title}
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--color-muted-inverse)]">
                {item.summary}
              </p>
            </div>
            <PublicMedia eager item={item} />
          </div>
        </header>
      </div>

      <section className="bg-white px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
        <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[14rem_minmax(0,46rem)] lg:gap-16">
          <div>
            <p className="font-mono text-xs uppercase text-[var(--color-teal-ink)]">
              {labels.publishedInformation}
            </p>
          </div>
          {isArticle ? (
            <article className="text-lg leading-8 text-black/75">
              <StructuredContent
                body={item.body}
                quoteHref={`${pathPrefix}/${locale}/quote`}
                structuredBody={item.structuredBody}
              />
            </article>
          ) : (
            <div className="text-lg leading-8 text-black/75">
              <StructuredContent
                body={item.body}
                quoteHref={`${pathPrefix}/${locale}/quote`}
                structuredBody={item.structuredBody}
              />
            </div>
          )}
        </div>
      </section>
      {process}
      <QuoteCta locale={locale} pathPrefix={pathPrefix} />
    </main>
  );
}

export function StaticContentPage({
  item,
  locale,
  pathPrefix = "",
}: {
  item: PublicItem;
  locale: SupportedLocale;
  pathPrefix?: string;
}) {
  const labels = getPublicCopy(locale);
  return (
    <main>
      <div className="bg-[var(--color-carbon)] text-white">
        <Breadcrumbs current={item.title} locale={locale} pathPrefix={pathPrefix} />
        <header className="px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
          <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,1.1fr)] lg:items-center">
            <div>
              <p className="font-mono text-xs uppercase text-[var(--color-cyan)]">ANSHOW</p>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-6xl">
                {item.title}
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--color-muted-inverse)]">
                {item.summary}
              </p>
            </div>
            <PublicMedia eager item={item} />
          </div>
        </header>
      </div>
      <section className="px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
        <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[14rem_minmax(0,46rem)] lg:gap-16">
          <p className="font-mono text-xs uppercase text-[var(--color-teal-ink)]">
            {labels.publishedInformation}
          </p>
          <div className="text-lg leading-8 text-black/75">
            <StructuredContent
              body={item.body}
              quoteHref={`${pathPrefix}/${locale}/quote`}
              structuredBody={item.structuredBody}
            />
          </div>
        </div>
      </section>
      <QuoteCta locale={locale} pathPrefix={pathPrefix} />
    </main>
  );
}

export function QuotePage({
  locale,
  pathPrefix = "",
}: {
  locale: SupportedLocale;
  pathPrefix?: string;
}) {
  const labels = getPublicCopy(locale);
  return (
    <main className="bg-[var(--color-carbon)] px-5 py-20 text-white sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto grid min-h-[34rem] w-full max-w-7xl gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.65fr)] lg:items-center">
        <div>
          <p className="font-mono text-xs uppercase text-[var(--color-cyan)]">ANSHOW / {labels.quote.eyebrow}</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-7xl">
            {labels.quote.title}
          </h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-[var(--color-muted-inverse)]">
            {labels.quote.description}
          </p>
        </div>
        <div className="border-l border-[var(--color-border-inverse-strong)] pl-6 sm:pl-10">
          <Route aria-hidden="true" className="size-10 text-[var(--color-cyan)]" />
          <Link
            className="mt-8 inline-flex min-h-12 items-center gap-3 bg-[var(--color-action)] px-5 font-semibold text-[var(--color-carbon)]"
            href={`${pathPrefix}/${locale}/contact`}
          >
            {labels.contact}
            <ArrowRight aria-hidden="true" className="size-5" />
          </Link>
        </div>
      </div>
    </main>
  );
}

export function VerificationPage({
  items,
  locale,
}: {
  items: readonly PublicItem[];
  locale: SupportedLocale;
}) {
  const labels = getPublicCopy(locale);
  return (
    <main>
      <header className="bg-[var(--color-carbon)] px-5 py-16 text-white sm:px-8 sm:py-20 lg:px-12 lg:py-24">
        <div className="mx-auto w-full max-w-7xl">
          <BadgeCheck aria-hidden="true" className="size-9 text-[var(--color-cyan)]" />
          <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-6xl">
            {labels.certifications.title}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--color-muted-inverse)]">
            {labels.certifications.description}
          </p>
        </div>
      </header>
      <section className="px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
        <div className="mx-auto w-full max-w-7xl">
          {items.length ? (
            <ul className="grid gap-px bg-black/10 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <li className="bg-white p-6" key={item.id}>
                  <h2 className="text-xl font-semibold">{item.title}</h2>
                  <p className="mt-3 leading-7 text-black/65">{item.summary}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="border-y border-black/10 py-12 text-lg leading-8 text-black/65">
              {labels.certifications.empty}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
