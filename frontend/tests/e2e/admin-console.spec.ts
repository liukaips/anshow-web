import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./admin-auth";

test("Admin shell is aligned and user-visible copy is Chinese", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto("/admin/content/services");

  await expect(page.getByRole("heading", { name: "服务内容" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "管理后台" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByText(/Multilingual content|Published|draft/i),
  ).toHaveCount(0);
});
