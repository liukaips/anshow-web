"use client";

import { Languages } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { refreshPublishedUrls } from "../../api/public-content.browser";
import {
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "../../lib/app-config";

const localeNames: Record<SupportedLocale, string> = {
  en: "English",
  ru: "Русский",
  zh: "中文",
};

type LocaleSwitcherProps = {
  alternates: Partial<Record<SupportedLocale, string>>;
  current: SupportedLocale;
  label: string;
  menuLabel: string;
};

export function LocaleSwitcher({
  alternates,
  current,
  label,
  menuLabel,
}: LocaleSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [publishedResolution, setPublishedResolution] = useState<{
    pathname: string;
    alternates: Partial<Record<SupportedLocale, string>>;
  } | null>(null);
  const pathname = usePathname();
  const needsPublishedResolution =
    pathname.startsWith(`/${current}/`) &&
    pathname !== `/${current}/`;
  const resolutionPending =
    needsPublishedResolution && publishedResolution?.pathname !== pathname;
  const resolvedAlternates =
    publishedResolution?.pathname === pathname
      ? { ...alternates, ...publishedResolution.alternates }
      : alternates;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const currentLocaleRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (
      pathname === `/${current}` ||
      pathname === `/${current}/` ||
      !pathname.startsWith(`/${current}/`)
    ) {
      return;
    }
    let active = true;
    void refreshPublishedUrls()
      .then((records) => {
        if (!active) return;
        const currentRecord = records.find((record) => record.path === pathname);
        setPublishedResolution({
          alternates: currentRecord?.alternates ?? {},
          pathname,
        });
      })
      .catch(() => {
        if (active) setPublishedResolution({ alternates: {}, pathname });
      });
    return () => {
      active = false;
    };
  }, [alternates, current, pathname]);

  useEffect(() => {
    if (!open) return;

    currentLocaleRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-controls="locale-menu"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        aria-busy={resolutionPending}
        className="grid size-11 cursor-pointer place-items-center text-[var(--color-text-inverse)] hover:text-[var(--color-cyan)] disabled:cursor-wait disabled:opacity-50"
        onClick={() => setOpen((value) => !value)}
        disabled={resolutionPending}
        ref={triggerRef}
        title={label}
        type="button"
      >
        <Languages aria-hidden="true" className="size-5" strokeWidth={1.8} />
      </button>

      {open ? (
        <div
          aria-label={menuLabel}
          className="shell-popover absolute right-0 top-[calc(100%+0.5rem)] z-[70] min-w-44 border border-[var(--color-border-inverse)] bg-[var(--color-dark-surface)] p-2"
          id="locale-menu"
          role="menu"
        >
          {SUPPORTED_LOCALES.map((locale) => (
            <Link
              aria-current={locale === current ? "page" : undefined}
              className="flex min-h-11 items-center border-l-2 border-transparent px-3 py-2 text-base text-[var(--color-text-inverse)] hover:border-[var(--color-cyan)] hover:bg-[var(--color-hover-inverse)] aria-[current=page]:border-[var(--color-teal)] aria-[current=page]:text-[var(--color-cyan)]"
              href={resolvedAlternates[locale] ?? `/${locale}`}
              hrefLang={locale}
              key={locale}
              onClick={() => setOpen(false)}
              ref={locale === current ? currentLocaleRef : undefined}
              role="menuitem"
            >
              {localeNames[locale]}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
