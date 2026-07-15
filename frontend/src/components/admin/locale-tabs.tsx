"use client";

import type {
  AdminContentLocale,
  AdminContentTranslationInput,
} from "../../api/admin-content";

type TranslationTabValue = Partial<AdminContentTranslationInput> & {
  status?: "draft" | "scheduled" | "published";
};

type LocaleTabsProps = {
  activeLocale: AdminContentLocale;
  disabled?: boolean;
  onSelect: (locale: AdminContentLocale) => void;
  translations: Partial<Record<AdminContentLocale, TranslationTabValue>>;
};

const localeLabels: Record<AdminContentLocale, string> = {
  en: "英文",
  zh: "中文",
  ru: "俄文",
};

const requiredFields = [
  "title",
  "slug",
  "summary",
  "body",
  "seoTitle",
  "seoDescription",
  "altText",
] as const satisfies readonly (keyof AdminContentTranslationInput)[];

export function isTranslationComplete(
  translation: TranslationTabValue | undefined,
): boolean {
  return Boolean(
    translation &&
      requiredFields.every((field) => translation[field]?.trim()) &&
      /^[a-z0-9-]+$/.test(translation.slug ?? "") &&
      (translation.seoTitle?.length ?? 0) <= 60 &&
      (translation.seoDescription?.length ?? 0) <= 160,
  );
}

export function LocaleTabs({
  activeLocale,
  disabled = false,
  onSelect,
  translations,
}: LocaleTabsProps) {
  return (
    <div
      aria-label="翻译版本"
      className="grid grid-cols-1 border-y border-neutral-200 sm:grid-cols-3"
      role="tablist"
    >
      {(Object.keys(localeLabels) as AdminContentLocale[]).map((locale) => {
        const active = locale === activeLocale;
        const translation = translations[locale];
        const complete = isTranslationComplete(translation);
        const status = translation?.status ?? "draft";

        return (
          <button
            aria-controls={`translation-panel-${locale}`}
            aria-selected={active}
            className={`min-h-16 min-w-0 cursor-pointer break-words border-b-2 px-4 py-2 text-left transition-[background-color,color,border-color] duration-[var(--motion-fast)] sm:border-b-2 ${
              active
                ? "border-[var(--color-cyan-ink)] bg-white text-[var(--color-text)]"
                : "border-transparent bg-transparent text-neutral-600 hover:bg-white/70 hover:text-[var(--color-text)]"
            }`}
            id={`translation-tab-${locale}`}
            key={locale}
            disabled={disabled}
            onClick={() => onSelect(locale)}
            role="tab"
            type="button"
          >
            <span className="block text-sm font-semibold">{localeLabels[locale]}</span>
            <span className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
              <span className={complete ? "text-[var(--color-teal-ink)]" : "text-[var(--color-danger)]"}>
                {complete ? "已完成" : "需要处理"}
              </span>
              <span className="text-neutral-500">{status === "published" ? "已发布" : status === "scheduled" ? "已定时" : "草稿"}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
