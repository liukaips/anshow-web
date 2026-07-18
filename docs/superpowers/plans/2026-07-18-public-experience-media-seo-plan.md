# Public Experience, Media, and SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the PPT-derived database content into a high-quality, fast, multilingual public website with evidence-led UI, accurate media, purposeful motion, and complete technical SEO.

**Architecture:** Continue using the existing server-rendered Next.js public routes and typed Hono API. Add a safe structured-content renderer, compose the homepage from focused data-driven sections, reuse the current GSAP/media pipeline, and extend the existing SEO helpers rather than introducing a second metadata system.

**Tech Stack:** Next.js 16, React 19, next-intl, Tailwind CSS 4, GSAP 3, Three.js, Lucide React, Sharp, Vitest, Testing Library, Playwright.

---

## File Structure

- Create `frontend/src/components/public/structured-content.tsx`: render validated body sections.
- Create `frontend/src/components/public/structured-content.test.tsx`: section and legacy fallback tests.
- Create `frontend/src/components/home/trust-bar.tsx`: company facts and certificates.
- Create `frontend/src/components/home/service-commitments.tsx`: four business commitments.
- Create `frontend/src/components/home/quote-entry.tsx`: compact homepage enquiry form entry.
- Create `frontend/src/components/home/evidence-cases.tsx`: representative project grid with metrics.
- Modify `frontend/src/app/[locale]/page.tsx`: approved homepage order and database content.
- Modify `frontend/src/components/home/hero-carousel.tsx`: approved headline hierarchy and stable responsive framing.
- Modify `frontend/src/components/home/service-grid.tsx`: seven-service matrix.
- Modify `frontend/src/components/public/public-pages.tsx`: structured detail body and media fallback.
- Modify `frontend/src/components/process/process-story.client.tsx`: route/step/evidence motion budget.
- Modify `frontend/src/i18n/messages/en.json`, `zh.json`, `ru.json`: interface labels only.
- Add approved sources under `assets/source/`: real PPT company images and generated case scenes.
- Modify `content/assets/prompts.json`: approved case-image prompts and use descriptions.
- Modify `scripts/process-images.ts` and `scripts/process-images.test.ts`: mobile art direction for selected content images.
- Regenerate `content/assets/manifest.json` and `frontend/public/media/**`.
- Modify `backend/src/content/media-catalog.ts`: correct semantic aliases for new case assets.
- Modify `frontend/src/lib/seo.ts` and `frontend/src/lib/seo.test.ts`: x-default, Open Graph media, Organization, Service, Article, and Breadcrumb JSON-LD.
- Modify route metadata helpers under `frontend/src/components/public/public-route.server.tsx`.
- Modify `frontend/src/app/sitemap.ts` and `frontend/src/app/sitemap.test.ts`: published locale URLs and `x-default` verification.
- Modify `frontend/src/app/robots.ts` and `frontend/src/app/robots.test.ts`: public crawler policy and sitemap URL.
- Modify `frontend/tests/e2e/public-site.spec.ts`: three-language SEO, media, layout, and motion verification.

### Task 1: Render Structured Content Safely

**Files:**
- Create: `frontend/src/components/public/structured-content.tsx`
- Create: `frontend/src/components/public/structured-content.test.tsx`
- Modify: `frontend/src/components/public/public-pages.tsx`

- [ ] **Step 1: Write failing renderer tests**

