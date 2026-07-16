import type { AdminContentTranslationInput } from "../../../../api/admin-content";
import { AdminFormField } from "../../ui/admin-form-field";
import type { ContentFieldErrors, TranslationField } from "./content-validation";

type ChineseContentStepProps = {
  disabled: boolean;
  errors: ContentFieldErrors;
  onChange: (field: TranslationField, value: string) => void;
  value: AdminContentTranslationInput;
};

const inputClass =
  "min-h-11 w-full rounded-[var(--radius-control)] border border-neutral-300 bg-white px-3 py-2 text-base text-[var(--color-text)] outline-none transition-[border-color,box-shadow] duration-[var(--motion-fast)] focus:border-[var(--color-cyan-ink)] focus:ring-2 focus:ring-sky-100 disabled:bg-neutral-100";

export function ChineseContentStep({ disabled, errors, onChange, value }: ChineseContentStepProps) {
  const field = (
    name: "title" | "summary" | "body",
    label: string,
    help: string,
    multiline = false,
  ) => (
    <AdminFormField error={errors[name]} help={help} htmlFor={`translation-${name}`} label={label} required>
      {multiline ? (
        <textarea
          className={inputClass}
          disabled={disabled}
          id={`translation-${name}`}
          onChange={(event) => onChange(name, event.target.value)}
          rows={name === "body" ? 10 : 4}
          value={value[name]}
        />
      ) : (
        <input
          className={inputClass}
          disabled={disabled}
          id={`translation-${name}`}
          onChange={(event) => onChange(name, event.target.value)}
          type="text"
          value={value[name]}
        />
      )}
    </AdminFormField>
  );

  return (
    <section aria-labelledby="chinese-content-heading" className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text)]" id="chinese-content-heading">
          中文主要内容
        </h2>
        <p className="mt-1 text-sm leading-6 text-neutral-600">
          先把官网访客最关心的信息写清楚，系统会自动保存为草稿。
        </p>
      </div>
      {field("title", "标题", "填写内容名称，建议 4–30 个字，会显示在页面标题和内容列表中。")}
      {field("summary", "一句话介绍", "用一两句话概括核心价值，建议不超过 80 个字。", true)}
      {field("body", "详细说明", "说明服务范围、流程、优势和注意事项。", true)}
    </section>
  );
}
