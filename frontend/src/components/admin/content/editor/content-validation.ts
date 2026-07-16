import type { AdminContentTranslationInput } from "../../../../api/admin-content";

export type TranslationField = keyof AdminContentTranslationInput;
export type ContentFieldErrors = Partial<Record<TranslationField, string>>;

const requiredFieldMessages: Record<TranslationField, string> = {
  title: "请填写内容名称",
  slug: "请填写网址别名",
  summary: "请填写一句话介绍",
  body: "请填写详细说明",
  seoTitle: "请填写 SEO 标题",
  seoDescription: "请填写 SEO 描述",
  altText: "请填写图片说明",
};

export function validateChineseContent(
  input: Pick<AdminContentTranslationInput, "title" | "summary" | "body">,
): ContentFieldErrors {
  const errors: ContentFieldErrors = {};
  if (!input.title.trim()) errors.title = requiredFieldMessages.title;
  if (!input.summary.trim()) errors.summary = requiredFieldMessages.summary;
  if (!input.body.trim()) errors.body = requiredFieldMessages.body;
  return errors;
}

export function validatePublishableContent(
  input: AdminContentTranslationInput,
): ContentFieldErrors {
  const errors: ContentFieldErrors = {};
  for (const field of Object.keys(requiredFieldMessages) as TranslationField[]) {
    if (!input[field].trim()) errors[field] = requiredFieldMessages[field];
  }
  if (input.slug && !/^[a-z0-9-]+$/.test(input.slug)) {
    errors.slug = "网址别名只能使用小写英文字母、数字和连字符";
  }
  if (input.seoTitle.length > 60) {
    errors.seoTitle = "SEO 标题不能超过 60 个字符";
  }
  if (input.seoDescription.length > 160) {
    errors.seoDescription = "SEO 描述不能超过 160 个字符";
  }
  return errors;
}

export function firstContentErrorField(
  errors: ContentFieldErrors,
): TranslationField | undefined {
  return (Object.keys(requiredFieldMessages) as TranslationField[]).find(
    (field) => errors[field],
  );
}
