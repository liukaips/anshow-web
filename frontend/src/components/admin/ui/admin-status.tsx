import {
  Archive,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  Clock3,
  Languages,
} from "lucide-react";

export type AdminDisplayStatus =
  | "draft"
  | "translation_pending"
  | "review_pending"
  | "changes_requested"
  | "approved"
  | "scheduled"
  | "published"
  | "archived";

export const ADMIN_STATUS_LABELS: Record<AdminDisplayStatus, string> = {
  draft: "草稿",
  translation_pending: "翻译待确认",
  review_pending: "待审核",
  changes_requested: "需修改",
  approved: "已批准",
  scheduled: "定时发布",
  published: "已发布",
  archived: "已归档",
};

const STATUS_STYLES: Record<AdminDisplayStatus, string> = {
  draft: "border-neutral-300 bg-neutral-100 text-neutral-700",
  translation_pending: "border-sky-200 bg-sky-50 text-sky-800",
  review_pending: "border-amber-200 bg-amber-50 text-amber-800",
  changes_requested: "border-red-200 bg-red-50 text-red-800",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  scheduled: "border-indigo-200 bg-indigo-50 text-indigo-800",
  published: "border-emerald-200 bg-emerald-50 text-emerald-800",
  archived: "border-neutral-300 bg-neutral-100 text-neutral-600",
};

const STATUS_ICONS = {
  draft: Clock3,
  translation_pending: Languages,
  review_pending: Clock3,
  changes_requested: CircleAlert,
  approved: CircleCheck,
  scheduled: CalendarClock,
  published: CircleCheck,
  archived: Archive,
} satisfies Record<AdminDisplayStatus, typeof Clock3>;

export function AdminStatus({ status }: Readonly<{ status: AdminDisplayStatus }>) {
  const Icon = STATUS_ICONS[status];
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}
      data-status={status}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {ADMIN_STATUS_LABELS[status]}
    </span>
  );
}
