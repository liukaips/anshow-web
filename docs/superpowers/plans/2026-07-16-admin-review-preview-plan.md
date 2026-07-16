# Admin Translation, Review, and Full-Site Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Chinese-first automatic translation, role-based review, immutable full-site preview snapshots, same-domain external preview links, and snapshot-consistent publishing.

**Architecture:** Extend the content schema with explicit workflow/version records instead of overloading locale publication status. A server-side translation adapter creates editable English and Russian drafts. Preview snapshots serialize the exact public content graph and are rendered by the existing public components through a snapshot-backed content source.

**Tech Stack:** Hono OpenAPI, Drizzle ORM, SQLite, native `fetch`, Next.js 16 App Router, React 19, Vitest, Testing Library, Playwright.

---

## File Structure

- Create `backend/src/db/schema/workflow.ts`: reviews, translation jobs, preview snapshots, preview tokens.
- Create `backend/src/workflow/content-workflow.ts`: state transitions and version checks.
- Create `backend/src/translation/translation-provider.ts`: OpenAI-compatible server adapter.
- Create `backend/src/translation/translation-service.ts`: jobs, retries, and persistence.
- Create `backend/src/admin/repositories/review-repository.ts`: review queue and decisions.
- Create `backend/src/admin/repositories/preview-repository.ts`: immutable snapshots and hashed tokens.
- Create `backend/src/admin/routes/reviews.ts`: review APIs.
- Create `backend/src/admin/routes/previews.ts`: snapshot and link APIs.
- Create `backend/src/public/preview-routes.ts`: read-only token-backed preview content.
- Create `frontend/src/api/admin-reviews.ts`, `admin-previews.ts`, and `admin-translation.ts`.
- Create `frontend/src/app/admin/(protected)/reviews/page.tsx`: review center.
- Create `frontend/src/app/admin/(protected)/publish/page.tsx`: change set and preview generation.
- Create `frontend/src/app/preview/[token]/[locale]/[[...rest]]/page.tsx`: complete public preview routing.
- Create `frontend/src/components/admin/review/review-center.tsx`: three-language comparison and decisions.
- Create `frontend/src/components/admin/publish/publish-center.tsx`: snapshot generation and exact-version publish.
- Create `frontend/src/components/preview/preview-banner.tsx`: narrow preview environment banner.
- Modify `backend/src/content/drizzle-content-store.ts`: published or snapshot content source.
- Modify `frontend/src/components/public/public-route.server.tsx`: accept preview content source without duplicating public UI.

### Task 1: Add Workflow, Translation, and Preview Tables

**Files:**
- Create: `backend/src/db/schema/workflow.ts`
- Modify: `backend/src/db/schema/index.ts`
- Create: `backend/src/db/schema/workflow.test.ts`
- Create: `backend/migrations/0006_admin_workflow.sql`
- Update: `backend/migrations/meta/_journal.json`

- [ ] **Step 1: Write schema contract tests**

```ts
expect(tableNames).toEqual(expect.arrayContaining([
  "content_workflow",
  "content_reviews",
  "translation_jobs",
  "preview_snapshots",
  "preview_tokens",
]));
```

- [ ] **Step 2: Run the schema test and verify failure**

Run: `pnpm --filter @anshow/backend exec vitest run src/db/schema/workflow.test.ts`

Expected: FAIL because the tables do not exist.

- [ ] **Step 3: Define workflow enums and tables**

```ts
export const workflowStates = [
  "draft",
  "translation_pending",
  "review_pending",
  "changes_requested",
  "approved",
  "scheduled",
  "published",
  "archived",
] as const;

export const contentWorkflow = sqliteTable("content_workflow", {
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  state: text("state", { enum: workflowStates }).notNull().default("draft"),
  ownerId: text("owner_id"),
  version: integer("version").notNull().default(1),
  submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [primaryKey({ columns: [table.entityType, table.entityId] })]);
```

- [ ] **Step 4: Add reviews, jobs, snapshots, and token hashes**

