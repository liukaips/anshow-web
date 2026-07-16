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

const adminRoutes = [
  "/admin",
  "/admin/content/services",
  "/admin/reviews",
  "/admin/publish",
  "/admin/inquiries",
  "/admin/media",
  "/admin/staff",
  "/admin/settings",
  "/admin/audit",
] as const;

const forbiddenAdminCopy =
  /Media Library could not be loaded|Try again|Save metadata|Delete media|Replace media|Focal X|Focal Y|Alt text|References|Permission-aware workspace|Multilingual content|Unsaved changes/i;

for (const viewport of [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1440, height: 900 },
] as const) {
  test(`Admin routes remain readable and Chinese on ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await loginAsAdmin(page);

    for (const route of adminRoutes) {
      const response = await page.goto(route);
      expect(response?.ok(), `${route} should load`).toBe(true);
      await expect(page.locator("#admin-main")).toBeVisible();
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
        `${route} should not overflow horizontally`,
      ).toBe(true);
      await expect(page.locator("body")).not.toContainText(forbiddenAdminCopy);
    }

    await page.goto("/admin/media");
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath(`admin-media-${viewport.width}.png`),
    });
  });
}

test("mobile Admin navigation opens, traps focus, and closes", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await loginAsAdmin(page);

  const trigger = page.getByRole("button", { name: "打开导航" });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "管理后台导航" })).toBeVisible();
  await expect(page.getByRole("button", { name: "关闭导航" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "管理后台导航" })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
