# Admin Operations Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Admin as an operational system with a real workbench, inquiry management, redesigned media library, Chinese staff/roles, human-readable audit logs, and deployment-safe system settings.

**Architecture:** Add focused repositories and OpenAPI routes for dashboard aggregates, inquiry operations, and audit queries while reusing existing inquiry, media, RBAC, and settings tables. Frontend pages consume generated API types and shared Admin primitives from the shell/content phase; technical metadata moves into secondary drawers.

**Tech Stack:** Hono OpenAPI, Drizzle ORM, SQLite, Next.js 16, React 19, Tailwind CSS 4, Lucide React, Vitest, Testing Library, Playwright.

---

## File Structure

- Create `backend/src/admin/repositories/dashboard-repository.ts`: aggregate real operational counts.
- Create `backend/src/admin/repositories/inquiry-admin-repository.ts`: list, assign, status, notes, export.
- Create `backend/src/admin/repositories/audit-query-repository.ts`: filtered audit reads.
- Create `backend/src/admin/routes/dashboard.ts`, `inquiries.ts`, and `audit.ts`.
- Extend `backend/src/admin/routes/staff.ts` and `settings.ts` with complete contracts.
- Create `frontend/src/api/admin-dashboard.server.ts`, `admin-inquiries.ts`, and `admin-audit.server.ts`.
- Create `frontend/src/components/admin/dashboard/admin-dashboard.tsx`.
- Create `frontend/src/components/admin/inquiries/inquiry-list.tsx` and `inquiry-detail.tsx`.
- Create `frontend/src/components/admin/audit/audit-list.tsx`.
- Split `frontend/src/components/admin/media-library.tsx` into list, detail drawer, upload, and focal picker.
- Rebuild `frontend/src/components/admin/staff-form.tsx`, `role-matrix.tsx`, and `backup-settings-form.tsx`.
- Create routes `frontend/src/app/admin/(protected)/inquiries`, `audit`, and updated dashboard/settings/staff/media pages.

### Task 1: Build Real Dashboard Aggregates