Store snapshot payload as validated JSON text, its SHA-256 content hash, source versions, creator, creation time, expiry, revoked time, and publish time. Store only `sha256(rawToken)` in `preview_tokens`.

- [ ] **Step 5: Generate and verify the migration**

Run: `pnpm --filter @anshow/backend db:generate && pnpm db:check`

Expected: the new migration includes checks, indexes, foreign-key-safe cleanup, and no destructive statements.

- [ ] **Step 6: Commit the schema**

```bash
git add backend/src/db/schema backend/migrations
git commit -m "Persist content review and immutable preview state"
```

### Task 2: Implement Versioned Workflow Transitions and Permissions

**Files:**
- Create: `backend/src/workflow/content-workflow.ts`
- Create: `backend/src/workflow/content-workflow.test.ts`
- Modify: `backend/src/auth/permissions.ts`
- Modify: `backend/src/auth/seed-rbac.ts`
- Modify: `backend/src/admin/repositories/content-repository.ts`

- [ ] **Step 1: Write transition tests**

```ts
expect(canTransition("draft", "review_pending", "content.submit")).toBe(true);
expect(canTransition("review_pending", "approved", "content.review")).toBe(true);
expect(canTransition("draft", "published", "content.write")).toBe(false);
expect(() => assertVersion(4, 3)).toThrowError(/内容已被其他人更新/);
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --filter @anshow/backend exec vitest run src/workflow/content-workflow.test.ts`

Expected: FAIL because workflow functions do not exist.

- [ ] **Step 3: Add explicit permissions**

Add `content.submit`, `content.review`, `preview.create`, `preview.share`, and `preview.revoke`. Seed Content Editor, Content Reviewer, System Administrator, and Super Administrator role presets with the approved matrix.

- [ ] **Step 4: Implement transitions and optimistic version checks**

Every draft save increments `content_workflow.version`. Submit, approve, reject, schedule, and publish require `expectedVersion`; return HTTP 409 with code `CONTENT_VERSION_CONFLICT` on mismatch.

- [ ] **Step 5: Integrate workflow state into content repository responses**

Return `workflow: { state, ownerId, version, submittedAt }` for list and detail calls while preserving locale publication state.

- [ ] **Step 6: Run workflow, permission, and repository tests**

Run: `pnpm --filter @anshow/backend exec vitest run src/workflow src/auth/seed-rbac.test.ts src/admin/repositories/content-repository.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit workflow behavior**

```bash
git add backend/src/workflow backend/src/auth backend/src/admin/repositories/content-repository.ts
git commit -m "Enforce versioned content review transitions"
```

### Task 3: Implement the Translation Provider and Translation Jobs

**Files:**
- Create: `backend/src/translation/translation-provider.ts`
- Create: `backend/src/translation/translation-service.ts`
- Create: `backend/src/translation/translation-service.test.ts`
- Create: `backend/src/admin/routes/translation.ts`
- Create: `backend/src/admin/routes/translation.test.ts`
- Modify: `backend/src/env.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write provider and service tests with a fake fetch**

```ts
const translated = await service.generate({
  entityType: "services",
  entityId: "cold-chain",
  sourceVersion: 3,
  source: { title: "冷链运输服务", summary: "...", body: "...", altText: "..." },
  targets: ["en", "ru"],
});
expect(translated.en.title).toBe("Cold-chain logistics service");
expect(translated.ru.title).toBe("Холодовая логистика");
```

- [ ] **Step 2: Verify tests fail**

Run: `pnpm --filter @anshow/backend exec vitest run src/translation/translation-service.test.ts`

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Add environment validation**

Add optional `TRANSLATION_API_URL`, `TRANSLATION_API_KEY`, and `TRANSLATION_MODEL`. Require all three together. Never include the key in settings responses or logs.

- [ ] **Step 4: Implement the OpenAI-compatible adapter**

Send a JSON-schema-constrained request for `title`, `summary`, `body`, `seoTitle`, `seoDescription`, `altText`, and ASCII `slug`. Validate the response with Zod before saving.

- [ ] **Step 5: Implement idempotent jobs**