```tsx
render(<StructuredContent body="Legacy paragraph" structuredBody={null} />);
expect(screen.getByText("Legacy paragraph")).toBeVisible();

render(<StructuredContent structuredBody={{ version: 1, sections: [
  { type: "fact-list", items: [{ key: "weight", label: "货重", value: "12", unit: "吨" }] },
  { type: "process", steps: [{ title: "资料核对", text: "确认货物与路线信息。" }] },
] }} body="" />);
expect(screen.getByText("12")).toBeVisible();
expect(screen.getByText("资料核对")).toBeVisible();
expect(document.querySelector("script")).toBeNull();
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/public/structured-content.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement an exhaustive block renderer**

Use a `switch (section.type)` with semantic `<p>`, `<dl>`, `<ol>`, `<ul>`, `<aside>`, and CTA link markup. Never use `dangerouslySetInnerHTML`. Add `assertNever(section)` so a future schema block cannot silently render incorrectly.

```tsx
export function StructuredContent({ body, structuredBody }: Props) {
  if (!structuredBody) return <p>{body}</p>;
  return <div className="space-y-10">{structuredBody.sections.map(renderSection)}</div>;
}
```

- [ ] **Step 4: Replace plain detail paragraphs**

Use `StructuredContent` in `PublicDetailPage` and `StaticContentPage`; keep the approved readable line length and do not wrap the entire detail section in a decorative card.

- [ ] **Step 5: Run focused tests**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/public/structured-content.test.tsx src/components/public/public-pages.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/public
git commit -m "Let service and case pages explain real logistics work clearly"
```

### Task 2: Recompose the Homepage Around Enquiries and Evidence

**Files:**
- Create: `frontend/src/components/home/trust-bar.tsx`
- Create: `frontend/src/components/home/service-commitments.tsx`
- Create: `frontend/src/components/home/quote-entry.tsx`
- Create: `frontend/src/components/home/evidence-cases.tsx`
- Create: `frontend/src/components/home/homepage-sections.test.tsx`
- Modify: `frontend/src/app/[locale]/page.tsx`
- Modify: `frontend/src/components/home/hero-carousel.tsx`
- Modify: `frontend/src/components/home/service-grid.tsx`
- Modify: `frontend/src/i18n/messages/en.json`
- Modify: `frontend/src/i18n/messages/zh.json`
- Modify: `frontend/src/i18n/messages/ru.json`

- [ ] **Step 1: Write failing homepage section tests**

```tsx
expect(screen.getByRole("heading", { name: "让复杂货运，变得确定。" })).toBeVisible();
expect(screen.getByRole("link", { name: "获取运输报价" })).toHaveAttribute("href", "/zh/quote");
expect(screen.getByText("2012")).toBeVisible();
expect(screen.getByText("2 小时")).toBeVisible();
expect(screen.getByText("7×24")).toBeVisible();
expect(screen.getByRole("heading", { name: /客户真正关心的四项承诺/ })).toBeVisible();
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/home/homepage-sections.test.tsx`

Expected: FAIL because the approved trust, commitments, evidence, and quote-entry sections do not exist.

- [ ] **Step 3: Implement focused section interfaces**

```ts
type TrustBarProps = { certificates: readonly HomeItem[]; proof: readonly HomeItem[] };
type ServiceCommitmentsProps = { items: readonly HomeItem[]; title: string };
type EvidenceCasesProps = { items: readonly HomeItem[]; locale: SupportedLocale; learnMore: string };
type QuoteEntryProps = { locale: SupportedLocale; labels: QuoteEntryLabels };
```

Each section receives API data through props. Do not hardcode PPT facts inside the component.

- [ ] **Step 4: Apply the approved homepage order**

Order: hero, compact quote prompt, trust bar, seven services, process story, representative cases, trade lanes, special cargo, four commitments, insights, quote entry, footer. Keep `RouteScene` unframed and ensure the next section is visible below the hero on common desktop and mobile heights.

- [ ] **Step 5: Keep interface copy in next-intl only**

Add labels such as section headings, CTA verbs, field names, and empty/error messages to all three JSON files. Company facts and published summaries remain database content.

- [ ] **Step 6: Run components and locale parity tests**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/home frontend/src/i18n/messages.test.ts`

Expected: PASS, with identical message-key sets for EN/ZH/RU.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/'[locale]'/page.tsx frontend/src/components/home frontend/src/i18n/messages
git commit -m "Make the homepage convert company evidence into qualified enquiries"
```

