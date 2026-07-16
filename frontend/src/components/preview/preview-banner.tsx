import { Eye, LockKeyhole } from "lucide-react";
import Link from "next/link";

export function PreviewBanner({ adminHref }: { adminHref: string; locale: "en" | "zh" | "ru" }) {
  return (
    <aside className="sticky top-0 z-[100] border-b border-amber-300 bg-amber-50 px-4 text-amber-950 shadow-sm">
      <div className="mx-auto flex min-h-14 max-w-7xl flex-col justify-center gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Eye aria-hidden="true" className="size-5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">网站预览环境</p>
            <p className="text-xs leading-5 text-amber-900">此页面不会被搜索引擎收录，也不会影响正式网站。</p>
          </div>
        </div>
        <Link className="inline-flex min-h-11 shrink-0 items-center gap-2 font-semibold underline underline-offset-4" href={adminHref}>
          <LockKeyhole aria-hidden="true" className="size-4" />
          返回发布中心
        </Link>
      </div>
    </aside>
  );
}
