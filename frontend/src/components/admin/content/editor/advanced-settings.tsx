import type { AdminContentTranslationInput } from "../../../../api/admin-content";
import { AdminFormField } from "../../ui/admin-form-field";
import type { ContentFieldErrors, TranslationField } from "./content-validation";

type AdvancedSettingsProps = {
  disabled: boolean;
  errors: ContentFieldErrors;
  onChange: (field: TranslationField, value: string) => void;
  value: AdminContentTranslationInput;
};

const inputClass =
  "min-h-11 w-full rounded-[var(--radius-control)] border border-neutral-300 bg-white px-3 py-2 text-base text-[var(--color-text)] outline-none focus:border-[var(--color-cyan-ink)] focus:ring-2 focus:ring-sky-100 disabled:bg-neutral-100";

export function AdvancedSettings({ disabled, errors, onChange, value }: AdvancedSettingsProps) {
  return (
    <details className="group rounded-[var(--radius-card)] border border-neutral-200 bg-neutral-50" open={Boolean(errors.slug || errors.seoTitle || errors.seoDescription || errors.altText)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--color-text)] marker:content-none">
        高级设置
        <span aria-hidden="true" className="text-neutral-500 transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="grid gap-5 border-t border-neutral-200 bg-white p-4 lg:grid-cols-2">
        <AdminFormField error={errors.slug} help="一般无需修改；仅可使用小写英文字母、数字和连字符。" htmlFor="translation-slug" label="网址别名">
          <input className={inputClass} disabled={disabled} id="translation-slug" onChange={(event) => onChange("slug", event.target.value)} value={value.slug} />
        </AdminFormField>
        <AdminFormField count={{ current: value.seoTitle.length, maximum: 60 }} error={errors.seoTitle} help="显示在搜索结果标题中。" htmlFor="translation-seoTitle" label="SEO 标题">
          <input className={inputClass} disabled={disabled} id="translation-seoTitle" maxLength={60} onChange={(event) => onChange("seoTitle", event.target.value)} value={value.seoTitle} />
        </AdminFormField>
        <div className="lg:col-span-2">
          <AdminFormField count={{ current: value.seoDescription.length, maximum: 160 }} error={errors.seoDescription} help="用完整句子描述页面内容，便于搜索引擎理解。" htmlFor="translation-seoDescription" label="SEO 描述">
            <textarea className={inputClass} disabled={disabled} id="translation-seoDescription" maxLength={160} onChange={(event) => onChange("seoDescription", event.target.value)} rows={4} value={value.seoDescription} />
          </AdminFormField>
        </div>
        <div className="lg:col-span-2">
          <AdminFormField error={errors.altText} help="为看不到图片的访客描述画面内容。" htmlFor="translation-altText" label="图片说明">
            <input className={inputClass} disabled={disabled} id="translation-altText" onChange={(event) => onChange("altText", event.target.value)} value={value.altText} />
          </AdminFormField>
        </div>
      </div>
    </details>
  );
}
