"use client";

import {
  Archive,
  CalendarClock,
  Eye,
  LoaderCircle,
  Save,
  Send,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  archiveAdminContent,
  publishAdminContentTranslation,
  saveAdminContentDraft,
  scheduleAdminContentTranslation,
  type AdminContentCollection,
  type AdminContentItem,
  type AdminContentLocale,
  type AdminContentTranslationInput,
} from "../../api/admin-content";
import { ApiError } from "../../api/http";
import { LocaleTabs } from "./locale-tabs";

type ContentEditorProps = {
  canPublish: boolean;
  collection: AdminContentCollection;
  initialItem: AdminContentItem;
};

type TranslationField = keyof AdminContentTranslationInput;
type EditorField = TranslationField | "scheduledAt";
type FieldErrors = Partial<Record<EditorField, string>>;
type Command = "archive" | "publish" | "save" | "schedule";

const locales: readonly AdminContentLocale[] = ["en", "zh", "ru"];
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
  title: "Title",
  slug: "Slug",
  summary: "Summary",
  body: "Body",
  seoTitle: "SEO title",
  seoDescription: "SEO description",
  altText: "Alternative text",
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

function publishErrors(input: AdminContentTranslationInput): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of Object.keys(fieldLabels) as TranslationField[]) {
    if (!input[field].trim()) {
      errors[field] = `${fieldLabels[field]} is required to publish.`;
    }
  }
  if (input.slug && !/^[a-z0-9-]+$/.test(input.slug)) {
    errors.slug = "Slug must use lowercase letters, numbers, and hyphens.";
  }
  if (input.seoTitle.length > 60) {
    errors.seoTitle = "SEO title must be 60 characters or fewer.";
  }
  if (input.seoDescription.length > 160) {
    errors.seoDescription = "SEO description must be 160 characters or fewer.";
  }
  return errors;
}

function firstErrorField(errors: FieldErrors): TranslationField | undefined {
  return (Object.keys(fieldLabels) as TranslationField[]).find(
    (field) => errors[field],
  );
}

function commandMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The command failed.";
}

