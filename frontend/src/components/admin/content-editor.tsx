"use client";

import {
  Archive,
  Eye,
  LoaderCircle,
  Languages,
  Save,
  Send,
  ClipboardCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  archiveAdminContent,
  generateAdminContentTranslations,
  saveAdminContentDraft,
  updateAdminContentVerification,
  type AdminContentCollection,
  type AdminContentItem,
  type AdminContentLocale,
  type AdminContentTranslationInput,
  type ProofContentCollection,
} from "../../api/admin-content";
import { ApiError } from "../../api/http";
import { submitAdminReview } from "../../api/admin-reviews";
import {
  ADMIN_NAVIGATION_REQUEST,
  requestAdminNavigation,
} from "./admin-navigation";
import { LocaleTabs } from "./locale-tabs";
import { AdvancedSettings } from "./content/editor/advanced-settings";
import { ChineseContentStep } from "./content/editor/chinese-content-step";
import {
  firstContentErrorField,
  validateChineseContent,
  type TranslationField,
} from "./content/editor/content-validation";

type ContentEditorProps = {
  canPublish: boolean;
  canWrite: boolean;
  collection: AdminContentCollection;
  initialItem: AdminContentItem;
};

type FieldErrors = Partial<Record<TranslationField, string>>;
type Command = "archive" | "save" | "submit" | "translate" | "verification";

const locales: readonly AdminContentLocale[] = ["en", "zh", "ru"];
const proofCollections: readonly ProofContentCollection[] = [
  "partners",
  "certificates",
  "proof-metrics",
];
const blankTranslation: AdminContentTranslationInput = {
  title: "",
  slug: "",
  summary: "",
  body: "",
  seoTitle: "",
  seoDescription: "",
  altText: "",
};

const fieldLabels: Record<TranslationField, string> = {
  title: "标题",
  slug: "别名",
  summary: "摘要",
  body: "正文",
  seoTitle: "SEO 标题",
  seoDescription: "SEO 描述",
  altText: "替代文本",
};

function itemDrafts(item: AdminContentItem) {
  return Object.fromEntries(
    locales.map((locale) => {
      const translation = item.translations[locale];
      return [
        locale,
        translation
          ? {
              title: translation.title,
              slug: translation.slug,
              summary: translation.summary,
              body: translation.body,
              seoTitle: translation.seoTitle,
              seoDescription: translation.seoDescription,
              altText: translation.altText,
            }
          : { ...blankTranslation },
      ];
    }),
  ) as Record<AdminContentLocale, AdminContentTranslationInput>;
}

function isProofCollection(
  collection: AdminContentCollection,
): collection is ProofContentCollection {
  return (proofCollections as readonly AdminContentCollection[]).includes(
    collection,
  );
}

function firstErrorField(errors: FieldErrors): TranslationField | undefined {
  return firstContentErrorField(errors);
}

function commandMessage(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败，请稍后重试。";
}

