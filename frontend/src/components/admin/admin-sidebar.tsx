"use client";

import {
  BookOpenText,
  Boxes,
  FileText,
  Gauge,
  ImageIcon,
  Layers3,
  Menu,
  MessagesSquare,
  Newspaper,
  Route,
  Settings,
  ShieldCheck,
  ShipWheel,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AnShowLogo } from "../brand/anshow-logo";

type AdminSidebarProps = {
  permissions: readonly string[];
};

type NavigationItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  permission: string;
  section: "Workspace" | "Content" | "Operations" | "System";
};

const navigationItems: readonly NavigationItem[] = [
  {
    href: "/admin",
    icon: Gauge,
    label: "Dashboard",
    permission: "content.read",
    section: "Workspace",
  },
  {
    href: "/admin/content/pages",
    icon: FileText,
    label: "Pages",
    permission: "content.read",
    section: "Content",
  },
  {
    href: "/admin/content/hero-slides",
    icon: Layers3,
    label: "Hero Slides",
    permission: "content.read",
    section: "Content",
  },
  {
    href: "/admin/content/services",
    icon: Boxes,
    label: "Services",
    permission: "content.read",
    section: "Content",
  },
  {
    href: "/admin/content/trade-lanes",
    icon: Route,
    label: "Trade Lanes",
    permission: "content.read",
    section: "Content",
  },
  {
    href: "/admin/content/cargo-types",
    icon: ShipWheel,
    label: "Special Cargo",
    permission: "content.read",
    section: "Content",
  },
  {
    href: "/admin/content/editorial",
    icon: Newspaper,
    label: "Cases & Insights",
    permission: "content.read",
    section: "Content",
  },
  {
    href: "/admin/media",
    icon: ImageIcon,
    label: "Media Library",
    permission: "media.read",
    section: "Operations",
  },
  {
    href: "/admin/inquiries",
    icon: MessagesSquare,
    label: "Enquiries",
    permission: "inquiry.read",
    section: "Operations",
  },
  {
    href: "/admin/staff",
    icon: UsersRound,
    label: "Staff & Roles",
    permission: "staff.manage",
    section: "System",
  },
  {
    href: "/admin/settings",
    icon: Settings,
    label: "Site Settings",
    permission: "settings.manage",
    section: "System",
  },
  {
    href: "/admin/audit",
    icon: BookOpenText,
    label: "Audit Log",
    permission: "audit.read",
    section: "System",
  },
] as const;

const sections = ["Workspace", "Content", "Operations", "System"] as const;
const focusableSelector =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isCurrentRoute(pathname: string, href: string) {
  return href === "/admin"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLinks({
  closeNavigation,
  permissions,
}: AdminSidebarProps & { closeNavigation?: () => void }) {
  const pathname = usePathname();
  const authorizedItems = navigationItems.filter((item) =>
    permissions.includes(item.permission),
  );

  return (
    <nav aria-label="Administration" className="flex flex-1 flex-col gap-5">
      {sections.map((section) => {
        const items = authorizedItems.filter((item) => item.section === section);
        if (items.length === 0) return null;

        return (
          <div key={section}>
            <p className="mb-1 px-3 text-xs font-semibold uppercase text-[var(--color-muted-inverse)]">
              {section}
            </p>
            <div className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                const current = isCurrentRoute(pathname, item.href);

                return (
                  <Link
                    aria-current={current ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-3 border-l-2 px-3 py-2 text-sm font-medium transition-colors duration-[var(--motion-fast)] ${
                      current
                        ? "border-[var(--color-cyan)] bg-white/10 text-white"
                        : "border-transparent text-[var(--color-muted-inverse)] hover:bg-white/5 hover:text-white"
                    }`}
                    href={item.href}
                    key={item.href}
                    onClick={closeNavigation}
                  >
                    <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.8} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarBody({
  closeNavigation,
  permissions,
}: AdminSidebarProps & { closeNavigation?: () => void }) {
  return (
    <>
      <div className="flex min-h-16 items-center border-b border-[var(--color-border-inverse)] px-5">
        <AnShowLogo className="text-white" />
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto px-3 py-5">
        <NavigationLinks
          closeNavigation={closeNavigation}
          permissions={permissions}
        />
        <div className="mt-6 border-t border-[var(--color-border-inverse)] px-3 pt-4">
          <div className="flex items-center gap-2 text-xs text-[var(--color-muted-inverse)]">
            <ShieldCheck aria-hidden="true" className="size-4 text-[var(--color-teal)]" />
            Permission-aware workspace
          </div>
        </div>
      </div>
    </>
  );
}

export function AdminSidebar({ permissions }: AdminSidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col bg-[var(--color-carbon)] text-[var(--color-text-inverse)] md:flex">
      <SidebarBody permissions={permissions} />
    </aside>
  );
}

export function AdminMobileNavigation({ permissions }: AdminSidebarProps) {
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
    <div className="md:hidden">
      <button
        aria-expanded={open}
        aria-label="Open navigation"
        className="grid size-11 cursor-pointer place-items-center text-[var(--color-text)] transition-colors duration-[var(--motion-fast)] hover:bg-black/5"
        onClick={() => setOpen(true)}
        ref={triggerRef}
        title="Open navigation"
        type="button"
      >
        <Menu aria-hidden="true" className="size-5" strokeWidth={1.8} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-40">
          <button
            aria-hidden="true"
            className="absolute inset-0 cursor-default bg-black/60"
            onClick={() => setOpen(false)}
            tabIndex={-1}
            type="button"
          />
          <div
            aria-label="Administration navigation"
            aria-modal="true"
            className="shell-drawer absolute inset-y-0 left-0 z-50 flex w-[min(20rem,88vw)] flex-col bg-[var(--color-carbon)] text-[var(--color-text-inverse)] shadow-2xl shadow-black/40"
            ref={dialogRef}
            role="dialog"
          >
            <div className="flex min-h-16 items-center justify-between border-b border-[var(--color-border-inverse)] pl-5 pr-2">
              <AnShowLogo className="text-white" />
              <button
                aria-label="Close navigation"
                className="grid size-11 cursor-pointer place-items-center transition-colors duration-[var(--motion-fast)] hover:bg-white/10 hover:text-[var(--color-cyan)]"
                onClick={() => setOpen(false)}
                ref={closeRef}
                title="Close navigation"
                type="button"
              >
                <X aria-hidden="true" className="size-5" strokeWidth={1.8} />
              </button>
            </div>
            <div className="flex flex-1 flex-col overflow-y-auto px-3 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <NavigationLinks
                closeNavigation={() => setOpen(false)}
                permissions={permissions}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
