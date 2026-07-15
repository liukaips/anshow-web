import { describe, expect, it } from "vitest";
import { renderSalesEmail, renderVisitorEmail } from "./email-template.js";

describe("inquiry email templates", () => {
  it("escapes visitor-controlled content", () => {
    const email = renderSalesEmail({ id: "id", locale: "en", sourceUrl: "/<x>", email: "a@example.test", phone: "", transportNeed: "<script>", message: "<script>alert(1)</script>" });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });
  it("provides localized acknowledgement text", () => {
    expect(renderVisitorEmail("zh").html).toContain("感谢");
    expect(renderVisitorEmail("ru").html).toContain("Спасибо");
  });
});