### Task 3: Extract, Generate, and Optimize Correct Media

**Files:**
- Add: `assets/source/anshow-office.png`
- Add: `assets/source/anshow-contact.png`
- Add: `assets/source/case-un1263-hamburg.png`
- Add: `assets/source/case-un3265-india.png`
- Add: `assets/source/case-un3480-los-angeles.png`
- Add: `assets/source/case-injection-machine-turkey.png`
- Add: `assets/source/case-excavators-tir-moscow.png`
- Add: `assets/source/case-auto-parts-rail-russia.png`
- Add: `assets/source/case-electronics-air-munich.png`
- Add: `assets/source/case-semiconductor-clearance.png`
- Modify: `content/assets/prompts.json`
- Modify: `scripts/process-images.ts`
- Modify: `scripts/process-images.test.ts`
- Modify: `content/assets/manifest.json`
- Modify: `backend/src/content/media-catalog.ts`
- Generate: `frontend/public/media/case-*/**`

- [ ] **Step 1: Add failing media-plan tests**

```ts
for (const id of CASE_ASSET_IDS) {
  expect(promptIds).toContain(id);
  expect(manifestIds).toContain(id);
}
expect(catalogAliases.air).toBe("hero-air");
expect(catalogAliases.rail).toBe("hero-rail");
```

Also verify case output includes 480, 768, and 1280 desktop AVIF/WebP plus a 320 AVIF thumbnail, and selected feature cases include a mobile 768 art-directed source.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm assets:test`

Expected: FAIL because the case assets and semantic alias assertions are absent.

- [ ] **Step 3: Extract authentic PPT images**

Use the presentation runtime to extract only the real company office/contact images. Preserve the originals under `assets/source`; do not synthesize or retouch facts, signage, certificates, or people.

- [ ] **Step 4: Generate missing case scenes**

Use the configured `fhl-image-gen` skill at execution time. Keep API credentials in plugin configuration only. Start each generation session with:

```bash
node '/Users/kai.liu/.codex/plugins/cache/fhl-plugins/fhl-image-gen/0.2.1/scripts/generate.mjs' --get-config
```

Expected: `defaultProvider` is `fhl`, `fhlApiMode` is `images`, and at least one worker is enabled. Never print or persist the full key.

Generate one 2K desktop candidate per case through the required Images API route:

```bash
node '/Users/kai.liu/.codex/plugins/cache/fhl-plugins/fhl-image-gen/0.2.1/scripts/generate.mjs' --prompt '<APPROVED_CASE_PROMPT>' --aspect 16:9
```

Generate a separate mobile composition only for selected homepage/feature cases:

```bash
node '/Users/kai.liu/.codex/plugins/cache/fhl-plugins/fhl-image-gen/0.2.1/scripts/generate.mjs' --prompt '<APPROVED_MOBILE_CASE_PROMPT>' --aspect 3:4
```

Use the current single worker sequentially; do not request arbitrary sizes, switch to Responses, or add route-selection flags. Copy the raw upstream PNG into the exact `assets/source/<id>.png` or `assets/source/<id>-mobile.png` target only after review. Every prompt must specify documentary industrial photography, correct transport mode and cargo class, realistic safety practice, no text, no logos, no branded vehicles, no identifiable customer, and safe negative space.

Reject any output that shows the wrong mode, unsafe dangerous-goods handling, distorted machinery, invented labels, or implausible dimensions. Existing valid media remains the fallback.

- [ ] **Step 5: Extend processing for selected mobile variants**

Allow content records to declare an optional `-mobile.png` source without treating every content image as a hero. Generate mobile AVIF/WebP only when that source exists.

- [ ] **Step 6: Build and verify derivatives**

Run: `pnpm assets:build && pnpm assets:verify`

Expected: zero missing sources, zero budget violations, and a manifest entry for each approved case image.

- [ ] **Step 7: Correct semantic media aliases and verify all URLs**

Map `air` to the actual air scene and `rail` to the actual rail scene after visual inspection. Add case code aliases to their corresponding case asset IDs. Start the app and assert every unique manifest URL returns HTTP 200.

- [ ] **Step 8: Commit**

```bash
git add assets/source content/assets scripts/process-images.ts scripts/process-images.test.ts frontend/public/media backend/src/content/media-catalog.ts
git commit -m "Give each logistics claim an accurate responsive visual"
```

### Task 4: Complete Database-Driven Technical SEO

**Files:**
- Modify: `frontend/src/lib/seo.ts`
- Modify: `frontend/src/lib/seo.test.ts`
- Modify: `frontend/src/components/public/public-route.server.tsx`
- Modify: `frontend/src/app/[locale]/layout.tsx`
- Modify: `frontend/src/app/sitemap.ts`
- Modify: `frontend/src/app/sitemap.test.ts`
- Modify: `frontend/src/app/robots.test.ts`
- Modify: `frontend/tests/e2e/public-site.spec.ts`

- [ ] **Step 1: Add failing metadata and JSON-LD tests**

```ts
expect(metadata.alternates?.languages).toMatchObject({
  en: "https://www.anshow.test/en/services/ocean-freight",
  zh: "https://www.anshow.test/zh/services/hai-yun-fu-wu",
  "x-default": "https://www.anshow.test/en/services/ocean-freight",
});
expect(metadata.openGraph?.images).toEqual([
  expect.objectContaining({ url: expect.stringContaining("/media/service-ocean/") }),
]);

