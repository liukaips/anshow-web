"use client";

import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  LoaderCircle,
  LogOut,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { authClient } from "../../auth/client";
import { requestAdminNavigation } from "./admin-navigation";

type AdminTopbarProps = {
  email: string;
  navigation?: ReactNode;
};

const routeLabels: Record<string, string> = {
  content: "内容",
  pages: "页面",
  "hero-slides": "首屏轮播",
  services: "服务",
  "trade-lanes": "贸易航线",
  "cargo-types": "特种货物",
  "case-studies": "案例",
  articles: "文章",
  partners: "合作伙伴",
  certificates: "资质证书",
  "proof-metrics": "证明指标",
  "navigation-items": "导航项目",
  media: "媒体库",
  inquiries: "询盘",
  staff: "员工与角色",
  settings: "站点设置",
  audit: "审计日志",
};

type Breadcrumb = Readonly<{ href?: string; label: string }>;

function breadcrumbsFor(pathname: string): readonly Breadcrumb[] {
  if (pathname === "/admin") return [{ label: "工作台" }];

  const segments = pathname.split("/").filter(Boolean).slice(1);
  const breadcrumbs: Breadcrumb[] = [{ href: "/admin", label: "工作台" }];
  segments.forEach((segment) => {
    const knownLabel = routeLabels[segment];
    const label = knownLabel ?? (segments[0] === "content" ? "编辑内容" : "详情");
    if (label !== breadcrumbs.at(-1)?.label) breadcrumbs.push({ label });
  });
  return breadcrumbs;
}

type AdminTopbarContentProps = AdminTopbarProps & { pathname: string };

