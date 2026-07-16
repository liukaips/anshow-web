"use client";

import {
  CircleAlert,
  CircleCheck,
  Inbox,
  LoaderCircle,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AdminLoadingState({ label = "正在加载" }: Readonly<{ label?: string }>) {
  return (
    <div
      aria-live="polite"
      className="flex min-h-36 items-center justify-center gap-2 border border-neutral-200 bg-white px-5 py-8 text-sm text-neutral-600"
      role="status"
    >
      <LoaderCircle
        aria-hidden="true"
        className="size-5 animate-spin motion-reduce:animate-none"
      />
      {label}
    </div>
  );
}

export function AdminEmptyState({
  action,
  description,
  title,
}: Readonly<{
  action?: ReactNode;
  description?: string;
  title: string;
}>) {
  return (
    <section className="grid min-h-48 place-items-center border border-dashed border-neutral-300 bg-white px-5 py-10 text-center">
      <div className="grid max-w-md justify-items-center gap-3">
        <span className="grid size-11 place-items-center rounded bg-neutral-100 text-neutral-600">
          <Inbox aria-hidden="true" className="size-5" />
        </span>
        <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
        {description ? (
          <p className="text-sm leading-6 text-neutral-600">{description}</p>
        ) : null}
        {action ? <div className="mt-1">{action}</div> : null}
      </div>
    </section>
  );
}

export function AdminErrorState({
  description = "内容暂时无法加载，请检查网络后重试。",
  onRetry,
  title = "加载失败",
}: Readonly<{
  description?: string;
  onRetry?: () => void;
  title?: string;
}>) {
  return (
    <section className="grid min-h-40 place-items-center border border-red-200 bg-red-50 px-5 py-8 text-center" role="alert">
      <div className="grid max-w-md justify-items-center gap-3">
        <TriangleAlert aria-hidden="true" className="size-6 text-red-700" />
        <h2 className="font-semibold text-red-950">{title}</h2>
        <p className="text-sm leading-6 text-red-800">{description}</p>
        {onRetry ? (
          <button
            className="mt-1 min-h-11 rounded border border-red-300 bg-white px-4 text-sm font-medium text-red-800 transition-colors hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            onClick={onRetry}
            type="button"
          >
            重新加载
          </button>
        ) : null}
      </div>
    </section>
  );
}

const TOAST_STYLES = {
  success: "border-emerald-300 bg-emerald-50 text-emerald-900",
  error: "border-red-300 bg-red-50 text-red-900",
  info: "border-sky-300 bg-sky-50 text-sky-900",
} as const;

export function AdminToast({
  message,
  onDismiss,
  tone = "info",
}: Readonly<{
  message: string;
  onDismiss?: () => void;
  tone?: keyof typeof TOAST_STYLES;
}>) {
  const Icon = tone === "success" ? CircleCheck : CircleAlert;
  return (
    <div
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`flex min-h-11 items-center gap-2 border px-3 py-2 text-sm ${TOAST_STYLES[tone]}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      {onDismiss ? (
        <button
          aria-label="关闭提示"
          className="grid size-11 shrink-0 place-items-center rounded transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          onClick={onDismiss}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

export function AdminConfirmDialog({
  cancelLabel = "取消",
  confirmLabel = "确认",
  description,
  onCancel,
  onConfirm,
  open,
  title,
}: Readonly<{
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}>) {
  const generatedId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = `admin-confirm-title-${generatedId}`;
  const descriptionId = `admin-confirm-description-${generatedId}`;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
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
      previousFocus?.focus();
    };
  }, [onCancel, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-100 grid place-items-center bg-black/50 p-4">
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-md border border-neutral-200 bg-white p-5 shadow-2xl"
        ref={dialogRef}
        role="alertdialog"
      >
        <h2 className="text-lg font-semibold text-neutral-950" id={titleId}>
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600" id={descriptionId}>
          {description}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            className="min-h-11 rounded border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            onClick={onCancel}
            ref={cancelRef}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className="min-h-11 rounded bg-[var(--color-action)] px-4 text-sm font-semibold text-white transition-colors hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-ink)]"
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
