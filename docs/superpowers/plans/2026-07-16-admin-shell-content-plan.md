# Admin Shell and Content Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the misaligned, mixed-language Admin shell and technical content screens with a stable Chinese enterprise console and a non-technical content creation/editing flow.

**Architecture:** Introduce a focused Admin UI layer under `frontend/src/components/admin/ui`, then migrate the shell, collection list, media selector, and content editor onto it. Keep existing public APIs compatible while changing content creation to accept a Chinese business title and generate internal identifiers server-side.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Lucide React, Hono, Drizzle ORM, SQLite, Vitest, Testing Library, Playwright.

---

## File Structure

- Create `frontend/src/components/admin/ui/admin-page.tsx`: shared page header and content container.
- Create `frontend/src/components/admin/ui/admin-toolbar.tsx`: search/filter/action row.
- Create `frontend/src/components/admin/ui/admin-data-table.tsx`: semantic desktop table with shared loading and empty states.
- Create `frontend/src/components/admin/ui/admin-responsive-list.tsx`: mobile rendering for the same row model.
- Create `frontend/src/components/admin/ui/admin-status.tsx`: Chinese status labels and colors.
- Create `frontend/src/components/admin/ui/admin-form-field.tsx`: labels, help, validation, and counts.
- Create `frontend/src/components/admin/ui/admin-feedback.tsx`: empty, loading, error, toast, and confirmation patterns.
- Create `frontend/src/components/admin/content/content-labels.ts`: collection, locale, status, and field labels.
- Create `frontend/src/components/admin/content/content-list.tsx`: business-facing desktop table and mobile list.
- Create `frontend/src/components/admin/content/editor/content-editor-shell.tsx`: editor header, autosave status, and navigation guard.
- Create `frontend/src/components/admin/content/editor/chinese-content-step.tsx`: primary Chinese fields.
- Create `frontend/src/components/admin/content/editor/media-step.tsx`: media choice and focal-point interaction.
- Create `frontend/src/components/admin/content/editor/advanced-settings.tsx`: collapsed slug, SEO, order, and process settings.
- Create `frontend/src/components/admin/content/editor/content-validation.ts`: deterministic client validation.
- Modify `frontend/src/components/admin/admin-sidebar.tsx`: aligned grouped Chinese navigation.
- Modify `frontend/src/components/admin/admin-topbar.tsx`: breadcrumb, help, account menu, and feedback.
- Modify `frontend/src/app/admin/(protected)/layout.tsx`: stable 232px shell.
- Modify `frontend/src/components/admin/content-collection-list.tsx`: replace with wrapper around the new list.
- Split `frontend/src/components/admin/content-editor.tsx`: preserve orchestration only.
- Modify `backend/src/admin/content/content-schema.ts`: accept business title when creating content.
- Modify `backend/src/admin/repositories/content-repository.ts`: generate unique code and Chinese slug.
- Modify `backend/src/admin/routes/content.ts`: expose the updated create contract.
- Regenerate `openapi/anshow.json` and `frontend/src/generated/api.ts`.
- Create `frontend/tests/e2e/admin-console.spec.ts`: alignment, Chinese copy, keyboard, and mobile checks.

### Task 1: Lock the Current Admin Contracts and Add Visual Regression Coverage

**Files:**
- Create: `frontend/tests/e2e/admin-console.spec.ts`
- Create: `frontend/tests/e2e/admin-auth.ts`
- Modify: `frontend/playwright.config.ts`
- Test: `frontend/tests/e2e/admin-console.spec.ts`

- [ ] **Step 1: Add an authenticated Admin E2E helper**

```ts
import type { Page } from "@playwright/test";

export async function loginAsAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("邮箱").fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel("密码").fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL("**/admin");
}
```

- [ ] **Step 2: Add failing alignment and Chinese-copy tests**

