"use client";

import { BellRing, CircleAlert, Mail, MapPin, Phone, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  addAdminInquiryNote,
  assignAdminInquiry,
  getAdminInquiry,
  retryAdminInquiryNotification,
  updateAdminInquiryPriority,
  updateAdminInquiryStatus,
  type AdminInquiryDetail,
  type AdminInquiryPriority,
  type AdminInquiryStatus,
} from "@/api/admin-inquiries";
import { ApiError } from "@/api/http";

import { AdminToast } from "../ui/admin-feedback";
import {
  formatInquiryTime,
  INQUIRY_PRIORITY_LABELS,
  INQUIRY_STATUS_LABELS,
} from "./inquiry-labels";

const statusTransitions: Record<AdminInquiryStatus, readonly AdminInquiryStatus[]> = {
  new: ["pending_follow_up", "in_progress", "closed", "spam"],
  pending_follow_up: ["in_progress", "waiting_customer", "closed", "spam"],
  in_progress: ["pending_follow_up", "waiting_customer", "completed", "closed", "spam"],
  waiting_customer: ["pending_follow_up", "in_progress", "completed", "spam"],
  completed: ["in_progress", "closed"],
  closed: ["in_progress"],
  spam: ["new"],
};

type InquiryDetailProps = Readonly<{
  assignees?: readonly { id: string; name: string; email: string }[];
  canAddNote: boolean;
  canAssign: boolean;
  canChangeStatus: boolean;
  canRetry: boolean;
  inquiry: AdminInquiryDetail;
  onClose: () => void;
  onUpdated: (inquiry: AdminInquiryDetail) => void;
}>;

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return `${error.message}${error.requestId ? `（请求编号：${error.requestId}）` : ""}`;
  }
  return error instanceof Error ? error.message : "操作失败，请稍后重试";
}

