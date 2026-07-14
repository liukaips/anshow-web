import Link from "next/link";

import { AnShowLogo } from "../brand/anshow-logo";
import type { SupportedLocale } from "../../lib/app-config";

export type SiteFooterLabels = {
  about: string;
  contact: string;
  cookies: string;
  description: string;
  insights: string;
  legal: string;
  navigation: string;
  privacy: string;
  quote: string;
  quotePrompt: string;
  services: string;
  terms: string;
  tradeLanes: string;
};

type SiteFooterProps = {
  labels: SiteFooterLabels;
  locale: SupportedLocale;
};

const linkClassName =
  "flex min-h-11 items-center py-2 text-base text-[var(--color-muted-inverse)] hover:text-[var(--color-cyan)]";

export function SiteFooter({ labels, locale }: SiteFooterProps) {
  return (
    <footer className="border-t border-[var(--color-border-inverse)] bg-[var(--color-dark-surface)] text-[var(--color-text-inverse)]">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1.2fr] lg:px-8 lg:py-16">
        <div>
          <Link className="inline-flex min-h-11 items-center" href={`/${locale}`}>
            <AnShowLogo markClassName="size-8" />
          </Link>
          <p className="mt-4 max-w-sm text-base leading-7 text-[var(--color-muted-inverse)]">
            {labels.description}
          </p>
        </div>

        <nav aria-label={labels.navigation}>
          <h2 className="text-sm font-semibold text-[var(--color-text-inverse)]">
            {labels.navigation}
          </h2>
          <div className="mt-3">
            <Link className={linkClassName} href={`/${locale}/services`}>
              {labels.services}
            </Link>
            <Link className={linkClassName} href={`/${locale}/trade-lanes`}>
              {labels.tradeLanes}
            </Link>
            <Link className={linkClassName} href={`/${locale}/insights`}>
              {labels.insights}
            </Link>
          </div>
        </nav>

        <nav aria-label={labels.legal}>
          <h2 className="text-sm font-semibold text-[var(--color-text-inverse)]">
            {labels.legal}
          </h2>
          <div className="mt-3">
            <Link className={linkClassName} href={`/${locale}/about`}>
              {labels.about}
            </Link>
            <Link className={linkClassName} href={`/${locale}/privacy`}>
              {labels.privacy}
            </Link>
            <Link className={linkClassName} href={`/${locale}/terms`}>
              {labels.terms}
            </Link>
            <Link className={linkClassName} href={`/${locale}/cookies`}>
              {labels.cookies}
            </Link>
          </div>
        </nav>

        <div className="border-t border-[var(--color-border-inverse)] pt-8 md:border-t-0 md:pt-0">
          <p className="max-w-xs text-lg font-semibold leading-7">
            {labels.quotePrompt}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              className="flex min-h-11 items-center bg-[var(--color-action)] px-4 font-semibold text-[var(--color-carbon)] transition-transform duration-[var(--motion-fast)] motion-safe:hover:-translate-y-px"
              href={`/${locale}/quote`}
            >
              {labels.quote}
            </Link>
            <Link
              className="flex min-h-11 items-center border border-[var(--color-border-inverse-strong)] px-4 font-semibold hover:border-[var(--color-cyan)] hover:text-[var(--color-cyan)]"
              href={`/${locale}/contact`}
            >
              {labels.contact}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