```ts
test("Admin shell is aligned and user-visible copy is Chinese", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/content/services");
  await expect(page.getByRole("heading", { name: "服务内容" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "管理后台" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(page.getByText(/Multilingual content|Published|draft/i)).toHaveCount(0);
});
```

- [ ] **Step 3: Run the test and confirm the baseline fails**

Run: `E2E_ADMIN_EMAIL=admin@example.test E2E_ADMIN_PASSWORD=Admin123! pnpm --filter @anshow/frontend test:e2e -- admin-console.spec.ts`

Expected: FAIL because the current heading/copy/layout does not satisfy the new contract.

- [ ] **Step 4: Commit the regression test**

```bash
git add frontend/tests/e2e/admin-console.spec.ts frontend/tests/e2e/admin-auth.ts frontend/playwright.config.ts
git commit -m "Lock the Admin rebuild against operator-facing regressions"
```

### Task 2: Build the Admin UI Primitives

**Files:**
- Create: `frontend/src/components/admin/ui/admin-page.tsx`
- Create: `frontend/src/components/admin/ui/admin-toolbar.tsx`
- Create: `frontend/src/components/admin/ui/admin-status.tsx`
- Create: `frontend/src/components/admin/ui/admin-form-field.tsx`
- Create: `frontend/src/components/admin/ui/admin-feedback.tsx`
- Create: `frontend/src/components/admin/ui/admin-ui.test.tsx`

- [ ] **Step 1: Write component tests for page, status, field, and empty state**

```tsx
render(<AdminStatus status="review_pending" />);
expect(screen.getByText("待审核")).toBeVisible();

render(<AdminFormField label="服务名称" required help="建议 4-20 个字"><input /></AdminFormField>);
expect(screen.getByText("必填")).toBeVisible();
expect(screen.getByText("建议 4-20 个字")).toBeVisible();

render(<AdminDataTable columns={COLUMNS} rows={ROWS} mobileLabel={(row) => row.title} />);
expect(screen.getByRole("table")).toBeVisible();
```

- [ ] **Step 2: Run tests and verify missing modules fail**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/ui/admin-ui.test.tsx`

Expected: FAIL with module-not-found errors.

- [ ] **Step 3: Implement the primitive interfaces**

```ts
export type AdminDisplayStatus =
  | "draft"
  | "translation_pending"
  | "review_pending"
  | "changes_requested"
  | "approved"
  | "scheduled"
  | "published"
  | "archived";

export const ADMIN_STATUS_LABELS: Record<AdminDisplayStatus, string> = {
  draft: "草稿",
  translation_pending: "翻译待确认",
  review_pending: "待审核",
  changes_requested: "需修改",
  approved: "已批准",
  scheduled: "定时发布",
  published: "已发布",
  archived: "已归档",
};
```

- [ ] **Step 4: Run tests and lint**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/ui/admin-ui.test.tsx && pnpm --filter @anshow/frontend lint`

Expected: PASS.

- [ ] **Step 5: Commit the primitives**

```bash
git add frontend/src/components/admin/ui
git commit -m "Give Admin screens a shared enterprise UI vocabulary"
```

### Task 3: Rebuild the Admin Shell and Navigation

**Files:**
- Modify: `frontend/src/components/admin/admin-sidebar.tsx`
- Modify: `frontend/src/components/admin/admin-topbar.tsx`
- Modify: `frontend/src/app/admin/(protected)/layout.tsx`
- Modify: `frontend/src/components/admin/admin-sidebar.test.tsx`

- [ ] **Step 1: Extend shell tests for grouped Chinese navigation and responsive behavior**

```tsx
expect(screen.getByText("工作")).toBeVisible();
expect(screen.getByText("内容")).toBeVisible();
expect(screen.getByText("业务")).toBeVisible();
expect(screen.getByText("系统")).toBeVisible();
expect(screen.queryByText("Permission-aware workspace")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the shell tests and verify failure**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/admin-sidebar.test.tsx`

