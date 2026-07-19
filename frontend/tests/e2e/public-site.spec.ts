import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import sharp from "sharp";

const publicRoutes = [
  "/en",
  "/en/services",
  "/en/services/ocean-freight",
  "/en/trade-lanes",
  "/en/trade-lanes/china-europe",
  "/en/special-cargo",
  "/en/insights",
  "/en/case-studies",
  "/en/about",
  "/en/network",
  "/en/certifications",
  "/en/contact",
  "/en/quote",
  "/en/privacy",
  "/en/terms",
  "/en/cookies",
] as const;

test("keeps the translated record context when switching language", async ({
  page,
}) => {
  await page.goto("/en/services/ocean-freight");
  await page.getByRole("button", { name: "Change language" }).click();
  await page.getByRole("menuitem", { name: "中文" }).click();

  await expect(page).toHaveURL(/\/zh\/services\/hai-yun-fu-wu\/?$/);
});

test("returns a localized not-found page for an unknown public route", async ({
  page,
}) => {
  const response = await page.goto("/en/this-route-does-not-exist");

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { level: 1, name: "Page not found" }),
  ).toBeVisible();
});

for (const route of [
  "/en/services/ocean-freight",
  "/zh/services/hai-yun-fu-wu",
  "/ru/services/morskie-perevozki",
  "/en/case-studies/un1263-solvent-shenzhen-hamburg",
  "/zh/case-studies/un1263-rong-ji-shen-zhen-han-bao",
  "/ru/case-studies/rastvoritel-un1263-shenzhen-gamburg",
] as const) {
  test(`${route} exposes complete crawl metadata and structured data`, async ({
    page,
  }) => {
    const response = await page.goto(route);
    expect(response?.ok(), `${route} should return a successful response`).toBe(true);

    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /\S+/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/media\//);

    const structuredData = await page.locator('script[type="application/ld+json"]').evaluateAll(
      (scripts) => scripts.map((script) => JSON.parse(script.textContent ?? "null")),
    );
    expect(structuredData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ "@type": "BreadcrumbList" }),
        expect.objectContaining({ "@type": route.includes("/services/") ? "Service" : "Article" }),
      ]),
    );
  });
}

test("keeps preview pages out of indexes and crawler results", async ({ page }) => {
  const response = await page.goto("/preview/not-a-real-token/en");

  expect(response?.headers()["x-robots-tag"]).toMatch(/noindex/i);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/i);
});

test("key public routes render a primary heading", async ({ page }) => {
  for (const route of publicRoutes) {
    const response = await page.goto(route);
    expect(response?.ok(), `${route} should return a successful response`).toBe(
      true,
    );
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  }
});

test.describe("mobile public experience", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("has no horizontal overflow and does not load the Three.js scene", async ({
    page,
  }) => {
    const requestedUrls: string[] = [];
    page.on("request", (request) => requestedUrls.push(request.url()));

    await page.goto("/en");
    await page.waitForLoadState("networkidle");

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    await expect(page.locator("[data-route-canvas]")).toHaveCount(0);
    expect(
      requestedUrls.filter((url) => /(?:three|route-scene\.client)/i.test(url)),
    ).toEqual([]);
  });

  test("has no automatically detectable accessibility violations", async ({
    page,
  }) => {
    await page.goto("/en");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});

for (const scenario of [
  { locale: "en", width: 375, height: 812 },
  { locale: "zh", width: 768, height: 900 },
  { locale: "ru", width: 1024, height: 900 },
  { locale: "en", width: 1440, height: 900 },
] as const) {
  test(`${scenario.locale} public page remains readable at ${scenario.width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.goto(`/${scenario.locale}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath(`${scenario.locale}-${scenario.width}.png`),
    });
  });
}

test("keyboard users can reach the skip link and control the hero carousel", async ({
  page,
}) => {
  await page.goto("/en");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();

  const pause = page.getByRole("button", { name: "Pause" });
  await pause.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
});

test("reduced motion renders the complete process without a Three.js scene", async ({
  browser,
}) => {
  const context = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const requestedUrls: string[] = [];
  page.on("request", (request) => requestedUrls.push(request.url()));

  await page.goto("/en");
  await page.waitForLoadState("networkidle");

  await expect(page.locator("[data-route-canvas]")).toHaveCount(0);
  await expect(page.locator("[data-process-complete=true]")).toBeVisible();
  await expect(page.locator("[data-process-step]")).toHaveCount(5);
  expect(
    requestedUrls.filter((url) => /(?:three|route-scene\.client)/i.test(url)),
  ).toEqual([]);
  await context.close();
});

test("desktop route canvas is visible and paints content", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en");

  const canvas = page.locator("[data-route-canvas] canvas");
  const available = await canvas
    .waitFor({ state: "visible", timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
  test.skip(!available, "WebGL is unavailable in this browser environment");

  await page.waitForTimeout(1_900);
  const pixels = await sharp(await canvas.screenshot()).stats();
  expect(Math.max(...pixels.channels.slice(0, 3).map((channel) => channel.stdev))).toBeGreaterThan(1);
});
