"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { SupportedLocale } from "../../lib/app-config";
import type { SiteHeaderLabels } from "./site-header";

const navigationItems = [
  ["services", "services"],
  ["tradeLanes", "trade-lanes"],
  ["specialCargo", "special-cargo"],
  ["insights", "insights"],
  ["about", "about"],
  ["contact", "contact"],
] as const;

const focusableSelector =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

type MobileMenuProps = {
  labels: SiteHeaderLabels;
  locale: SupportedLocale;
};

export function MobileMenu({ labels, locale }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      );
      const first = focusable[0];
      const last = focusable.at(-1);

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  return (
    <div className="xl:hidden">
      <button
        aria-expanded={open}
        aria-label={labels.openMenu}
        className="grid size-11 cursor-pointer place-items-center text-[var(--color-text-inverse)] hover:text-[var(--color-cyan)]"
        onClick={() => setOpen(true)}
        ref={triggerRef}
        title={labels.openMenu}
        type="button"
      >
        <Menu aria-hidden="true" className="size-6" strokeWidth={1.8} />
      </button>

      {open ? (
        <div
          aria-label={labels.mobileNavigation}
          aria-modal="true"
          className="shell-drawer fixed inset-0 z-[100] min-h-dvh overflow-y-auto bg-[var(--color-carbon)] text-[var(--color-text-inverse)]"
          ref={dialogRef}
          role="dialog"
        >
          <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
            <div className="flex min-h-14 items-center justify-between border-b border-[var(--color-border-inverse)]">
              <span className="font-display text-lg font-semibold">AnShow</span>
              <button
                aria-label={labels.closeMenu}
                className="grid size-11 cursor-pointer place-items-center hover:text-[var(--color-cyan)]"
                onClick={() => setOpen(false)}
                ref={closeRef}
                title={labels.closeMenu}
                type="button"
              >
                <X aria-hidden="true" className="size-6" strokeWidth={1.8} />
              </button>
            </div>

            <nav
              aria-label={labels.mobileNavigation}
              className="flex flex-1 flex-col py-8"
            >
              {navigationItems.map(([key, path]) => (
                <Link
                  className="flex min-h-14 items-center border-b border-[var(--color-divider-inverse)] py-3 text-xl leading-snug hover:text-[var(--color-cyan)] sm:text-2xl"
                  href={`/${locale}/${path}`}
                  key={key}
                  onClick={() => setOpen(false)}
                >
                  {labels[key]}
                </Link>
              ))}
              <Link
                className="mt-8 flex min-h-11 w-full items-center justify-center bg-[var(--color-action)] px-5 py-3 text-center font-semibold text-[var(--color-carbon)] transition-transform duration-[var(--motion-fast)] motion-safe:hover:-translate-y-px sm:w-fit"
                href={`/${locale}/quote`}
                onClick={() => setOpen(false)}
              >
                {labels.quote}
              </Link>
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
}