expect(serviceJsonLd("https://www.anshow.test", item)).toMatchObject({
  "@context": "https://schema.org",
  "@type": "Service",
  name: item.title,
  provider: { "@type": "Organization", name: "AnShow" },
});
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm --filter @anshow/frontend exec vitest run src/lib/seo.test.ts src/app/sitemap.test.ts`

Expected: FAIL on `x-default`, Open Graph images, and page-specific JSON-LD.

- [ ] **Step 3: Extend `pageMetadata`**

Accept an optional public media URL and emit Open Graph plus Twitter summary-large-image data. Add `x-default` pointing to the published English alternate when available, otherwise the English locale home. Never trust an absolute URL from database content; resolve root-relative media and route paths against configured `SITE_URL`.

- [ ] **Step 4: Add factual Organization data**

Extend `organizationJsonLd` with the approved legal name, Shenzhen postal address, phone, mobile, email, founding year, and available languages. Do not add ratings, price ranges, fake coordinates, or unverified social profiles.

- [ ] **Step 5: Add route-specific structured data**

- Service and special cargo detail: `Service` plus `BreadcrumbList`.
- Insight detail: `Article` plus `BreadcrumbList`, using published title/description/image and no invented author person.
- Case detail: `Article` with `articleSection: "Representative logistics project"` plus `BreadcrumbList`.
- Contact: `ContactPage` referencing the Organization.

Serialize only with existing `serializeJsonLd` and render one or more `application/ld+json` scripts server-side.

- [ ] **Step 6: Keep sitemap and robots publication-safe**

Sitemap includes only published public routes and actual language alternates. Preview and Admin routes remain absent. `robots.txt` disallows `/admin/`, `/preview/`, and `/api/` and references the configured sitemap.

- [ ] **Step 7: Add E2E source assertions**

For EN/ZH/RU service and case detail pages, assert one canonical URL, correct `hreflang` links including `x-default`, non-empty description, OG image, and parseable JSON-LD. Assert preview responses have `noindex` metadata and `x-robots-tag`.

- [ ] **Step 8: Run SEO verification and commit**

Run: `pnpm --filter @anshow/frontend exec vitest run src/lib/seo.test.ts src/app/sitemap.test.ts src/app/robots.test.ts && pnpm openapi:check`

```bash
git add frontend/src/lib/seo.ts frontend/src/lib/seo.test.ts frontend/src/components/public/public-route.server.tsx frontend/src/app frontend/tests/e2e/public-site.spec.ts
git commit -m "Help search engines understand every published logistics page"
```

### Task 5: Refine Motion Without Sacrificing Mobile Performance

**Files:**
- Modify: `frontend/src/components/process/process-story.client.tsx`
- Modify: `frontend/src/components/process/process-story.test.tsx`
- Modify: `frontend/src/components/home/hero-carousel.tsx`
- Modify: `frontend/src/components/home/hero-carousel.test.tsx`
- Modify: `frontend/src/styles/tokens.css`
- Modify: `frontend/src/app/globals.css`

- [ ] **Step 1: Add failing reduced-motion and stability tests**

Assert that reduced motion renders all steps active without dynamically importing GSAP, carousel autoplay is disabled, image wrappers keep a declared aspect ratio, and progress controls have stable dimensions and accessible labels.

- [ ] **Step 2: Run and verify failure**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/process/process-story.test.tsx src/components/home/hero-carousel.test.tsx`