export function InquiryDetail({
  assignees = [],
  canAddNote,
  canAssign,
  canChangeStatus,
  canRetry,
  inquiry: initialInquiry,
  onClose,
  onUpdated,
}: InquiryDetailProps) {
  const [inquiry, setInquiry] = useState(initialInquiry);
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [assigneeId, setAssigneeId] = useState(inquiry.assigneeId ?? "");
  const panelRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const possibleStatuses = useMemo(() => statusTransitions[inquiry.status], [inquiry.status]);

  const close = useCallback(() => {
    setVisible(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus.current?.focus();
    };
  }, [close]);

  async function refresh() {
    const updated = await getAdminInquiry(inquiry.id);
    setInquiry(updated);
    onUpdated(updated);
  }

  async function run(key: string, command: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await command();
      await refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-100 flex justify-end bg-black/50" role="presentation">
      <section
        aria-label="询盘详情"
        aria-modal="true"
        className="h-dvh w-full max-w-2xl overflow-y-auto bg-white shadow-2xl outline-none motion-safe:animate-[admin-drawer-in_200ms_ease-out]"
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium text-neutral-500">询盘详情</p>
            <h2 className="truncate text-lg font-semibold text-neutral-950">{inquiry.name}</h2>
          </div>
          <button
            aria-label="关闭询盘详情"
            className="grid size-11 shrink-0 place-items-center rounded transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            onClick={close}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </header>

        <div className="grid gap-0">
          {error ? <div className="px-4 pt-4 sm:px-6"><AdminToast message={error} onDismiss={() => setError(null)} tone="error" /></div> : null}

          <section className="grid gap-4 border-b border-neutral-200 px-4 py-5 sm:px-6" aria-labelledby="contact-title">
            <h3 className="font-semibold text-neutral-950" id="contact-title">客户信息</h3>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-neutral-500">客户</dt><dd className="mt-1 font-medium text-neutral-950">{inquiry.name}</dd></div>
              <div><dt className="text-neutral-500">公司</dt><dd className="mt-1 text-neutral-900">{inquiry.company || "未填写"}</dd></div>
              <div><dt className="flex items-center gap-1 text-neutral-500"><Mail aria-hidden="true" className="size-4" />邮箱</dt><dd className="mt-1 break-all"><a className="text-[var(--color-cyan-ink)] underline-offset-4 hover:underline" href={`mailto:${inquiry.email}`}>{inquiry.email}</a></dd></div>
              <div><dt className="flex items-center gap-1 text-neutral-500"><Phone aria-hidden="true" className="size-4" />电话</dt><dd className="mt-1"><a className="text-[var(--color-cyan-ink)] underline-offset-4 hover:underline" href={`tel:${inquiry.phone}`}>{inquiry.phone || "未填写"}</a></dd></div>
            </dl>
          </section>

          <section className="grid gap-4 border-b border-neutral-200 px-4 py-5 sm:px-6" aria-labelledby="need-title">
            <h3 className="font-semibold text-neutral-950" id="need-title">运输需求</h3>
            <div className="flex items-start gap-2 text-sm"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-neutral-500" /><div><p className="font-medium text-neutral-950">{inquiry.transportNeed}</p><p className="mt-2 whitespace-pre-wrap leading-6 text-neutral-700">{inquiry.message}</p></div></div>
            <p className="text-xs text-neutral-500">客户已同意隐私政策 {inquiry.privacyVersion}，提交时间 {formatInquiryTime(inquiry.consentedAt)}</p>
          </section>

          <section className="grid gap-4 border-b border-neutral-200 px-4 py-5 sm:px-6" aria-labelledby="follow-title">
            <h3 className="font-semibold text-neutral-950" id="follow-title">跟进设置</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium text-neutral-800">负责人
                <select className="min-h-11 rounded border border-neutral-300 bg-white px-3 text-base sm:text-sm" disabled={!canAssign || busy !== null} onChange={(event) => setAssigneeId(event.target.value)} value={assigneeId}>
                  <option value="">未分配</option>
                  {assignees.map((person) => <option key={person.id} value={person.id}>{person.name}（{person.email}）</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-neutral-800">优先级
                <select className="min-h-11 rounded border border-neutral-300 bg-white px-3 text-base sm:text-sm" disabled={!canChangeStatus || busy !== null} onChange={(event) => run("priority", () => updateAdminInquiryPriority(inquiry.id, { priority: event.target.value as AdminInquiryPriority }))} value={inquiry.priority}>
                  {Object.entries(INQUIRY_PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
            {canAssign ? <button className="min-h-11 justify-self-start rounded bg-[var(--color-action)] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={busy !== null} onClick={() => run("assign", () => assignAdminInquiry(inquiry.id, { assigneeId: assigneeId || null }))} type="button">{busy === "assign" ? "正在分配..." : "分配负责人"}</button> : null}
            {canChangeStatus && possibleStatuses.length > 0 ? <div className="grid gap-2"><p className="text-sm font-medium text-neutral-800">变更状态</p><div className="flex flex-wrap gap-2">{possibleStatuses.map((status) => <button className="min-h-11 rounded border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50" disabled={busy !== null} key={status} onClick={() => run(`status:${status}`, () => updateAdminInquiryStatus(inquiry.id, { status }))} type="button">{INQUIRY_STATUS_LABELS[status]}</button>)}</div></div> : null}
          </section>

          <section className="grid gap-4 border-b border-neutral-200 px-4 py-5 sm:px-6" aria-labelledby="note-title">
            <h3 className="font-semibold text-neutral-950" id="note-title">跟进记录</h3>
            {inquiry.notes.length > 0 ? <ol className="grid gap-3">{inquiry.notes.map((item) => <li className="border-l-2 border-sky-300 pl-3 text-sm" key={item.id}><p className="whitespace-pre-wrap text-neutral-800">{item.body}</p><p className="mt-1 text-xs text-neutral-500">{formatInquiryTime(item.createdAt)}</p></li>)}</ol> : <p className="text-sm text-neutral-500">尚未添加跟进记录。</p>}
            {canAddNote ? <div className="grid gap-2"><label className="text-sm font-medium text-neutral-800" htmlFor="inquiry-note">新增记录</label><textarea className="min-h-24 rounded border border-neutral-300 px-3 py-2 text-base sm:text-sm" id="inquiry-note" maxLength={2000} onChange={(event) => setNote(event.target.value)} placeholder="记录沟通结果和下一步安排" value={note} /><button className="min-h-11 justify-self-start rounded bg-[var(--color-action)] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={!note.trim() || busy !== null} onClick={() => run("note", async () => { await addAdminInquiryNote(inquiry.id, { body: note }); setNote(""); })} type="button">{busy === "note" ? "正在保存..." : "添加跟进记录"}</button></div> : null}
          </section>

          <section className="grid gap-4 border-b border-neutral-200 px-4 py-5 sm:px-6" aria-labelledby="notice-title">
            <h3 className="flex items-center gap-2 font-semibold text-neutral-950" id="notice-title"><BellRing aria-hidden="true" className="size-4" />通知状态</h3>
            {inquiry.notifications.map((notification) => <div className="flex flex-col gap-3 border border-neutral-200 p-3 sm:flex-row sm:items-center sm:justify-between" key={notification.id}><div className="min-w-0"><p className="flex items-center gap-1.5 text-sm font-medium text-neutral-900">{notification.status === "failed" ? <CircleAlert aria-hidden="true" className="size-4 text-red-700" /> : null}{notification.status === "failed" ? "发送失败" : notification.status === "sent" ? "已发送" : "等待发送"}</p>{notification.lastError ? <p className="mt-1 break-words text-xs text-neutral-600">失败原因：{notification.lastError}</p> : null}</div>{canRetry && notification.status === "failed" ? <button className="min-h-11 shrink-0 rounded border border-neutral-300 px-3 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50" disabled={busy !== null} onClick={() => run(`retry:${notification.id}`, () => retryAdminInquiryNotification(inquiry.id, notification.id))} type="button">{busy === `retry:${notification.id}` ? "正在重新发送..." : "重新发送通知"}</button> : null}</div>)}
          </section>

          <section className="grid gap-3 px-4 py-5 sm:px-6" aria-labelledby="timeline-title">
            <h3 className="flex items-center gap-2 font-semibold text-neutral-950" id="timeline-title"><UserRound aria-hidden="true" className="size-4" />处理时间线</h3>
            <ol className="grid gap-3">{inquiry.history.map((event) => <li className="grid grid-cols-[0.5rem_minmax(0,1fr)] gap-3 text-sm" key={event.id}><span className="mt-2 size-2 rounded-full bg-sky-600" /><div><p className="text-neutral-800">{event.fromStatus ? `从“${INQUIRY_STATUS_LABELS[event.fromStatus as AdminInquiryStatus] ?? event.fromStatus}”变更为“${INQUIRY_STATUS_LABELS[event.toStatus as AdminInquiryStatus] ?? event.toStatus}”` : `创建为“${INQUIRY_STATUS_LABELS[event.toStatus as AdminInquiryStatus] ?? event.toStatus}”`}</p><time className="mt-1 block text-xs text-neutral-500" dateTime={new Date(event.createdAt).toISOString()}>{formatInquiryTime(event.createdAt)}</time></div></li>)}</ol>
          </section>
        </div>
      </section>
    </div>
  );
}