function AdminTopbarContent({
  email,
  navigation,
  pathname,
}: AdminTopbarContentProps) {
  const router = useRouter();
  const actionsRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState("");
  const [openPanel, setOpenPanel] = useState<"account" | "help" | null>(null);
  const [pending, setPending] = useState(false);
  const helpPanelId = `admin-help-${useId()}`;
  const accountPanelId = `admin-account-${useId()}`;
  const breadcrumbs = breadcrumbsFor(pathname);

  useEffect(() => {
    function closeOnDocumentInput(event: KeyboardEvent | PointerEvent) {
      if (!openPanel) return;
      if (
        event.type === "pointerdown" &&
        actionsRef.current?.contains(event.target as Node)
      ) {
        return;
      }
      if (event.type === "keydown" && (event as KeyboardEvent).key !== "Escape") {
        return;
      }

      const trigger =
        openPanel === "account"
          ? accountTriggerRef.current
          : helpTriggerRef.current;
      setOpenPanel(null);
      if (event.type === "keydown") trigger?.focus();
    }
    document.addEventListener("keydown", closeOnDocumentInput);
    document.addEventListener("pointerdown", closeOnDocumentInput);
    return () => {
      document.removeEventListener("keydown", closeOnDocumentInput);
      document.removeEventListener("pointerdown", closeOnDocumentInput);
    };
  }, [openPanel]);

  function togglePanel(name: "account" | "help") {
    setOpenPanel((current) => (current === name ? null : name));
  }

  async function signOut() {
    if (
      !requestAdminNavigation({
        destination: "/admin/login",
        source: "sign-out",
      })
    ) {
      return;
    }
    setError("");
    setPending(true);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setOpenPanel(null);
        setError("退出失败，请重试。");
        return;
      }

      setOpenPanel(null);
      router.replace("/admin/login");
      router.refresh();
    } catch {
      setOpenPanel(null);
      setError("退出失败，请重试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 min-w-0 items-center justify-between border-b border-neutral-200 bg-white px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-11 items-center md:hidden">{navigation}</div>
        <nav aria-label="当前位置" className="min-w-0 overflow-hidden">
          <ol className="flex min-w-0 items-center text-sm text-neutral-600">
            {breadcrumbs.map((breadcrumb, index) => {
              const current = index === breadcrumbs.length - 1;
              return (
                <li
                  className={`${current ? "flex" : "hidden sm:flex"} min-w-0 items-center`}
                  key={`${breadcrumb.label}-${index}`}
                >
                  {index > 0 ? (
                    <ChevronRight
                      aria-hidden="true"
                      className="mx-1 hidden size-4 shrink-0 text-neutral-400 sm:block"
                    />
                  ) : null}
                  {breadcrumb.href && !current ? (
                    <Link
                      className="flex min-h-11 items-center whitespace-nowrap hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                      href={breadcrumb.href}
                    >
                      {breadcrumb.label}
                    </Link>
                  ) : (
                    <span
                      aria-current={current ? "page" : undefined}
                      className={`${current ? "font-medium text-neutral-950" : "hidden sm:inline"} truncate`}
                    >
                      {breadcrumb.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      <div
        className="relative flex shrink-0 items-center gap-1 sm:gap-2"
        ref={actionsRef}
      >
        <button
          aria-controls={helpPanelId}
          aria-expanded={openPanel === "help"}
          aria-label="帮助"
          className="flex min-h-11 items-center gap-2 rounded px-3 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          onClick={() => togglePanel("help")}
          ref={helpTriggerRef}
          type="button"
        >
          <CircleHelp aria-hidden="true" className="size-5" />
          <span className="hidden sm:inline">帮助</span>
        </button>

        <button
          aria-controls={accountPanelId}
          aria-expanded={openPanel === "account"}
          aria-label="账号菜单"
          className="flex min-h-11 max-w-[48vw] items-center gap-2 rounded px-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 sm:max-w-xs sm:px-3"
          onClick={() => togglePanel("account")}
          ref={accountTriggerRef}
          type="button"
        >
          <UserRound aria-hidden="true" className="size-5 shrink-0" />
          <span className="hidden min-w-0 truncate sm:inline" title={email}>
            {email}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`size-4 shrink-0 transition-transform motion-reduce:transition-none ${
              openPanel === "account" ? "rotate-180" : ""
            }`}
          />
        </button>

        {openPanel === "help" ? (
          <section
            aria-label="使用帮助"
            className="absolute right-0 top-[calc(100%+0.5rem)] w-[min(20rem,calc(100vw-1.5rem))] border border-neutral-200 bg-white p-4 shadow-lg"
            id={helpPanelId}
          >
            <h2 className="text-sm font-semibold text-neutral-950">使用帮助</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              遇到内容、审核或权限问题，请联系系统管理员。
            </p>
          </section>
        ) : null}

        {openPanel === "account" ? (
          <section
            aria-label="账号信息"
            className="absolute right-0 top-[calc(100%+0.5rem)] w-[min(20rem,calc(100vw-1.5rem))] border border-neutral-200 bg-white p-2 shadow-lg"
            id={accountPanelId}
          >
            <div className="border-b border-neutral-200 px-3 py-3">
              <p className="text-xs text-neutral-500">当前账号</p>
              <p className="mt-1 break-all text-sm font-medium text-neutral-900">
                {email}
              </p>
            </div>
            <button
              aria-label="退出登录"
              className="mt-1 flex min-h-11 w-full items-center gap-2 rounded px-3 text-left text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-wait disabled:opacity-50"
              disabled={pending}
              onClick={signOut}
              type="button"
            >
              {pending ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-5 animate-spin motion-reduce:animate-none"
                />
              ) : (
                <LogOut aria-hidden="true" className="size-5" strokeWidth={1.8} />
              )}
              {pending ? "正在退出" : "退出登录"}
            </button>
          </section>
        ) : null}
      </div>

      {error ? (
        <p
          className="absolute right-3 top-[calc(100%+0.5rem)] flex max-w-[calc(100vw-1.5rem)] items-start gap-2 border border-red-200 bg-white px-3 py-2 text-sm text-red-800 shadow-lg sm:right-5"
          role="alert"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </header>
  );
}

export function AdminTopbar(props: AdminTopbarProps) {
  const pathname = usePathname();
  return <AdminTopbarContent key={pathname} pathname={pathname} {...props} />;
}