**Files:**
- Create: `backend/src/admin/repositories/dashboard-repository.ts`
- Create: `backend/src/admin/repositories/dashboard-repository.test.ts`
- Create: `backend/src/admin/routes/dashboard.ts`
- Create: `backend/src/admin/routes/dashboard.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Write aggregate tests using seeded data**

```ts
expect(repository.summary(actorId)).toMatchObject({
  newInquiries: 2,
  highPriorityInquiries: 1,
  reviewPending: 3,
  translationPending: 1,
  publishedThisWeek: 4,
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --filter @anshow/backend exec vitest run src/admin/repositories/dashboard-repository.test.ts`

Expected: FAIL because the repository does not exist.

- [ ] **Step 3: Implement aggregates from real tables**

Use SQL counts over inquiries, content workflow, translation jobs, and publication timestamps. Return the current actor's assigned tasks and the 10 latest audit events. Do not synthesize marketing metrics.

- [ ] **Step 4: Expose GET `/api/admin/dashboard`**

Require any Admin session, then filter task details by granted permissions. Return system health as simplified `normal`, `warning`, or `unavailable` states.

- [ ] **Step 5: Run tests and regenerate OpenAPI**

Run: `pnpm --filter @anshow/backend exec vitest run src/admin/repositories/dashboard-repository.test.ts src/admin/routes/dashboard.test.ts && pnpm openapi:generate`

Expected: PASS.

- [ ] **Step 6: Commit dashboard data**

```bash
git add backend/src/admin/repositories/dashboard* backend/src/admin/routes/dashboard* backend/src/app.ts openapi/anshow.json frontend/src/generated/api.ts
git commit -m "Drive the Admin workbench from operational data"
```

### Task 2: Implement Inquiry Administration APIs

**Files:**
- Create: `backend/src/admin/repositories/inquiry-admin-repository.ts`
- Create: `backend/src/admin/repositories/inquiry-admin-repository.test.ts`
- Create: `backend/src/admin/routes/inquiries.ts`
- Create: `backend/src/admin/routes/inquiries.test.ts`
- Modify: `backend/src/db/schema/inquiries.ts`
- Modify: `backend/src/inquiries/state-machine.ts`
- Modify: `backend/src/inquiries/state-machine.test.ts`
- Create: `backend/migrations/0007_inquiry_operations.sql`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Add failing state, assignment, note, and export tests**

```ts
expect(repository.assign(inquiryId, assigneeId, actorId).assigneeId).toBe(assigneeId);
expect(repository.transition(inquiryId, "in_progress", actorId).status).toBe("in_progress");
expect(repository.addNote(inquiryId, actorId, "已电话联系客户").body).toBe("已电话联系客户");
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --filter @anshow/backend exec vitest run src/admin/repositories/inquiry-admin-repository.test.ts`

Expected: FAIL.

- [ ] **Step 3: Extend inquiry fields**

Add `priority` (`low|normal|high|urgent`), `updatedAt`, and `closedAt`. Add foreign keys for assignee and note author where migration safety permits, plus indexes for priority/status/updated time.

- [ ] **Step 4: Expand and test the business state machine**

Replace the existing `new|contacted|qualified|closed|spam` states with `new|pending_follow_up|in_progress|waiting_customer|completed|closed|spam`. Add explicit tests for every allowed and rejected transition, including reopening a completed or closed inquiry.

- [ ] **Step 5: Implement repository operations**

Reuse `backend/src/inquiries/state-machine.ts` for allowed transitions. Every assignment, status change, note, and export records inquiry history and audit entries in one transaction.

- [ ] **Step 6: Add OpenAPI routes**

Expose list/filter/detail, assignment, status, note, notification retry, and CSV export. Map each endpoint to existing `inquiry.*` permissions.

- [ ] **Step 7: Verify authorization and CSV escaping**

Run: `pnpm --filter @anshow/backend exec vitest run src/admin/routes/inquiries.test.ts src/inquiries`

Expected: PASS, including formula-injection-safe CSV values.

- [ ] **Step 8: Generate migration and clients**

Run: `pnpm --filter @anshow/backend db:generate && pnpm db:check && pnpm openapi:generate`

Expected: PASS.

- [ ] **Step 9: Commit inquiry operations**

```bash
git add backend/src/admin/repositories/inquiry* backend/src/admin/routes/inquiries* backend/src/db/schema/inquiries.ts backend/src/inquiries/state-machine* backend/migrations backend/src/app.ts openapi/anshow.json frontend/src/generated/api.ts
git commit -m "Turn inquiries into an auditable follow-up workflow"
```

### Task 3: Add Filterable Human-Readable Audit APIs

**Files:**
- Create: `backend/src/admin/repositories/audit-query-repository.ts`
- Create: `backend/src/admin/repositories/audit-query-repository.test.ts`
- Create: `backend/src/admin/routes/audit.ts`
- Create: `backend/src/admin/routes/audit.test.ts`
- Modify: `backend/src/admin/repositories/audit-repository.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Write audit query and redaction tests**

```ts
expect(repository.list({ actorId, action: "content.publish" }).items).toHaveLength(1);
expect(JSON.stringify(repository.detail(logId))).not.toMatch(/password|secret|token/i);
```

- [ ] **Step 2: Verify tests fail**

Run: `pnpm --filter @anshow/backend exec vitest run src/admin/repositories/audit-query-repository.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement safe detail normalization**

Allowlist detail keys per entity/action and replace sensitive-looking keys with `[已隐藏]`. Add pagination and actor/action/entity/result/time filters.

- [ ] **Step 4: Add GET list/detail routes**

Require `audit.read`. Return actor display name/email, Chinese-mappable action code, entity label inputs, result, request ID, and timestamp.

- [ ] **Step 5: Run route tests and regenerate OpenAPI**

Run: `pnpm --filter @anshow/backend exec vitest run src/admin/repositories/audit-query-repository.test.ts src/admin/routes/audit.test.ts && pnpm openapi:generate`

Expected: PASS.

- [ ] **Step 6: Commit audit reads**

```bash
git add backend/src/admin/repositories/audit* backend/src/admin/routes/audit* backend/src/app.ts openapi/anshow.json frontend/src/generated/api.ts
git commit -m "Expose safe human-readable audit history"
```

### Task 4: Build the Workbench and Inquiry UI

**Files:**
- Create: `frontend/src/api/admin-dashboard.server.ts`
- Create: `frontend/src/api/admin-inquiries.ts`
- Create: `frontend/src/components/admin/dashboard/admin-dashboard.tsx`
- Create: `frontend/src/components/admin/dashboard/admin-dashboard.test.tsx`
- Create: `frontend/src/components/admin/inquiries/inquiry-list.tsx`
- Create: `frontend/src/components/admin/inquiries/inquiry-detail.tsx`
- Create: `frontend/src/components/admin/inquiries/inquiries.test.tsx`
- Modify: `frontend/src/app/admin/(protected)/page.tsx`
- Create: `frontend/src/app/admin/(protected)/inquiries/page.tsx`

- [ ] **Step 1: Write dashboard and inquiry tests**

```tsx
expect(screen.getByText("今日工作")).toBeVisible();
expect(screen.getByText("高优先级")).toBeVisible();
expect(screen.getByRole("button", { name: "分配负责人" })).toBeEnabled();
expect(screen.getByRole("button", { name: "添加跟进记录" })).toBeEnabled();
```

- [ ] **Step 2: Verify tests fail**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/dashboard src/components/admin/inquiries`

Expected: FAIL.

- [ ] **Step 3: Implement the workbench**

Render metric blocks, prioritized task table, recent activity, and system health using real API data. Each metric links to a pre-filtered operational route.

- [ ] **Step 4: Implement inquiry list and detail drawer**

Use desktop table/mobile list. The drawer shows contact data, route, message, privacy consent, timeline, notification status, owner, priority, state, and notes.

- [ ] **Step 5: Add optimistic mutation feedback**

Disable only the active action, reconcile server responses, display Chinese errors with request IDs, and preserve drawer state on failed mutations.

- [ ] **Step 6: Run component tests and typecheck**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/dashboard src/components/admin/inquiries && pnpm --filter @anshow/frontend typecheck`

Expected: PASS.

- [ ] **Step 7: Commit workbench and inquiries**

```bash
git add frontend/src/api/admin-dashboard.server.ts frontend/src/api/admin-inquiries.ts frontend/src/components/admin/dashboard frontend/src/components/admin/inquiries frontend/src/app/admin/'(protected)'/page.tsx frontend/src/app/admin/'(protected)'/inquiries
git commit -m "Make daily Admin work and inquiry follow-up actionable"
```

### Task 5: Redesign the Media Library Around a Detail Drawer

**Files:**
- Create: `frontend/src/components/admin/media/media-grid.tsx`
- Create: `frontend/src/components/admin/media/media-detail-drawer.tsx`
- Create: `frontend/src/components/admin/media/media-upload.tsx`
- Modify: `frontend/src/components/admin/media-library.tsx`
- Modify: `frontend/src/components/admin/media-library.test.tsx`
- Modify: `frontend/src/app/admin/(protected)/media/page.tsx`

- [ ] **Step 1: Update tests for Chinese operator behavior**

```tsx
expect(screen.getByRole("button", { name: "上传图片" })).toBeVisible();
expect(screen.queryByText("Focal X")).not.toBeInTheDocument();
expect(screen.queryByText("Save metadata")).not.toBeInTheDocument();
expect(screen.getByRole("button", { name: "选择图片焦点" })).toBeVisible();
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/media-library.test.tsx`

Expected: FAIL on current English labels and inline editor layout.

- [ ] **Step 3: Split upload, grid, and detail responsibilities**

The grid displays preview, business name, usage count, and alt-text progress. Selecting an asset opens the drawer. Upload uses a separate top-level action and modal/section.

- [ ] **Step 4: Move technical metadata behind a disclosure**

Place ID, MIME type, dimensions, derivative byte sizes, storage key, and numeric focal coordinates under “技术信息”. Default view shows business labels only.

- [ ] **Step 5: Replace all remaining English media feedback**

Translate validation, processing, replacement, reference, delete, and cleanup states. Keep structured API errors and request IDs.

- [ ] **Step 6: Run media tests**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/media-library.test.tsx src/components/admin/media`

Expected: PASS.

- [ ] **Step 7: Commit media redesign**

```bash
git add frontend/src/components/admin/media frontend/src/components/admin/media-library.tsx frontend/src/components/admin/media-library.test.tsx frontend/src/app/admin/'(protected)'/media/page.tsx
git commit -m "Turn media metadata into a visual operator workflow"
```

### Task 6: Complete Staff and Role Administration

**Files:**
- Modify: `backend/src/admin/repositories/staff-repository.ts`
- Modify: `backend/src/admin/repositories/staff-repository.test.ts`
- Modify: `backend/src/admin/routes/staff.ts`
- Create: `backend/src/admin/routes/staff.test.ts`
- Modify: `frontend/src/api/admin-staff.ts`
- Modify: `frontend/src/api/admin-staff.server.ts`
- Modify: `frontend/src/components/admin/staff-form.tsx`
- Modify: `frontend/src/components/admin/role-matrix.tsx`
- Create: `frontend/src/components/admin/staff-admin.test.tsx`
- Modify: `frontend/src/app/admin/(protected)/staff/page.tsx`

- [ ] **Step 1: Write last-super-admin and session-revocation tests**

```ts
expect(() => repository.disable(lastSuperAdminId, actorId)).toThrowError(/最后一位超级管理员/);
expect(repository.setRoles(userId, [editorRoleId], actorId)).toMatchObject({ roles: ["Content Editor"] });
expect(activeSessionsFor(userId)).toHaveLength(0);
```

- [ ] **Step 2: Run backend tests and verify missing behavior fails**

Run: `pnpm --filter @anshow/backend exec vitest run src/admin/repositories/staff-repository.test.ts src/admin/routes/staff.test.ts`

Expected: FAIL for incomplete route/service behavior.

- [ ] **Step 3: Complete create, enable, disable, reset-password, and role routes**

Require `staff.manage`, revoke sessions after security changes, record audit events, and preserve final-super-admin protection.

- [ ] **Step 4: Rebuild the staff UI**

Use Chinese role names/descriptions, account state, last login, and a detail drawer. Put disable, password reset, and role changes behind explicit confirmations.

- [ ] **Step 5: Test permissions and UI**

Run: `pnpm --filter @anshow/backend exec vitest run src/admin/routes/staff.test.ts && pnpm --filter @anshow/frontend exec vitest run src/components/admin/staff-admin.test.tsx`

Expected: PASS.

- [ ] **Step 6: Regenerate OpenAPI and commit**

Run: `pnpm openapi:generate && pnpm openapi:check`

```bash
git add backend/src/admin/repositories/staff* backend/src/admin/routes/staff* frontend/src/api/admin-staff* frontend/src/components/admin/staff* frontend/src/components/admin/role-matrix.tsx frontend/src/app/admin/'(protected)'/staff/page.tsx openapi/anshow.json frontend/src/generated/api.ts
git commit -m "Make staff access safe and understandable"
```

### Task 7: Rebuild Settings and Add Audit UI

**Files:**
- Create: `frontend/src/api/admin-audit.server.ts`
- Create: `frontend/src/components/admin/audit/audit-list.tsx`
- Create: `frontend/src/components/admin/audit/audit-list.test.tsx`
- Create: `frontend/src/app/admin/(protected)/audit/page.tsx`
- Modify: `frontend/src/components/admin/backup-settings-form.tsx`
- Create: `frontend/src/components/admin/settings/settings-sections.tsx`
- Create: `frontend/src/components/admin/settings/settings-sections.test.tsx`
- Modify: `frontend/src/app/admin/(protected)/settings/page.tsx`
- Modify: `backend/src/admin/repositories/settings-repository.ts`
- Modify: `backend/src/admin/routes/settings.ts`
- Modify: `backend/src/admin/routes/settings.test.ts`
- Regenerate: `openapi/anshow.json`
- Regenerate: `frontend/src/generated/api.ts`

- [ ] **Step 1: Add failing Chinese settings/audit tests**

```tsx
expect(screen.getByText("系统设置")).toBeVisible();
expect(screen.getByText("自动备份")).toBeVisible();
expect(screen.getByText("审计日志")).toBeVisible();
expect(screen.queryByText("Backup policy saved")).not.toBeInTheDocument();
```

- [ ] **Step 2: Verify tests fail**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/settings src/components/admin/audit`

Expected: FAIL.

- [ ] **Step 3: Align the strict settings API with every supported section**

Extend `siteSettingsSchema` with backup policy, translation configured state, storage health, and notification health. Keep secret values write-only or environment-only. Regenerate OpenAPI so frontend settings and staff clients stop using handwritten types.

- [ ] **Step 4: Split settings into business sections**

Render company/public contacts, inquiry email, media/COS status, backup/restore verification, translation service status, and site feature flags. Conditional COS fields appear only when COS is selected.

- [ ] **Step 5: Preserve secret boundaries**

Display only “已配置/未配置” for encryption, SMTP, COS, and translation keys. Never bind secret values to inputs or responses.

- [ ] **Step 6: Implement audit list/detail**

Map action codes to Chinese sentences, provide actor/module/action/result/time filters, and show request ID and allowlisted detail in a drawer.

- [ ] **Step 7: Run tests, regenerate contracts, and typecheck**

Run: `pnpm --filter @anshow/backend exec vitest run src/admin/routes/settings.test.ts && pnpm openapi:generate && pnpm openapi:check && pnpm --filter @anshow/frontend exec vitest run src/components/admin/settings src/components/admin/audit && pnpm --filter @anshow/frontend typecheck`

Expected: PASS.

- [ ] **Step 8: Commit settings and audit UI**

```bash
git add backend/src/admin/repositories/settings-repository.ts backend/src/admin/routes/settings* openapi/anshow.json frontend/src/generated/api.ts frontend/src/api/admin-audit.server.ts frontend/src/components/admin/audit frontend/src/components/admin/settings frontend/src/components/admin/backup-settings-form.tsx frontend/src/app/admin/'(protected)'/audit frontend/src/app/admin/'(protected)'/settings/page.tsx
git commit -m "Expose system controls and audit history in Chinese"
```

### Task 8: Run Complete Admin QA and Release Verification

**Files:**
- Create: `frontend/tests/e2e/admin-operations.spec.ts`
- Modify: `frontend/tests/e2e/admin-console.spec.ts`
- Modify: `docs/deployment-tencent-cvm.md`

- [ ] **Step 1: Add end-to-end operations coverage**

Test dashboard task links, inquiry assignment/note/state/export, media upload/focus/replace/reference protection, staff role/session behavior, settings save, audit filtering, and permission-hidden navigation.

- [ ] **Step 2: Add all-page Chinese and overflow scans**

Visit every accessible Admin route at 390, 768, 1024, 1280, 1440, and 1920 widths. Assert no horizontal overflow, no clipped sidebar text, and no forbidden English operator copy.

- [ ] **Step 3: Add accessibility checks**

Run axe on dashboard, content list/editor, review, preview launcher, inquiries, media, staff, audit, and settings. Verify keyboard access to drawers, dialogs, menus, tables, and focal picker.

- [ ] **Step 4: Document production configuration**

Add translation environment variables, preview-link behavior, migration order, worker requirements, and a smoke-test checklist to `docs/deployment-tencent-cvm.md`. Do not include actual secrets.

- [ ] **Step 5: Run the complete verification suite**

Run: `pnpm verify && pnpm test:e2e`

Expected: all unit, integration, lint, typecheck, build, schema, OpenAPI, public E2E, and Admin E2E checks PASS.

- [ ] **Step 6: Inspect final screenshots**

Capture dashboard, content list, editor, review, preview site, inquiries, media, staff, audit, and settings at 1440 and 390 widths. Confirm alignment, Chinese copy, stable controls, and no overlapping text.

- [ ] **Step 7: Commit release readiness**

```bash
git add frontend/tests/e2e docs/deployment-tencent-cvm.md
git commit -m "Verify the complete Admin operations system"
```