Use `(entityType, entityId, sourceVersion, targetLocale)` as the idempotency key. Mark jobs `queued`, `running`, `succeeded`, or `failed`; preserve the Chinese draft on every failure.

- [ ] **Step 6: Add route contracts**

Expose POST `/api/admin/content/{collection}/{id}/translations/generate` and GET `/api/admin/content/{collection}/{id}/translations/jobs`. Require `content.write` and return Chinese-safe error codes.

- [ ] **Step 7: Run route tests and regenerate OpenAPI**

Run: `pnpm --filter @anshow/backend exec vitest run src/translation src/admin/routes/translation.test.ts && pnpm openapi:generate && pnpm openapi:check`

Expected: PASS.

- [ ] **Step 8: Commit translation support**

```bash
git add backend/src/translation backend/src/admin/routes/translation* backend/src/env.ts .env.example openapi/anshow.json frontend/src/generated/api.ts
git commit -m "Generate editable English and Russian content drafts"
```

### Task 4: Build the Review Repository and Routes

**Files:**
- Create: `backend/src/admin/repositories/review-repository.ts`
- Create: `backend/src/admin/repositories/review-repository.test.ts`
- Create: `backend/src/admin/routes/reviews.ts`
- Create: `backend/src/admin/routes/reviews.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Write queue and decision tests**

```ts
expect(repository.list({ state: "review_pending" })).toHaveLength(1);
expect(() => repository.reject({ reviewId, reason: "" })).toThrow(/退回原因/);
expect(repository.approve({ reviewId, reviewerId, expectedVersion: 3 }).state).toBe("approved");
```

- [ ] **Step 2: Verify tests fail**

Run: `pnpm --filter @anshow/backend exec vitest run src/admin/repositories/review-repository.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement queue, submit, approve, and reject transactions**

Each decision validates permission, version, translation completeness, and current state. Rejection requires a Chinese reason. Every transition records an audit event with entity and version.

- [ ] **Step 4: Expose OpenAPI routes**

Add list/filter/detail, submit, approve, reject, and schedule endpoints under `/api/admin/reviews`. Return 403 for missing `content.review` and 409 for stale versions.

- [ ] **Step 5: Run route tests and regenerate clients**

Run: `pnpm --filter @anshow/backend exec vitest run src/admin/repositories/review-repository.test.ts src/admin/routes/reviews.test.ts && pnpm openapi:generate`

Expected: PASS.

- [ ] **Step 6: Commit the review API**

```bash
git add backend/src/admin/repositories/review* backend/src/admin/routes/reviews* backend/src/app.ts openapi/anshow.json frontend/src/generated/api.ts
git commit -m "Provide an auditable content review queue"
```

### Task 5: Implement Immutable Full-Site Preview Snapshots

**Files:**
- Create: `backend/src/admin/repositories/preview-repository.ts`
- Create: `backend/src/admin/repositories/preview-repository.test.ts`
- Create: `backend/src/preview/preview-service.ts`
- Create: `backend/src/preview/preview-service.test.ts`
- Create: `backend/src/admin/routes/previews.ts`
- Create: `backend/src/public/preview-routes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Write snapshot invariance and token tests**

```ts
const preview = await service.createSnapshot({ createdBy, expiresInHours: 24 });
await mutateSourceContent();
expect(await service.readSnapshot(preview.rawToken)).toEqual(preview.originalPayload);
expect(databasePreviewToken).not.toContain(preview.rawToken);
expect(await service.readSnapshot(revokedToken)).toBeNull();
```

- [ ] **Step 2: Verify tests fail**

Run: `pnpm --filter @anshow/backend exec vitest run src/preview/preview-service.test.ts`

Expected: FAIL.

- [ ] **Step 3: Define and validate the snapshot payload**

The payload contains all public collections, localized translations, site settings, navigation, media references, source versions, and published fallback records. Validate with Zod before insert and after read.

- [ ] **Step 4: Implement secure tokens**

Generate 32 random bytes with `crypto.randomBytes`, encode base64url, store SHA-256 only, compare constant-time, and enforce expiry/revocation before returning payload.

- [ ] **Step 5: Add Admin snapshot/link routes**

Expose create, list, detail, revoke, and publish operations under `/api/admin/previews`. Require `preview.create`, `preview.share`, or `preview.revoke` as appropriate.

- [ ] **Step 6: Add read-only public preview data routes**

Expose GET `/api/public/preview/{token}/{locale}` plus list/detail path resolution. Set `Cache-Control: private, no-store` and `X-Robots-Tag: noindex, noarchive`.

- [ ] **Step 7: Test expiry, revocation, no-store, and audit events**

Run: `pnpm --filter @anshow/backend exec vitest run src/preview src/admin/routes/previews.test.ts src/public/preview-routes.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit preview services**