Expected: FAIL on the English footer and old section grouping.

- [ ] **Step 3: Implement the stable shell grid**

```tsx
<div
  lang="zh-CN"
  className="grid min-h-dvh grid-cols-1 bg-neutral-100 text-neutral-950 md:grid-cols-[232px_minmax(0,1fr)]"
>
  <AdminSidebar permissions={session.permissions} />
  <div className="min-w-0 overflow-x-clip">
    <AdminTopbar email={session.user.email} navigation={<AdminMobileNavigation permissions={session.permissions} />} />
    {children}
  </div>
</div>
```

- [ ] **Step 4: Replace sidebar technical copy and normalize dimensions**

Use 64px logo/topbar heights, 44px navigation rows, Chinese section labels, and `overflow-y-auto overflow-x-hidden` on the sidebar body.

- [ ] **Step 5: Run component and E2E checks**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/admin-sidebar.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the shell**

```bash
git add frontend/src/components/admin/admin-sidebar.tsx frontend/src/components/admin/admin-topbar.tsx frontend/src/app/admin/'(protected)'/layout.tsx frontend/src/components/admin/admin-sidebar.test.tsx
git commit -m "Make the Admin shell stable and fully Chinese"
```

### Task 4: Replace Technical Collection Rows with a Business Table

**Files:**
- Create: `frontend/src/components/admin/content/content-labels.ts`
- Create: `frontend/src/components/admin/content/content-list.tsx`
- Create: `frontend/src/components/admin/content/content-list.test.tsx`
- Modify: `frontend/src/components/admin/content-collection-list.tsx`
- Modify: `frontend/src/app/admin/(protected)/content/[collection]/page.tsx`

- [ ] **Step 1: Write a failing list test using real Admin item shape**

```tsx
render(<ContentList collection="services" items={[ITEM]} canWrite />);
expect(screen.getByRole("columnheader", { name: "内容名称" })).toBeVisible();
expect(screen.getByText("三语已完成")).toBeVisible();
expect(screen.queryByText("ocean-freight")).not.toBeInTheDocument();
expect(screen.queryByText("Published")).not.toBeInTheDocument();
```

