import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleGauge,
  Languages,
  MessageSquareText,
  Send,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import type { AdminDashboardData } from "@/api/admin-dashboard.server";
import { collectionLabels } from "@/components/admin/content/content-labels";
import { formatInquiryTime, INQUIRY_PRIORITY_LABELS, INQUIRY_STATUS_LABELS } from "@/components/admin/inquiries/inquiry-labels";

const auditLabels: Record<string, string> = {
  "content.create": "创建内容",
  "content.publish": "发布内容",
  "content.review.approve": "通过内容审核",
  "content.review.reject": "退回内容修改",
  "inquiry.assign": "分配询盘负责人",
  "inquiry.status.update": "更新询盘状态",
  "inquiry.note.add": "添加跟进记录",
  "staff.roles.update": "调整员工角色",
  "settings.update": "更新系统设置",
};

type Metric = Readonly<{
  href: string;
  icon: typeof Send;
  label: string;
  tone: string;
  value: number;
}>;

export function AdminDashboard({ data }: Readonly<{ data: AdminDashboardData }>) {
  const metrics: readonly Metric[] = [
    { href: "/admin/inquiries?status=new", icon: MessageSquareText, label: "新询盘", tone: "text-sky-700 bg-sky-50", value: data.newInquiries },
    { href: "/admin/inquiries?priority=high", icon: AlertTriangle, label: "高优先级", tone: "text-red-700 bg-red-50", value: data.highPriorityInquiries },
    { href: "/admin/reviews", icon: ShieldCheck, label: "待审核", tone: "text-amber-800 bg-amber-50", value: data.reviewPending },
    { href: "/admin/content/services", icon: Languages, label: "待确认翻译", tone: "text-indigo-700 bg-indigo-50", value: data.translationPending },
    { href: "/admin/publish", icon: Send, label: "本周已发布", tone: "text-emerald-700 bg-emerald-50", value: data.publishedThisWeek },
  ];
  const hasTasks = data.tasks.inquiries.length > 0 || data.tasks.reviews.length > 0;

  return (
    <div className="grid min-w-0 gap-6">
      <section aria-labelledby="metrics-title" className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-neutral-950" id="metrics-title">今日工作</h2>
          <p className="text-xs text-neutral-500">数据实时更新</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Link
                aria-label={`${metric.label} ${metric.value}，查看详情`}
                className="group flex min-h-28 items-start justify-between gap-3 rounded border border-neutral-200 bg-white p-4 transition-[border-color,box-shadow] duration-200 hover:border-neutral-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                href={metric.href}
                key={metric.label}
              >
                <div><p className="text-sm text-neutral-600">{metric.label}</p><p className="mt-3 text-3xl font-semibold tabular-nums text-neutral-950">{metric.value}</p></div>
                <span className={`grid size-10 shrink-0 place-items-center rounded ${metric.tone}`}><Icon aria-hidden="true" className="size-5" /></span>
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="tasks-title" className="grid gap-3">
        <h2 className="text-base font-semibold text-neutral-950" id="tasks-title">我的待办</h2>
        {!hasTasks ? (
          <div className="flex min-h-32 items-center gap-3 border border-neutral-200 bg-white px-5 py-6">
            <CheckCircle2 aria-hidden="true" className="size-6 text-emerald-700" />
            <div><p className="font-medium text-neutral-950">当前没有分配给你的待办</p><p className="mt-1 text-sm text-neutral-600">新的询盘或审核任务出现后会在这里显示。</p></div>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="min-w-0 border border-neutral-200 bg-white">
              <div className="flex min-h-12 items-center justify-between border-b border-neutral-200 px-4"><h3 className="font-medium text-neutral-950">待跟进询盘</h3><Link className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-[var(--color-cyan-ink)]" href="/admin/inquiries">查看全部<ArrowRight aria-hidden="true" className="size-4" /></Link></div>
              {data.tasks.inquiries.length > 0 ? <ul className="divide-y divide-neutral-200">{data.tasks.inquiries.map((task) => <li key={task.id}><Link aria-label={`${task.name}，${INQUIRY_PRIORITY_LABELS[task.priority]}优先级，查看询盘`} className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50" href={`/admin/inquiries?selected=${encodeURIComponent(task.id)}`}><div className="min-w-0"><p className="truncate font-medium text-neutral-950">{task.name}</p><p className="mt-1 truncate text-xs text-neutral-500">{task.company || "未填写公司"} · {INQUIRY_STATUS_LABELS[task.status]}</p></div><div className="shrink-0 text-right"><p className="text-xs font-medium text-neutral-700">{INQUIRY_PRIORITY_LABELS[task.priority]}</p><p className="mt-1 text-xs tabular-nums text-neutral-500">{formatInquiryTime(task.updatedAt)}</p></div></Link></li>)}</ul> : <p className="px-4 py-8 text-center text-sm text-neutral-500">暂无分配给你的询盘</p>}
            </div>
            <div className="min-w-0 border border-neutral-200 bg-white">
              <div className="flex min-h-12 items-center justify-between border-b border-neutral-200 px-4"><h3 className="font-medium text-neutral-950">待审核内容</h3><Link className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-[var(--color-cyan-ink)]" href="/admin/reviews">进入审核中心<ArrowRight aria-hidden="true" className="size-4" /></Link></div>
              {data.tasks.reviews.length > 0 ? <ul className="divide-y divide-neutral-200">{data.tasks.reviews.map((task) => <li className="flex min-h-16 items-center justify-between gap-3 px-4 py-3" key={task.id}><div className="min-w-0"><p className="font-medium text-neutral-950">{collectionLabels[task.entityType as keyof typeof collectionLabels] ?? "网站内容"}</p><p className="mt-1 text-xs text-neutral-500">版本 {task.sourceVersion} · {new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "medium", timeStyle: "short" }).format(new Date(task.submittedAt))}</p></div><Link className="inline-flex min-h-11 shrink-0 items-center rounded px-3 text-sm font-medium text-[var(--color-cyan-ink)] hover:bg-sky-50" href="/admin/reviews">去审核</Link></li>)}</ul> : <p className="px-4 py-8 text-center text-sm text-neutral-500">暂无待审核内容</p>}
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="activity-title" className="min-w-0 border border-neutral-200 bg-white">
          <div className="flex min-h-12 items-center justify-between border-b border-neutral-200 px-4"><h2 className="flex items-center gap-2 font-semibold text-neutral-950" id="activity-title"><Activity aria-hidden="true" className="size-4" />最近活动</h2>{data.recentAuditEvents.length > 0 ? <Link className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-cyan-ink)]" href="/admin/audit">查看审计日志</Link> : null}</div>
          {data.recentAuditEvents.length > 0 ? <ol className="divide-y divide-neutral-200">{data.recentAuditEvents.slice(0, 6).map((event) => <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 text-sm" key={event.id}><div><p className="font-medium text-neutral-900">{auditLabels[event.action] ?? "系统操作"}</p><p className="mt-1 text-xs text-neutral-500">操作人：{event.actorId}</p></div><time className="text-xs tabular-nums text-neutral-500" dateTime={event.createdAt}>{new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(event.createdAt))}</time></li>)}</ol> : <p className="px-4 py-8 text-center text-sm text-neutral-500">你没有查看审计详情的权限，或暂时没有操作记录。</p>}
        </section>

        <section aria-labelledby="health-title" className="border border-neutral-200 bg-white p-4">
          <h2 className="flex items-center gap-2 font-semibold text-neutral-950" id="health-title"><CircleGauge aria-hidden="true" className="size-4" />系统状态</h2>
          <div className={`mt-4 flex items-start gap-3 rounded border p-3 ${data.systemHealth === "normal" ? "border-emerald-200 bg-emerald-50" : data.systemHealth === "warning" ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`}>
            {data.systemHealth === "normal" ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-700" /> : <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-800" />}
            <div><p className="text-sm font-semibold text-neutral-950">{data.systemHealth === "normal" ? "运行正常" : data.systemHealth === "warning" ? "部分服务需要处理" : "服务暂不可用"}</p><p className="mt-1 text-xs leading-5 text-neutral-600">{data.systemHealth === "normal" ? "翻译和询盘通知队列没有失败任务。" : "请到系统设置检查翻译或通知服务状态。"}</p></div>
          </div>
          <Link className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-[var(--color-cyan-ink)]" href="/admin/settings">查看系统设置<ArrowRight aria-hidden="true" className="size-4" /></Link>
        </section>
      </div>
    </div>
  );
}