```bash
git add backend/src/preview backend/src/admin/repositories/preview* backend/src/admin/routes/previews* backend/src/public/preview-routes* backend/src/app.ts
git commit -m "Create revocable immutable website previews"
```

### Task 6: Render Preview Routes with the Existing Public Components

**Files:**
- Create: `frontend/src/api/preview-content.server.ts`
- Create: `frontend/src/app/preview/[token]/[locale]/[[...rest]]/page.tsx`
- Create: `frontend/src/components/preview/preview-banner.tsx`
- Create: `frontend/src/components/preview/preview-banner.test.tsx`
- Create: `frontend/src/components/public/public-route-context.tsx`
- Create: `frontend/src/components/public/public-route-context.test.tsx`
- Modify: `frontend/src/components/public/public-route.server.tsx`
- Modify: `frontend/src/components/public/public-content.server.ts`
- Modify: `frontend/src/components/public/public-pages.tsx`
- Modify: `frontend/src/components/site/site-header.tsx`
- Modify: `frontend/src/components/site/locale-switcher.tsx`
- Modify: `frontend/src/proxy.ts`

- [ ] **Step 1: Test the preview banner and route resolver**

```tsx
render(<PreviewBanner locale="zh" changedCount={4} adminHref="/admin/publish" />);
expect(screen.getByText("网站预览环境")).toBeVisible();
expect(screen.getByText("4 项未发布改动")).toBeVisible();
```

- [ ] **Step 2: Verify tests fail**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/preview/preview-banner.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Extract a public content source interface**

```ts
export interface PublicContentSource {
  home(locale: SupportedLocale): Promise<PublicHome>;
  list(collection: PublicCollection, locale: SupportedLocale): Promise<PublicItem[]>;
  detail(collection: PublicCollection, locale: SupportedLocale, slug: string): Promise<PublicItem | null>;
}
```

Published routes use the existing API source; preview routes use the token-backed preview source. Both render the same page components.

- [ ] **Step 4: Introduce preview-aware public URL construction**

```ts
export function publicHref(context: PublicRouteContextValue, locale: SupportedLocale, path = "") {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return context.previewToken
    ? `/preview/${encodeURIComponent(context.previewToken)}/${locale}${path ? suffix : ""}`
    : `/${locale}${path ? suffix : ""}`;
}
```

Replace hard-coded `/${locale}` links in public pages, site header, and locale switcher with the context helper. In preview mode, do not fetch the published sitemap for language alternates.

- [ ] **Step 5: Implement catch-all preview routing**

Resolve `rest` using the same collection/detail map as localized public routes. Preserve token and locale in every preview navigation link.

- [ ] **Step 6: Exclude preview paths from next-intl locale middleware and add metadata protections**

```ts
export const config = {
  matcher: ["/((?!api|admin|preview|_next|.*\\..*).*)"],
};
```

Return `robots: { index: false, follow: false, archive: false }` and no canonical URL for every preview page.

