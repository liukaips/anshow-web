import Link from "next/link";

import { AnShowLogo } from "../brand/anshow-logo";
import type { SupportedLocale } from "../../lib/app-config";
import { LocaleSwitcher } from "./locale-switcher";
import { MobileMenu } from "./mobile-menu";

const navigationItems = [
  ["services", "services"],
  ["tradeLanes", "trade-lanes"],
  ["specialCargo", "special-cargo"],
  ["insights", "insights"],
  ["about", "about"],
  ["contact", "contact"],
] as const;

export type SiteHeaderLabels = {
  about: string;
  changeLanguage: string;
  closeMenu: string;
  contact: string;
  home: string;
  insights: string;
  languageMenu: string;
  mobileNavigation: string;
  openMenu: string;
  primary: string;
  quote: string;
  services: string;
  specialCargo: string;
  tradeLanes: string;
};

type SiteHeaderProps = {
  alternates?: Partial<Record<SupportedLocale, string>>;
  labels: SiteHeaderLabels;
  locale: SupportedLocale;
};

export function SiteHeader({
  alternates = {},
  labels,
  locale,
}: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border-inverse)] bg-[var(--color-carbon)] text-[var(--color-text-inverse)]">
      <nav
        aria-label={labels.primary}
        className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8"
      >
        <Link
          aria-label={labels.home}
          className="flex min-h-11 min-w-11 items-center text-[var(--color-text-inverse)]"
          href={`/${locale}`}
        >
          <AnShowLogo markClassName="size-8" />
        </Link>

        <div className="hidden min-w-0 items-center justify-center gap-5 xl:flex">
          {navigationItems.map(([key, path]) => (
            <Link
              className="flex min-h-11 items-center text-sm font-medium text-[var(--color-muted-inverse)] hover:text-[var(--color-cyan)]"
              href={`/${locale}/${path}`}
              key={key}
            >
              {labels[key]}
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <LocaleSwitcher
            alternates={alternates}
            current={locale}
            label={labels.changeLanguage}
            menuLabel={labels.languageMenu}
          />
          <Link
            className="hidden min-h-11 items-center justify-center bg-[var(--color-action)] px-4 text-center text-sm font-semibold text-[var(--color-carbon)] transition-transform duration-[var(--motion-fast)] motion-safe:hover:-translate-y-px sm:flex"
            href={`/${locale}/quote`}
          >
            {labels.quote}
          </Link>
          <MobileMenu labels={labels} locale={locale} />
        </div>
      </nav>
    </header>
  );
}