export function ContentEditor({
  canPublish,
  collection,
  initialItem,
}: ContentEditorProps) {
  const [item, setItem] = useState(initialItem);
  const [drafts, setDrafts] = useState(() => itemDrafts(initialItem));
  const [activeLocale, setActiveLocale] = useState<AdminContentLocale>("en");
  const [dirtyLocales, setDirtyLocales] = useState<Set<AdminContentLocale>>(
    () => new Set(),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState<Command | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [message, setMessage] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  const dirty = dirtyLocales.size > 0;
  const activeDraft = drafts[activeLocale];
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
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const guardNavigation = (event: MouseEvent) => {
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
      if (!window.confirm("This item has unsaved changes. Leave this page?")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    document.addEventListener("click", guardNavigation, true);
    return () => document.removeEventListener("click", guardNavigation, true);
  }, [dirty]);

  function markSaved(locale: AdminContentLocale) {
    setDirtyLocales((current) => {
      const next = new Set(current);
      next.delete(locale);
      return next;
    });
  }

  function updateField(field: TranslationField, value: string) {
    setDrafts((current) => ({
      ...current,
      [activeLocale]: { ...current[activeLocale], [field]: value },
    }));
    setDirtyLocales((current) => new Set(current).add(activeLocale));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setMessage(null);
  }

  function selectLocale(locale: AdminContentLocale) {
    if (
      locale !== activeLocale &&
      dirtyLocales.has(activeLocale) &&
      !window.confirm("This translation has unsaved changes. Change language anyway?")
    ) {
      return;
    }
    setErrors({});
    setMessage(null);
    setActiveLocale(locale);
  }

  function focusFirstError(nextErrors: FieldErrors) {
    const first =
      firstErrorField(nextErrors) ??
      (nextErrors.scheduledAt ? "scheduledAt" : undefined);
    if (!first) return;
    queueMicrotask(() => {
      document
        .getElementById(
          first === "scheduledAt" ? "scheduled-at" : `translation-${first}`,
        )
        ?.focus();
    });
  }

  function handleCommandError(error: unknown) {
    if (error instanceof ApiError && error.fields) {
      const nextErrors: FieldErrors = {};
      for (const [field, messages] of Object.entries(error.fields)) {
        if (
          (field in fieldLabels || field === "scheduledAt") &&
          messages[0]
        ) {
          nextErrors[field as EditorField] = messages[0];
        }
      }
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        focusFirstError(nextErrors);
      }
    }
    setMessage({ kind: "error", text: commandMessage(error) });
  }

  function validatePublish(): boolean {
    const nextErrors = publishErrors(activeDraft);
    setErrors(nextErrors);
    focusFirstError(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function save() {
    setPending("save");
    setMessage(null);
    try {
      const saved = await saveAdminContentDraft(
        collection,
        item.id,
        activeLocale,
        activeDraft,
      );
      setItem(saved);
      markSaved(activeLocale);
      setMessage({ kind: "success", text: "Draft saved." });
    } catch (error) {
      handleCommandError(error);
    } finally {
      setPending(null);
    }
  }

  async function publish() {
    if (!validatePublish()) return;
    setPending("publish");
    setMessage(null);
    try {
      const published = await publishAdminContentTranslation(
        collection,
        item.id,
        activeLocale,
        activeDraft,
      );
      setItem(published);
      markSaved(activeLocale);
      setMessage({ kind: "success", text: "Translation published." });
    } catch (error) {
      handleCommandError(error);
    } finally {
      setPending(null);
    }
  }

  async function schedule() {
    if (!validatePublish()) return;
    const date = new Date(scheduledAt);
    if (!scheduledAt || Number.isNaN(date.getTime()) || date <= new Date()) {
      setMessage({
        kind: "error",
        text: "Choose a future publication date and time.",
      });
      return;
    }
    setPending("schedule");
    setMessage(null);
    try {
      const scheduled = await scheduleAdminContentTranslation(
        collection,
        item.id,
        activeLocale,
        { ...activeDraft, scheduledAt: date.toISOString() },
      );
      setItem(scheduled);
      markSaved(activeLocale);
      setMessage({ kind: "success", text: "Translation scheduled." });
    } catch (error) {
      handleCommandError(error);
    } finally {
      setPending(null);
    }
  }

  async function archive() {
    const warning = dirty
      ? "Archive this item and leave unsaved changes behind?"
      : "Archive this content item?";
    if (!window.confirm(warning)) return;
    setPending("archive");
    setMessage(null);
    try {
      const archived = await archiveAdminContent(collection, item.id);
      setItem(archived);
      setDirtyLocales(new Set());
      setMessage({ kind: "success", text: "Content archived." });
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
              {activeLocale} translation
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              State: <span className="font-semibold capitalize text-[var(--color-text)]">{activeState}</span>
              {dirtyLocales.has(activeLocale) ? " · Unsaved changes" : ""}
            </p>
          </div>
          <a
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border border-neutral-300 bg-white px-4 text-sm font-semibold text-[var(--color-text)] transition-[background-color,transform] duration-[var(--motion-fast)] hover:-translate-y-px hover:bg-neutral-50"
            href="#content-preview"
          >
            <Eye aria-hidden="true" className="size-4" />
            Preview
          </a>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2">
          <Field
            error={errors.title}
            field="title"
            label="Title"
            onChange={updateField}
            value={activeDraft.title}
          />
          <Field
            error={errors.slug}
            field="slug"
            label="Slug"
            onChange={updateField}
            value={activeDraft.slug}
          />
          <Field
            error={errors.summary}
            field="summary"
            label="Summary"
            multiline
            onChange={updateField}
            value={activeDraft.summary}
          />
          <Field
            error={errors.altText}
            field="altText"
            label="Alternative text"
            onChange={updateField}
            value={activeDraft.altText}
          />
          <div className="min-w-0 lg:col-span-2">
            <Field
              error={errors.body}
              field="body"
              label="Body"
              multiline
              onChange={updateField}
              rows={10}
              value={activeDraft.body}
            />
          </div>
        </div>

        <div className="mt-8 border-t border-neutral-200 pt-6">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Search metadata</h2>
          <div className="mt-4 grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2">
            <Field
              error={errors.seoTitle}
              field="seoTitle"
              label="SEO title"
              maxLength={60}
              onChange={updateField}
              value={activeDraft.seoTitle}
            />
            <Field
              error={errors.seoDescription}
              field="seoDescription"
              label="SEO description"
              maxLength={160}
              multiline
              onChange={updateField}
              value={activeDraft.seoDescription}
            />
          </div>
        </div>

        <div className="mt-8 border-t border-neutral-200 pt-6">
          <label className="block max-w-md text-sm font-semibold text-[var(--color-text)]" htmlFor="scheduled-at">
            Publication date and time
          </label>
          <input
            aria-describedby={errors.scheduledAt ? "scheduled-at-error" : undefined}
            aria-invalid={errors.scheduledAt ? true : undefined}
            className={`${fieldClass} max-w-md ${errors.scheduledAt ? "border-[var(--color-danger)]" : "border-neutral-300"}`}
            disabled={pending !== null || !canPublish}
            id="scheduled-at"
            onChange={(event) => {
              setScheduledAt(event.target.value);
              setErrors((current) => ({
                ...current,
                scheduledAt: undefined,
              }));
            }}
            type="datetime-local"
            value={scheduledAt}
          />
          {errors.scheduledAt ? (
            <p className="mt-1 text-sm text-[var(--color-danger)]" id="scheduled-at-error">
              {errors.scheduledAt}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap gap-3 border-t border-neutral-200 pt-6">
          <CommandButton disabled={pending !== null} icon={Save} label="Save draft" onClick={save} pending={pending === "save"} />
          <CommandButton disabled={pending !== null || !canPublish} icon={CalendarClock} label="Schedule" onClick={schedule} pending={pending === "schedule"} />
          <CommandButton action disabled={pending !== null || !canPublish} icon={Send} label="Publish" onClick={publish} pending={pending === "publish"} />
          <CommandButton danger disabled={pending !== null} icon={Archive} label="Archive" onClick={archive} pending={pending === "archive"} />
        </div>
        {!canPublish ? (
          <p className="mt-3 text-sm text-neutral-600">Publishing requires the content.publish permission.</p>
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
            ? "Published preview"
            : "Unpublished preview"}
        </p>
        <h2 className="mt-2 break-words text-2xl font-semibold text-[var(--color-text)]">
          {activeDraft.title || "Untitled translation"}
        </h2>
        <p className="mt-3 max-w-3xl break-words text-base leading-7 text-neutral-700">
          {activeDraft.summary || "No summary has been entered."}
        </p>
      </section>
    </div>
  );
}

function Field({
  error,
  field,
  label,
  maxLength,
  multiline = false,
  onChange,
  rows = 3,
  value,
}: {
  error?: string;
  field: TranslationField;
  label: string;
  maxLength?: number;
  multiline?: boolean;
  onChange: (field: TranslationField, value: string) => void;
  rows?: number;
  value: string;
}) {
  const inputId = `translation-${field}`;
  const errorId = `${inputId}-error`;
  const className = `mt-2 min-h-11 w-full rounded-[var(--radius-control)] border bg-white px-3 py-2 text-base text-[var(--color-text)] outline-none transition-[border-color,box-shadow] duration-[var(--motion-fast)] focus:ring-2 ${
    error
      ? "border-[var(--color-danger)] focus:ring-red-100"
      : "border-neutral-300 focus:border-[var(--color-cyan-ink)] focus:ring-sky-100"
  }`;
  const shared = {
    "aria-describedby": error ? errorId : undefined,
    "aria-invalid": error ? (true as const) : undefined,
    className,
    id: inputId,
    maxLength,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onChange(field, event.target.value),
    value,
  };

  return (
    <div className="min-w-0">
      <label className="block text-sm font-semibold text-[var(--color-text)]" htmlFor={inputId}>
        {label}
      </label>
      {multiline ? <textarea {...shared} rows={rows} /> : <input {...shared} type="text" />}
      {error ? (
        <p className="mt-1 text-sm text-[var(--color-danger)]" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function CommandButton({
  action = false,
  danger = false,
  disabled,
  icon: Icon,
  label,
  onClick,
  pending,
}: {
  action?: boolean;
  danger?: boolean;
  disabled: boolean;
  icon: typeof Save;
  label: string;
  onClick: () => void;
  pending: boolean;
}) {
  const colors = action
    ? "border-[var(--color-action)] bg-[var(--color-action)] text-white hover:brightness-95"
    : danger
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