export function ContentEditor({
  canPublish,
  canWrite,
  collection,
  initialItem,
}: ContentEditorProps) {
  const [item, setItem] = useState(initialItem);
  const [drafts, setDrafts] = useState(() => itemDrafts(initialItem));
  const [activeLocale, setActiveLocale] = useState<AdminContentLocale>("en");
  const [dirtyLocales, setDirtyLocales] = useState<Set<AdminContentLocale>>(
    () => new Set(),
  );
  const [verified, setVerified] = useState(initialItem.verified);
  const [verificationSource, setVerificationSource] = useState(
    initialItem.verificationSource ?? "",
  );
  const [verificationDirty, setVerificationDirty] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState<Command | null>(null);
  const editorHistoryEntry = useRef<{ state: unknown; url: string } | null>(
    null,
  );
  const [message, setMessage] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  const dirty = dirtyLocales.size > 0 || verificationDirty;
  const canEdit = canWrite || canPublish;
  const fieldsDisabled = pending !== null || !canEdit;
  const activeDraft = drafts[activeLocale];
  const activeDirty = dirtyLocales.has(activeLocale);
  const activeState = item.translations[activeLocale]?.status ?? "draft";
  const tabTranslations = useMemo(
    () =>
      Object.fromEntries(
        locales.map((locale) => [
          locale,
          {
            ...drafts[locale],
            status: item.translations[locale]?.status ?? "draft",
          },
        ]),
      ),
    [drafts, item.translations],
  );

  useEffect(() => {
    if (pending !== null) return;
    const first = firstErrorField(errors);
    if (!first) return;
    document.getElementById(`translation-${first}`)?.focus();
  }, [errors, pending]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) {
      editorHistoryEntry.current = null;
      return;
    }
    editorHistoryEntry.current ??= {
      state: window.history.state,
      url: window.location.href,
    };

    const guardNavigationRequest = (event: Event) => {
      if (!window.confirm("当前内容尚未保存，确定离开此页面吗？")) {
        event.preventDefault();
      }
    };
    const guardAnchorNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      const anchor =
        target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
      if (
        !anchor ||
        anchor.hasAttribute("download") ||
        (anchor.target && anchor.target !== "_self")
      ) {
        return;
      }
      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (
        !requestAdminNavigation({
          destination: destination.href,
          source: "link",
        })
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const guardHistoryNavigation = (event: PopStateEvent) => {
      if (
        requestAdminNavigation({
          destination: window.location.href,
          source: "history",
        })
      ) {
        return;
      }
      const editorEntry = editorHistoryEntry.current;
      event.stopImmediatePropagation();
      if (editorEntry) {
        window.history.pushState(
          editorEntry.state,
          "",
          editorEntry.url,
        );
      }
    };

    window.addEventListener(
      ADMIN_NAVIGATION_REQUEST,
      guardNavigationRequest,
    );
    document.addEventListener("click", guardAnchorNavigation, true);
    window.addEventListener("popstate", guardHistoryNavigation, true);
    return () => {
      window.removeEventListener(
        ADMIN_NAVIGATION_REQUEST,
        guardNavigationRequest,
      );
      document.removeEventListener("click", guardAnchorNavigation, true);
      window.removeEventListener("popstate", guardHistoryNavigation, true);
    };
  }, [dirty]);

  function reconcileResponse(
    nextItem: AdminContentItem,
    command: Command,
    locale?: AdminContentLocale,
  ) {
    setItem(nextItem);
    if (command === "archive") {
      setDrafts(itemDrafts(nextItem));
      setDirtyLocales(new Set());
      setVerified(nextItem.verified);
      setVerificationSource(nextItem.verificationSource ?? "");
      setVerificationDirty(false);
      return;
    }
    if (command === "verification") {
      setVerified(nextItem.verified);
      setVerificationSource(nextItem.verificationSource ?? "");
      setVerificationDirty(false);
      return;
    }
    if (!locale) return;

    const persistedTranslation = nextItem.translations[locale];
    setDrafts((current) => ({
      ...current,
      [locale]: persistedTranslation
        ? {
            title: persistedTranslation.title,
            slug: persistedTranslation.slug,
            summary: persistedTranslation.summary,
            body: persistedTranslation.body,
            seoTitle: persistedTranslation.seoTitle,
            seoDescription: persistedTranslation.seoDescription,
            altText: persistedTranslation.altText,
          }
        : { ...blankTranslation },
    }));
    setDirtyLocales((current) => {
      const next = new Set(current);
      next.delete(locale);
      return next;
    });

    if (!verificationDirty) {
      setVerified(nextItem.verified);
      setVerificationSource(nextItem.verificationSource ?? "");
    }
  }

  function updateField(field: TranslationField, value: string) {
    if (pending !== null || !canEdit) return;
    setDrafts((current) => ({
      ...current,
      [activeLocale]: { ...current[activeLocale], [field]: value },
    }));
    setDirtyLocales((current) => new Set(current).add(activeLocale));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setMessage(null);
  }

  function selectLocale(locale: AdminContentLocale) {
    if (pending !== null) return;
    if (
      locale !== activeLocale &&
      activeDirty &&
      !window.confirm("当前语言内容尚未保存，确定切换语言吗？")
    ) {
      return;
    }
    setErrors({});
    setMessage(null);
    setActiveLocale(locale);
  }

  function handleCommandError(error: unknown) {
    if (error instanceof ApiError && error.fields) {
      const nextErrors: FieldErrors = {};
      for (const [field, messages] of Object.entries(error.fields)) {
        if (
          field in fieldLabels && messages[0]
        ) {
          nextErrors[field as TranslationField] = messages[0];
        }
      }
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
      }
    }
    setMessage({ kind: "error", text: commandMessage(error) });
  }

  async function save() {
    const nextErrors = validateChineseContent(activeDraft);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setMessage({ kind: "error", text: "请先补全页面必填内容。" });
      return;
    }
    setPending("save");
    setMessage(null);
    try {
      const saved = await saveAdminContentDraft(
        collection,
        item.id,
        activeLocale,
        activeDraft,
      );
      reconcileResponse(saved, "save", activeLocale);
      setMessage({ kind: "success", text: "草稿已保存。" });
    } catch (error) {
      handleCommandError(error);
    } finally {
      setPending(null);
    }
  }

  async function generateTranslations() {
    if (dirty) {
      setMessage({ kind: "error", text: "请先保存当前修改，再自动生成翻译。" });
      return;
    }
    setPending("translate");
    setMessage(null);
    try {
      const result = await generateAdminContentTranslations(collection, item.id, {
        targets: ["en", "ru"],
        sourceVersion: item.workflow.version,
      });
      setItem(result.item);
      setDrafts(itemDrafts(result.item));
      setMessage({ kind: "success", text: "英文和俄文草稿已生成，请检查后再提交审核。" });
    } catch (error) {
      handleCommandError(error);
    } finally {
      setPending(null);
    }
  }

  async function submitForReview() {
    if (dirty) {
      setMessage({ kind: "error", text: "请先保存当前修改，再提交审核。" });
      return;
    }
    setPending("submit");
    setMessage(null);
    try {
      const review = await submitAdminReview({ collection, id: item.id, expectedVersion: item.workflow.version });
      setItem((current) => ({ ...current, workflow: { ...current.workflow, state: "review_pending", version: review.sourceVersion, submittedAt: review.submittedAt } }));
      setMessage({ kind: "success", text: "内容已提交审核。" });
    } catch (error) {
      handleCommandError(error);
    } finally {
      setPending(null);
    }
  }

  async function archive() {
    const warning = dirty
      ? "归档后未保存的修改将丢失，确定继续吗？"
      : "确定归档这条内容吗？";
    if (!window.confirm(warning)) return;
    setPending("archive");
    setMessage(null);
    try {
      const archived = await archiveAdminContent(collection, item.id);
      reconcileResponse(archived, "archive");
      setMessage({ kind: "success", text: "内容已归档。" });
    } catch (error) {
      handleCommandError(error);
    } finally {
      setPending(null);
    }
  }

  async function saveVerification() {
    if (!isProofCollection(collection)) return;
    if (verified && !verificationSource.trim()) {
      setMessage({
        kind: "error",
        text: "请填写官方核验来源。",
      });
      return;
    }
    setPending("verification");
    setMessage(null);
    try {
      const updated = await updateAdminContentVerification(
        collection,
        item.id,
        {
          verified,
          verificationSource: verified ? verificationSource : null,
        },
      );
      reconcileResponse(updated, "verification");
      setMessage({ kind: "success", text: "核验信息已保存。" });
    } catch (error) {
      handleCommandError(error);
    } finally {
      setPending(null);
    }
  }

  const fieldClass =
    "mt-2 min-h-11 w-full rounded-[var(--radius-control)] border bg-white px-3 py-2 text-base text-[var(--color-text)] outline-none transition-[border-color,box-shadow] duration-[var(--motion-fast)] focus:border-[var(--color-cyan-ink)] focus:ring-2 focus:ring-sky-100";

  return (
    <div className="min-w-0">
      <LocaleTabs
        activeLocale={activeLocale}
        disabled={pending !== null}
        onSelect={selectLocale}
        translations={tabTranslations}
      />

      <section
        aria-labelledby={`translation-tab-${activeLocale}`}
        className="py-6"
        id={`translation-panel-${activeLocale}`}
        role="tabpanel"
      >
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
          <div>
            <p className="text-sm font-semibold uppercase text-neutral-500">
              {activeLocale === "zh" ? "中文内容" : activeLocale === "en" ? "英文内容" : "俄文内容"}
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              状态：<span className="font-semibold capitalize text-[var(--color-text)]">{activeState === "published" ? "已发布" : activeState === "scheduled" ? "已定时" : "草稿"}</span>
              {activeDirty ? " · 未保存" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
          {canWrite ? (
            <CommandButton disabled={pending !== null || dirty} icon={Languages} label="自动生成英文和俄文" onClick={generateTranslations} pending={pending === "translate"} />
          ) : null}
          <a
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-neutral-300 bg-white px-4 text-sm font-semibold text-[var(--color-text)] transition-[background-color,transform] duration-[var(--motion-fast)] hover:-translate-y-px hover:bg-neutral-50"
            href="#content-preview"
          >
            <Eye aria-hidden="true" className="size-4" />
            预览
          </a>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-5">
          <ChineseContentStep
            collection={collection}
            disabled={fieldsDisabled}
            errors={errors}
            onChange={updateField}
            value={activeDraft}
          />
          <AdvancedSettings
            disabled={fieldsDisabled}
            errors={errors}
            onChange={updateField}
            value={activeDraft}
          />
        </div>

        {canWrite && isProofCollection(collection) ? (
          <div className="mt-8 border-t border-neutral-200 pt-6">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              证明核验
            </h2>
            <label className="mt-4 flex min-h-11 items-center gap-3 text-sm font-semibold text-[var(--color-text)]">
              <input
                checked={verified}
                disabled={pending !== null}
                onChange={(event) => {
                  if (pending !== null) return;
                  setVerified(event.target.checked);
                  setVerificationDirty(true);
                  setMessage(null);
                }}
                type="checkbox"
              />
              已核验证明
            </label>
            <label className="mt-4 block max-w-2xl text-sm font-semibold text-[var(--color-text)]" htmlFor="verification-source">
              官方核验来源
            </label>
            <textarea
              className={`${fieldClass} max-w-2xl border-neutral-300`}
              disabled={pending !== null}
              id="verification-source"
              onChange={(event) => {
                if (pending !== null) return;
                setVerificationSource(event.target.value);
                setVerificationDirty(true);
                setMessage(null);
              }}
              rows={3}
              value={verificationSource}
            />
            <button
              className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-neutral-300 bg-white px-4 text-sm font-semibold text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={pending !== null}
              onClick={saveVerification}
              type="button"
            >
              {pending === "verification" ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Save aria-hidden="true" className="size-4" />
              )}
              保存核验信息
            </button>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3 border-t border-neutral-200 pt-6">
          {canWrite ? (
            <CommandButton disabled={pending !== null} icon={Save} label="保存草稿" onClick={save} pending={pending === "save"} />
          ) : null}
          {canPublish ? (
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-action)] px-4 text-sm font-semibold text-white transition-colors hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-ink)]"
              href="/admin/publish"
            >
              <Send aria-hidden="true" className="size-4" />
              前往预览发布
            </Link>
          ) : null}
          {canWrite ? <CommandButton disabled={pending !== null || dirty || item.workflow.state === "review_pending"} icon={ClipboardCheck} label="提交审核" onClick={submitForReview} pending={pending === "submit"} /> : null}
          {canWrite ? (
            <CommandButton danger disabled={pending !== null} icon={Archive} label="归档" onClick={archive} pending={pending === "archive"} />
          ) : null}
        </div>
        {!canPublish ? (
          <p className="mt-3 text-sm text-neutral-600">
            当前账号没有发布权限，请联系超级管理员授权。
          </p>
        ) : null}
        <div aria-live="polite" className="min-h-7 pt-3">
          {message ? (
            <p className={message.kind === "error" ? "text-sm font-medium text-[var(--color-danger)]" : "text-sm font-medium text-[var(--color-teal-ink)]"} role={message.kind === "error" ? "alert" : "status"}>
              {message.text}
            </p>
          ) : null}
        </div>
      </section>

      <section className="border-l-4 border-[var(--color-cyan-ink)] bg-white px-5 py-5" id="content-preview">
        <p className="text-xs font-semibold uppercase text-[var(--color-cyan-ink)]">
          {activeState === "published" && !dirtyLocales.has(activeLocale)
            ? "已发布预览"
            : "未发布预览"}
        </p>
        <h2 className="mt-2 break-words text-2xl font-semibold text-[var(--color-text)]">
          {activeDraft.title || "未命名翻译"}
        </h2>
        <p className="mt-3 max-w-3xl break-words text-base leading-7 text-neutral-700">
          {activeDraft.summary || "尚未填写摘要。"}
        </p>
      </section>
    </div>
  );
}

function CommandButton({
  danger = false,
  disabled,
  icon: Icon,
  label,
  onClick,
  pending,
}: {
  danger?: boolean;
  disabled: boolean;
  icon: typeof Save;
  label: string;
  onClick: () => void;
  pending: boolean;
}) {
  const colors = danger
    ? "border-red-200 bg-white text-[var(--color-danger)] hover:bg-red-50"
    : "border-neutral-300 bg-white text-[var(--color-text)] hover:bg-neutral-50";
  return (
    <button
      className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border px-4 text-sm font-semibold transition-[background-color,transform,filter] duration-[var(--motion-fast)] hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${colors}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Icon aria-hidden="true" className="size-4" />}
      {label}
    </button>
  );
}
