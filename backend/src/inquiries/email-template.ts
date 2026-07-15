export type InquiryEmailInput = {
  id: string;
  locale: "en" | "zh" | "ru";
  sourceUrl: string;
  email: string;
  phone: string;
  transportNeed: string;
  message: string;
};

const subjects = {
  en: "New AnShow logistics enquiry",
  zh: "新的 AnShow 物流询盘",
  ru: "Новый запрос AnShow по логистике",
} as const;

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
      character
    ]!,
  );

export function renderSalesEmail(input: InquiryEmailInput): { subject: string; html: string } {
  const contact = input.email || input.phone;
  return {
    subject: subjects[input.locale],
    html: `<h1>New enquiry</h1><dl><dt>ID</dt><dd>${escapeHtml(input.id)}</dd><dt>Locale</dt><dd>${escapeHtml(input.locale)}</dd><dt>Source</dt><dd>${escapeHtml(input.sourceUrl)}</dd><dt>Contact</dt><dd>${escapeHtml(contact)}</dd><dt>Requirement</dt><dd>${escapeHtml(input.transportNeed)}</dd></dl><p>${escapeHtml(input.message)}</p>`,
  };
}

export function renderVisitorEmail(locale: InquiryEmailInput["locale"]): { subject: string; html: string } {
  const body = locale === "zh"
    ? "感谢您的询盘。AnShow 团队将根据您提供的信息与您联系。"
    : locale === "ru"
      ? "Спасибо за запрос. Команда AnShow свяжется с вами по указанным контактам."
      : "Thank you for your enquiry. The AnShow team will follow up using the contact details you provided.";
  return { subject: "AnShow enquiry received", html: `<p>${body}</p>` };
}