- [ ] **Step 7: Run route and component tests**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/preview src/components/public src/components/site`

Expected: PASS.

- [ ] **Step 8: Commit full-site preview rendering**

```bash
git add frontend/src/api/preview-content.server.ts frontend/src/app/preview frontend/src/components/preview frontend/src/components/public frontend/src/components/site frontend/src/proxy.ts
git commit -m "Render complete draft websites through public components"
```

### Task 7: Build Translation, Review, and Publish Center UI

**Files:**
- Create: `frontend/src/api/admin-translation.ts`
- Create: `frontend/src/api/admin-reviews.ts`
- Create: `frontend/src/api/admin-previews.ts`
- Create: `frontend/src/components/admin/review/review-center.tsx`
- Create: `frontend/src/components/admin/review/review-center.test.tsx`
- Create: `frontend/src/components/admin/publish/publish-center.tsx`
- Create: `frontend/src/components/admin/publish/publish-center.test.tsx`
- Create: `frontend/src/app/admin/(protected)/reviews/page.tsx`
- Create: `frontend/src/app/admin/(protected)/publish/page.tsx`
- Modify: `frontend/src/components/admin/content-editor.tsx`
- Modify: `frontend/src/components/admin/admin-sidebar.tsx`

- [ ] **Step 1: Add failing UI tests**

```tsx
expect(screen.getByRole("button", { name: "生成英文和俄文" })).toBeEnabled();
expect(screen.getByRole("button", { name: "退回修改" })).toBeEnabled();
expect(screen.getByRole("button", { name: "预览整个网站" })).toBeEnabled();
```

- [ ] **Step 2: Verify tests fail**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/review src/components/admin/publish`

Expected: FAIL.

- [ ] **Step 3: Add translation generation and confirmation to the editor**

Show per-language states, regenerate action, editable fields, and explicit confirmation. Poll job status only while queued/running and stop on success/failure/unmount.

- [ ] **Step 4: Implement the review center**

Render queue filters, Chinese/English/Russian comparison, version metadata, required rejection reason, approve, and schedule actions. Hide publish controls without `content.publish`.

- [ ] **Step 5: Implement the publish center**

Show the complete change set, incomplete blockers, snapshot generation, new-tab preview, external link expiry selector, revoke action, and exact snapshot publish.

- [ ] **Step 6: Run UI tests and typecheck**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/review src/components/admin/publish src/components/admin/content-editor.test.tsx && pnpm --filter @anshow/frontend typecheck`

Expected: PASS.

- [ ] **Step 7: Commit workflow UI**

```bash
git add frontend/src/api/admin-translation.ts frontend/src/api/admin-reviews.ts frontend/src/api/admin-previews.ts frontend/src/components/admin/review frontend/src/components/admin/publish frontend/src/app/admin/'(protected)'/reviews frontend/src/app/admin/'(protected)'/publish frontend/src/components/admin/content-editor.tsx frontend/src/components/admin/admin-sidebar.tsx
git commit -m "Guide translations through review and exact preview publishing"
```

### Task 8: Verify the Complete Review and Preview Journey

**Files:**
- Create: `frontend/tests/e2e/admin-review-preview.spec.ts`
- Modify: `frontend/playwright.config.ts`

- [ ] **Step 1: Write the end-to-end journey**

Test Chinese edit, translation generation, per-language confirmation, submit, reviewer approval, snapshot generation, preview navigation across home/list/detail/contact, external link access, revoke, and exact publish.

- [ ] **Step 2: Add security assertions**

Assert preview responses include `X-Robots-Tag: noindex, noarchive`, `Cache-Control: private, no-store`, expired/revoked tokens return 404/410, and preview pages expose no Admin controls.

- [ ] **Step 3: Run backend and frontend tests**

Run: `pnpm --filter @anshow/backend test && pnpm --filter @anshow/frontend test`

Expected: PASS.

- [ ] **Step 4: Run preview E2E at target widths**

Run: `pnpm --filter @anshow/frontend test:e2e -- admin-review-preview.spec.ts`

Expected: PASS at 390, 768, 1024, 1440, and 1920 widths without overflow.

- [ ] **Step 5: Run schema and OpenAPI checks**

Run: `pnpm db:check && pnpm openapi:check && pnpm typecheck && pnpm build`

Expected: PASS.

- [ ] **Step 6: Commit phase completion**

```bash
git add frontend/tests/e2e/admin-review-preview.spec.ts frontend/playwright.config.ts
git commit -m "Verify full-site previews and controlled publishing end to end"
```