- [ ] **Step 2: Verify the test fails**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/content/content-list.test.tsx`

Expected: FAIL because `ContentList` does not exist.

- [ ] **Step 3: Implement label and derived-progress helpers**

```ts
export function translationProgress(item: AdminContentItem): string {
  const complete = (["zh", "en", "ru"] as const).filter((locale) =>
    isTranslationComplete(item.translations[locale]),
  ).length;
  return complete === 3 ? "三语已完成" : `${complete}/3 已完成`;
}
```

- [ ] **Step 4: Implement desktop table and mobile list from the same data**

Use semantic `<table>` at `md` and `<ul>` below `md`. Expose name, owner (show “未分配” when empty), translation progress, Chinese publication status, update time, and a text action. Do not render `item.code` in the default row.

- [ ] **Step 5: Replace English page headings and loading/error copy**

Change `Multilingual content`, `Review publication state...`, and collection error/loading screens to Chinese copy defined in `content-labels.ts`.

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/content/content-list.test.tsx src/components/admin/content-collection-list.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit the content table**

```bash
git add frontend/src/components/admin/content frontend/src/components/admin/content-collection-list.tsx frontend/src/app/admin/'(protected)'/content/'[collection]'
git commit -m "Present content collections in operator language"
```

### Task 5: Generate Internal Codes and Slugs from the Chinese Title

**Files:**
- Modify: `backend/src/admin/content/content-schema.ts`
- Create: `backend/src/admin/content/content-identifiers.ts`
- Create: `backend/src/admin/content/content-identifiers.test.ts`
- Modify: `backend/src/admin/repositories/content-repository.ts`
- Modify: `backend/src/admin/routes/content.ts`
- Modify: `backend/src/admin/routes/content.test.ts`
- Regenerate: `openapi/anshow.json`
- Regenerate: `frontend/src/generated/api.ts`

- [ ] **Step 1: Write identifier tests**

```ts
expect(contentIdentifier("冷链运输服务")).toMatch(/^content-[a-f0-9]{8}$/);
expect(uniqueIdentifier("服务", new Set(["content-abcd1234"]))).not.toBe("content-abcd1234");
expect(slugFromTitle("Air Freight", "en")).toBe("air-freight");
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --filter @anshow/backend exec vitest run src/admin/content/content-identifiers.test.ts`

Expected: FAIL because the identifier module does not exist.

- [ ] **Step 3: Define the create request**

```ts
export const createContentInputSchema = z.object({
  titleZh: z.string().trim().min(1).max(200),
});
```

- [ ] **Step 4: Implement deterministic-safe identifiers**

Generate a human-readable ASCII slug when the title contains Latin text; otherwise use `content-${sha256(title).slice(0, 8)}`. Check existing codes/slugs and append `-2`, `-3`, and so on until unique.

- [ ] **Step 5: Update repository creation transaction**

Insert the base record and a Chinese draft with `title=titleZh`; initialize English and Russian drafts empty. Return the same `AdminContentItem` response shape.

- [ ] **Step 6: Update route tests**

Assert that POST accepts `{ titleZh: "冷链运输服务" }`, rejects blank titles, never accepts a client-provided code, and records an audit entry.

- [ ] **Step 7: Regenerate OpenAPI types**

Run: `pnpm openapi:generate && pnpm openapi:check`

Expected: generated client input contains `titleZh` and no required `code`.

- [ ] **Step 8: Commit the contract change**

```bash
git add backend/src/admin/content backend/src/admin/repositories/content-repository.ts backend/src/admin/routes/content.ts backend/src/admin/routes/content.test.ts openapi/anshow.json frontend/src/generated/api.ts
git commit -m "Remove internal identifiers from content creation"
```

### Task 6: Split the Content Editor into Focused Steps

**Files:**
- Create: `frontend/src/components/admin/content/editor/content-editor-shell.tsx`
- Create: `frontend/src/components/admin/content/editor/chinese-content-step.tsx`
- Create: `frontend/src/components/admin/content/editor/advanced-settings.tsx`
- Create: `frontend/src/components/admin/content/editor/content-validation.ts`
- Create: `frontend/src/components/admin/content/editor/content-validation.test.ts`
- Modify: `frontend/src/components/admin/content-editor.tsx`
- Modify: `frontend/src/components/admin/content-editor.test.tsx`

- [ ] **Step 1: Extract and test validation without React**

```ts
expect(validateChineseContent({ title: "", summary: "", body: "" })).toEqual({
  title: "请填写内容名称",
  summary: "请填写一句话介绍",
  body: "请填写详细说明",
});
```

- [ ] **Step 2: Run validation tests and verify failure**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/content/editor/content-validation.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement `ContentEditorShell`**

The shell owns autosave status, step navigation, dirty state, command feedback, and the sticky action bar. Child steps receive values and callbacks; they do not call APIs directly.

- [ ] **Step 4: Implement the Chinese content step**

Use `AdminFormField` for title, summary, and body. Show generated URL as read-only help. Do not show code, publication tuple, or English status values.

- [ ] **Step 5: Move slug, SEO, sort order, and process stage into `AdvancedSettings`**

Keep the section collapsed by default and label every field in Chinese. Preserve existing validation limits of 60 characters for SEO title and 160 for SEO description.

- [ ] **Step 6: Reduce `content-editor.tsx` to orchestration**

Keep API reconciliation and navigation-guard behavior, but render the extracted shell and steps. Target fewer than 300 lines in the orchestrator.

- [ ] **Step 7: Run editor regression tests**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/content-editor.test.tsx src/components/admin/content/editor`