Expected: FAIL on the newly tightened motion and layout requirements.

- [ ] **Step 3: Implement one scroll timeline**

Keep one GSAP context per process story. Animate only transforms and opacity. Use `once: true` for ordinary reveals, make route and step timelines interruptible, and clean up every ScrollTrigger on unmount.

- [ ] **Step 4: Apply stable responsive constraints**

Use `min-h-dvh`, `aspect-ratio`, `minmax(0, 1fr)`, and fixed control dimensions. Mobile switches process stages to normal vertical content and removes desktop-only parallax/Three.js layers.

- [ ] **Step 5: Run component verification**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/process src/components/home`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/process frontend/src/components/home/hero-carousel.tsx frontend/src/components/home/hero-carousel.test.tsx frontend/src/styles/tokens.css frontend/src/app/globals.css
git commit -m "Make route storytelling fluid without making the site feel heavy"
```

### Task 6: Run Public Visual and Browser Acceptance

**Files:**
- Modify: `frontend/tests/e2e/public-site.spec.ts`
- Create: `frontend/tests/e2e/public-visual.spec.ts`
- Modify: `docs/delivery/EXTERNAL-TODO.md`

- [ ] **Step 1: Add route and viewport coverage**

Test `/en`, `/zh`, `/ru`, services, special cargo, trade lanes, case studies, about, contact, quote, and insights at 375, 768, 1024, and 1440 widths.

- [ ] **Step 2: Add layout invariants**

```ts
expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
expect(await page.locator("img").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0))).toBe(true);
```

Assert no large empty media placeholders, text overlap, zero-height sections, or aspect-ratio distortion.

- [ ] **Step 3: Capture Chrome desktop/mobile screenshots**

Save deterministic full-page screenshots for the three locale homepages plus services, cases, and Admin preview parity. Review every screenshot before changing baselines.

- [ ] **Step 4: Run Safari-equivalent WebKit checks**

Run the same critical routes with Playwright WebKit and verify the prior Chrome/Safari blank-space issue is absent.

- [ ] **Step 5: Record only external items that cannot be completed locally**

`EXTERNAL-TODO.md` may contain domain/DNS, real certificate files, or production analytics ownership. Do not add generated images or local testing as external TODOs.

- [ ] **Step 6: Run full public verification and commit**

Run: `pnpm --filter @anshow/frontend test && pnpm --filter @anshow/frontend lint && pnpm --filter @anshow/frontend typecheck && pnpm --filter @anshow/frontend build && pnpm --filter @anshow/frontend test:e2e -- public-site.spec.ts public-visual.spec.ts`

Expected: PASS in Chromium and WebKit.

```bash
git add frontend/tests/e2e docs/delivery/EXTERNAL-TODO.md
git commit -m "Prove the public site is readable, crawlable, and complete"
```