Expected: PASS, including dirty-navigation, save, publish, schedule, and archive coverage.

- [ ] **Step 8: Commit the editor split**

```bash
git add frontend/src/components/admin/content-editor.tsx frontend/src/components/admin/content-editor.test.tsx frontend/src/components/admin/content/editor
git commit -m "Guide operators through Chinese-first content editing"
```

### Task 7: Add a Visual Media Step

**Files:**
- Create: `frontend/src/components/admin/content/editor/media-step.tsx`
- Create: `frontend/src/components/admin/media/focal-point-picker.tsx`
- Create: `frontend/src/components/admin/media/focal-point-picker.test.tsx`
- Modify: `frontend/src/components/admin/media-library.tsx`
- Modify: `frontend/src/components/admin/content-editor.tsx`

- [ ] **Step 1: Test focal-point keyboard and pointer behavior**

```tsx
render(<FocalPointPicker src="/media/test.webp" value={{ x: 0.5, y: 0.5 }} onChange={onChange} />);
fireEvent.keyDown(screen.getByRole("slider", { name: "图片焦点" }), { key: "ArrowRight" });
expect(onChange).toHaveBeenCalledWith({ x: 0.51, y: 0.5 });
```

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/media/focal-point-picker.test.tsx`

Expected: FAIL because the picker does not exist.

- [ ] **Step 3: Implement the visual picker**

Render the selected image with a movable marker. Convert click coordinates to clamped values between 0 and 1. Expose a keyboard-operable slider role and Chinese help text.

- [ ] **Step 4: Build the editor media step**

Allow “从媒体库选择” and “上传新图片”. Display selected image, usage name, alt-text completion, and focal picker. Keep numeric coordinates in the API payload only.

- [ ] **Step 5: Run media/editor tests**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/media-library.test.tsx src/components/admin/media src/components/admin/content-editor.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the media step**

```bash
git add frontend/src/components/admin/media frontend/src/components/admin/content/editor/media-step.tsx frontend/src/components/admin/media-library.tsx frontend/src/components/admin/content-editor.tsx
git commit -m "Let operators choose media focus visually"
```

### Task 8: Finish Chinese Copy, Responsive Layout, and Phase Verification

**Files:**
- Modify: `frontend/src/app/admin/(protected)/**/*.tsx`
- Modify: `frontend/src/components/admin/**/*.tsx`
- Modify: `frontend/tests/e2e/admin-console.spec.ts`

- [ ] **Step 1: Add a user-visible English scan to E2E**

```ts
const forbidden = ["Published", "Draft", "Save metadata", "Focal X", "Focal Y", "Permission-aware workspace"];
for (const text of forbidden) await expect(page.getByText(text, { exact: false })).toHaveCount(0);
```

- [ ] **Step 2: Add viewport scenarios**

Cover 390, 768, 1024, 1280, 1440, and 1920 widths. Assert no horizontal overflow, visible primary action, and reachable navigation.

- [ ] **Step 3: Replace remaining English UI and normalize page headers**

Use `AdminPage` and Chinese copy in dashboard, content error/loading, media, staff, settings, and login screens touched in this phase.

- [ ] **Step 4: Run the phase verification**

Run: `pnpm --filter @anshow/frontend test && pnpm --filter @anshow/backend test && pnpm lint && pnpm typecheck && pnpm build`

Expected: all commands PASS.

- [ ] **Step 5: Run Admin E2E**

Run: `E2E_ADMIN_EMAIL=admin@example.test E2E_ADMIN_PASSWORD=Admin123! pnpm --filter @anshow/frontend test:e2e -- admin-console.spec.ts`

Expected: PASS at all target viewports.

- [ ] **Step 6: Commit phase completion**

```bash
git add frontend/src/app/admin frontend/src/components/admin frontend/tests/e2e/admin-console.spec.ts
git commit -m "Complete the Chinese Admin content operations foundation"
```
