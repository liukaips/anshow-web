# Admin Operations and Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the existing Chinese Admin with the approved traditional B2B reference, make navigation and configuration understandable to nontechnical operators, and prove the entire PPT-driven product is deployable.

**Architecture:** Reuse the delivered Admin workflow, table, preview, review, media, settings, backup, and permission primitives. Replace the flat technical navigation with permission-aware business groups and submenus, derive frontend-position labels from collection data, and add collection-specific structured editors that continue to submit through the existing typed Admin API.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Lucide React, Hono, Drizzle ORM, Better Auth, SQLite, Vitest, Testing Library, Playwright, Docker Compose, Caddy.

---

## File Structure

- Create `frontend/src/components/admin/admin-menu-model.ts`: permission-aware menu groups and child routes.
- Create `frontend/src/components/admin/admin-menu-model.test.ts`: submenu, active route, and permission tests.
- Modify `frontend/src/components/admin/admin-sidebar.tsx`: collapsible current-group navigation.
- Modify `frontend/src/components/admin/admin-sidebar.test.tsx`: approved labels and mobile drawer behavior.
- Modify `frontend/src/components/admin/admin-topbar.tsx`: search wording, website shortcut, notifications, and account affordance.
- Modify `frontend/src/components/admin/dashboard/admin-dashboard.tsx`: reference-style metrics, recent content, actionable tasks, and backup status.
- Modify `frontend/src/components/admin/dashboard/admin-dashboard.test.tsx`: factual data and no fake sales charts.
- Modify `frontend/src/api/admin-dashboard.server.ts`: consume the expanded typed dashboard response.
- Modify `backend/src/admin/repositories/dashboard-repository.ts`: query monthly inquiries, recent content, and latest backup.
- Modify `backend/src/admin/repositories/dashboard-repository.test.ts`: dashboard query coverage.
- Modify `backend/src/admin/routes/dashboard.ts`: publish the expanded OpenAPI contract.
- Modify `backend/src/admin/routes/dashboard.test.ts`: permissions and serialization coverage.
- Modify `frontend/src/components/admin/content/content-labels.ts`: frontend-aligned collection and position labels.
- Modify `frontend/src/components/admin/content/content-list.tsx`: title, frontend position, locale completion, status, update, operations.
- Modify `frontend/src/components/admin/content/content-list.test.tsx`: hide internal identifiers and technical language.
- Create `frontend/src/components/admin/content/editor/business-content-fields.tsx`: collection-specific business forms.
- Create `frontend/src/components/admin/content/editor/business-content-fields.test.tsx`: case/service/lane/certificate field tests.
- Modify `frontend/src/components/admin/content/editor/chinese-content-step.tsx`: use the business form.
- Modify `frontend/src/components/admin/content/editor/content-validation.ts`: validate collection-specific fields.
- Modify `frontend/src/components/admin/content-editor.tsx`: serialize validated fields into version-one structured body.
- Modify `frontend/src/components/admin/content-editor.test.tsx`: preview and raw-JSON absence.
- Modify `frontend/src/app/admin/(protected)/settings/page.tsx`: frontend-mapped settings categories.
- Modify relevant settings form components and tests under `frontend/src/components/admin`.
- Modify `frontend/tests/e2e/admin-console.spec.ts`: approved shell, submenus, tables, forms, preview, and mobile.
- Modify `docker-compose.yml` and deployment docs only if verification finds a missing runtime mount or command.

### Task 1: Replace Flat Navigation with Business Submenus

**Files:**
- Create: `frontend/src/components/admin/admin-menu-model.ts`
- Create: `frontend/src/components/admin/admin-menu-model.test.ts`
- Modify: `frontend/src/components/admin/admin-sidebar.tsx`
- Modify: `frontend/src/components/admin/admin-sidebar.test.tsx`

- [ ] **Step 1: Write failing menu-model tests**

```ts
expect(menuFor(PERMISSIONS)).toMatchObject([
  { label: "日常工作", items: [
    { label: "工作台", href: "/admin" },
    { label: "询价管理", children: expect.arrayContaining([
      { label: "待联系", href: "/admin/inquiries?status=new" },
      { label: "跟进中", href: "/admin/inquiries?status=in_progress" },
    ]) },
  ] },
  { label: "官网内容", items: expect.arrayContaining([
    expect.objectContaining({ label: "内容管理" }),
    expect.objectContaining({ label: "审核与发布" }),
  ]) },
  { label: "系统管理", items: expect.any(Array) },
]);
expect(activeMenuPath("/admin/content/services")).toEqual(["官网内容", "内容管理", "物流服务"]);
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/admin-menu-model.test.ts src/components/admin/admin-sidebar.test.tsx`

Expected: FAIL because navigation is currently a flat four-section list.

- [ ] **Step 3: Define the exact menu model**

```ts
export type AdminMenuItem = {
  label: string;
  href?: string;
  icon: LucideIcon;
  permission: string;
  children?: readonly { label: string; href: string; permission: string }[];
};
```

Use the approved groups and labels: 日常工作, 官网内容, 系统管理. Children are 首页内容, 物流服务, 特殊货物, 重点航线, 项目案例, 行业洞察, 关于与联系, 待审核内容, 预约发布, 发布记录, 公司与联系方式, 语言与默认设置, 询价通知, 备份与恢复.

- [ ] **Step 4: Implement current-group expansion**

Only the active route group opens by default. Clicking a parent toggles it. Permission filtering occurs before rendering so empty parents disappear. Use Lucide chevrons and buttons with `aria-expanded`/`aria-controls`.

- [ ] **Step 5: Preserve desktop and mobile behavior**

Desktop sidebar remains 232–236px, scrolls vertically, and never scrolls horizontally. Mobile uses the existing focus-trapped drawer; selecting a child closes it.

- [ ] **Step 6: Run tests and commit**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/admin-menu-model.test.ts src/components/admin/admin-sidebar.test.tsx`

```bash
git add frontend/src/components/admin/admin-menu-model.ts frontend/src/components/admin/admin-menu-model.test.ts frontend/src/components/admin/admin-sidebar.tsx frontend/src/components/admin/admin-sidebar.test.tsx
git commit -m "Organize Admin navigation around operator tasks"
```

### Task 2: Make the Workbench Match Real Operator Priorities

**Files:**
- Modify: `frontend/src/components/admin/dashboard/admin-dashboard.tsx`
- Modify: `frontend/src/components/admin/dashboard/admin-dashboard.test.tsx`
- Modify: `frontend/src/api/admin-dashboard.server.ts`
- Modify: `backend/src/admin/repositories/dashboard-repository.ts`
- Modify: `backend/src/admin/repositories/dashboard-repository.test.ts`
- Modify: `backend/src/admin/routes/dashboard.ts`
- Modify: `backend/src/admin/routes/dashboard.test.ts`

- [ ] **Step 1: Add failing dashboard tests**

```tsx
expect(screen.getByText("待联系询价")).toBeVisible();
expect(screen.getByText("待审核内容")).toBeVisible();
expect(screen.getByText("本月新增询价")).toBeVisible();
expect(screen.getByText("上次自动备份")).toBeVisible();
expect(screen.getByRole("heading", { name: "最近编辑的官网内容" })).toBeVisible();
expect(screen.queryByText(/销售额|订单金额|平均订单/)).not.toBeInTheDocument();
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/dashboard/admin-dashboard.test.tsx`

Expected: FAIL because current metrics and recent-content table do not match the approved workbench.

- [ ] **Step 3: Extend the typed dashboard contract**

```ts
type AdminDashboardData = {
  pendingContactInquiries: number;
  reviewPending: number;
  inquiriesThisMonth: number;
  latestBackup: { completedAt: string; status: "healthy" | "warning" | "failed" } | null;
  recentContent: Array<{ id: string; collection: AdminContentCollection; title: string; localeCompletion: number; status: AdminDisplayStatus; updatedAt: string }>;
  tasks: DashboardTasks;
  systemHealth: SystemHealth;
};
```

Compute values from existing inquiries, workflow, content, and backup tables. Never use placeholder numbers.

- [ ] **Step 4: Implement the restrained dashboard layout**

Use four metric panels, one traditional recent-content table, a pending-task list, and compact common actions. Keep borders and 4–6px radii; remove decorative icon tiles where they do not communicate state.

- [ ] **Step 5: Run API, component, and type tests**

Run: `pnpm --filter @anshow/backend exec vitest run src/admin && pnpm --filter @anshow/frontend exec vitest run src/components/admin/dashboard && pnpm --filter @anshow/frontend typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/admin frontend/src/api/admin-dashboard.server.ts frontend/src/components/admin/dashboard
git commit -m "Put real operational work at the center of the Admin dashboard"
```

### Task 3: Make Content Tables Match the Public Website

**Files:**
- Modify: `frontend/src/components/admin/content/content-labels.ts`
- Modify: `frontend/src/components/admin/content/content-list.tsx`
- Modify: `frontend/src/components/admin/content/content-list.test.tsx`
- Modify: `frontend/src/app/admin/(protected)/content/[collection]/page.tsx`

- [ ] **Step 1: Add failing table tests**

```tsx
expect(screen.getByRole("columnheader", { name: "内容标题" })).toBeVisible();
expect(screen.getByRole("columnheader", { name: "前台位置" })).toBeVisible();
expect(screen.getByRole("columnheader", { name: "语言完成情况" })).toBeVisible();
expect(screen.getByText("首页 · 首屏轮播")).toBeVisible();
expect(screen.queryByText("hero-slides")).not.toBeInTheDocument();
expect(screen.queryByText("ocean-freight")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/content/content-list.test.tsx`

Expected: FAIL on old column labels and missing frontend-position mapping.

- [ ] **Step 3: Define business labels and positions**

```ts
export const collectionLabels = {
  pages: "关于与联系",
  "hero-slides": "首页首屏轮播",
  services: "物流服务",
  "trade-lanes": "重点航线",
  "cargo-types": "特殊货物",
  "case-studies": "项目案例",
  articles: "行业洞察",
  certificates: "资质证书",
  "proof-metrics": "首页实力数据",
  "navigation-items": "网站导航",
  partners: "合作网络",
} as const;
```

Build `frontendPosition(item)` from collection and known page code. Do not derive user-facing labels from internal collection strings.

- [ ] **Step 4: Render the approved columns and operations**

Columns: 内容标题, 前台位置, 语言完成情况, 发布状态, 最后修改, 操作. Show `中 ✓ / 英 ✓ / 俄 待补` with text, not color alone. Operations are 编辑, 继续填写, 预览 depending on permission and completeness.

- [ ] **Step 5: Keep internal values out of default UI**

Do not render code, slug, JSON, database IDs, storage keys, or raw permission strings in the list, empty state, tooltip, or accessible name.

- [ ] **Step 6: Run tests and commit**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/content/content-list.test.tsx src/components/admin/content-collection-list.test.tsx`

```bash
git add frontend/src/components/admin/content frontend/src/app/admin/'(protected)'/content/'[collection]'/page.tsx
git commit -m "Name every content setting after its public website position"
```

### Task 4: Replace the Raw Body Field with Business Forms

**Files:**
- Create: `frontend/src/components/admin/content/editor/business-content-fields.tsx`
- Create: `frontend/src/components/admin/content/editor/business-content-fields.test.tsx`
- Modify: `frontend/src/components/admin/content/editor/chinese-content-step.tsx`
- Modify: `frontend/src/components/admin/content/editor/content-validation.ts`
- Modify: `frontend/src/components/admin/content/editor/content-validation.test.ts`
- Modify: `frontend/src/components/admin/content-editor.tsx`
- Modify: `frontend/src/components/admin/content-editor.test.tsx`

- [ ] **Step 1: Add failing collection-specific form tests**

```tsx
render(<BusinessContentFields collection="case-studies" value={CASE_VALUE} onChange={onChange} />);
for (const label of ["货物类型", "起运地", "目的地", "项目难点", "解决方案", "项目结果"]) {
  expect(screen.getByLabelText(label)).toBeVisible();
}
expect(screen.queryByText(/JSON|body|slug|code/i)).not.toBeInTheDocument();

render(<BusinessContentFields collection="certificates" value={CERT_VALUE} onChange={onChange} />);
expect(screen.getByLabelText("证书编号（可选）")).toBeVisible();
expect(screen.getByLabelText("有效期（可选）")).toBeVisible();
expect(screen.getByLabelText("验证来源（可选）")).toBeVisible();
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/content/editor/business-content-fields.test.tsx`

Expected: FAIL because the business form does not exist.

- [ ] **Step 3: Define one discriminated editor value**

```ts
type BusinessBodyValue =
  | { kind: "service"; scope: string; cargo: string[]; process: ProcessStep[]; documents: string[] }
  | { kind: "case"; cargo: string; origin: string; destination: string; challenge: string; solution: string; results: FactValue[] }
  | { kind: "lane"; region: string; modes: string[]; cargo: string[]; coordination: string }
  | { kind: "certificate"; description: string; certificateNumber: string; validUntil: string; verificationSource: string }
  | { kind: "page"; introduction: string; facts: FactValue[]; callToAction: string }
  | { kind: "article"; introduction: string; sections: Array<{ heading: string; text: string }> };
```

- [ ] **Step 4: Parse existing content and serialize version one**

On load, parse structured bodies into fields. Legacy text populates the main description and remains intact until the operator saves. On save, serialize through one `toStructuredBody(value)` helper and submit the resulting JSON string to the existing API.

- [ ] **Step 5: Add plain-language validation**

Errors must say what is missing and how to fix it, for example “请填写项目目的地，前台案例需要显示运输路线。” Do not emit Zod paths or schema terminology.

- [ ] **Step 6: Keep advanced technical settings collapsed**

Generated website address, internal identifier, SEO defaults, and sort order remain in `advanced-settings.tsx`. Show clear Chinese explanations; never require them for normal save or publish.

- [ ] **Step 7: Run editor tests and commit**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/content/editor src/components/admin/content-editor.test.tsx`

```bash
git add frontend/src/components/admin/content
git commit -m "Let operators edit logistics content through business questions"
```

### Task 5: Align Settings, Media, and Preview with Frontend Outcomes

**Files:**
- Modify: `frontend/src/app/admin/(protected)/settings/page.tsx`
- Modify: relevant settings components and tests under `frontend/src/components/admin`
- Modify: `frontend/src/components/admin/media-library.tsx`
- Modify: `frontend/src/components/admin/media-library.test.tsx`
- Modify: `frontend/src/components/admin/publish/publish-center.tsx`
- Modify: `frontend/src/components/admin/publish/publish-center.test.tsx`

- [ ] **Step 1: Add failing operator-language tests**

Assert settings exposes 公司与联系方式, 语言与默认设置, 询价通知, 备份与恢复; media uses 图片名称, 前台使用位置, 图片说明, 视觉重点; publish uses 前台预览, 三语完成情况, 图片检查, 发布记录. Assert technical terms such as focalX, storageKey, webhook URL, and snapshot hash are absent from default views.

- [ ] **Step 2: Run and verify failure**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin/media-library.test.tsx src/components/admin/publish/publish-center.test.tsx src/components/admin/backup-settings-form.test.tsx`

Expected: FAIL on labels or grouping that still expose system implementation language.

- [ ] **Step 3: Group settings by public effect**

Company name, address, phone, mobile, email, working hours, and contact channels appear under 公司与联系方式 with a note showing where each value appears. Secrets remain deployment-managed and show only 已配置/未配置.

- [ ] **Step 4: Make media management outcome-based**

Show desktop and mobile previews, usage locations, alt-text completion, and focal-point picker. Technical dimensions and file sizes remain in a collapsed 技术信息 section. Upload success explains that the system created website-sized images.

- [ ] **Step 5: Keep preview as the release gate**

Publish Center must generate the existing immutable full-site preview. Surface clear checks for three languages, images, SEO title/description, and changed routes before enabling publish.

- [ ] **Step 6: Run tests and commit**

Run: `pnpm --filter @anshow/frontend exec vitest run src/components/admin`

```bash
git add frontend/src/app/admin/'(protected)'/settings frontend/src/components/admin
git commit -m "Explain system configuration in terms of the website it changes"
```

### Task 6: Run Full Admin, Deployment, and Delivery Verification

**Files:**
- Modify: `frontend/tests/e2e/admin-console.spec.ts`
- Modify: `frontend/tests/e2e/public-site.spec.ts`
- Modify: `docs/deployment-tencent-cvm.md` only when commands or mounts change.
- Modify: `docs/delivery/EXTERNAL-TODO.md` only for genuine external production dependencies.

- [ ] **Step 1: Add the complete operator E2E flow**

Log in, open 内容管理 → 项目案例, create a case through business fields, confirm EN/RU completion, upload/select desktop and mobile media, save draft, generate full frontend preview, navigate the preview in all languages, submit review, approve, publish, and confirm the public case page plus sitemap entry.

- [ ] **Step 2: Add Admin layout checks**

At 390, 768, 1024, 1440, and 1920 widths, assert no horizontal page overflow, no cropped sidebar labels, one open submenu group, 44px touch targets, readable tables/mobile lists, and no English or internal technical terms.

- [ ] **Step 3: Verify backup-aware content delivery**

Create an encrypted backup from Admin, inspect that SQLite and uploaded media are included, run restore verification, and confirm the content seed upgrade does not overwrite the restored operator-created case.

- [ ] **Step 4: Verify Docker production behavior**

Run: `docker compose config`

Expected: valid config with persistent database/media/backup mounts, backend migration/initialization before serving, frontend/backend health checks, and Caddy ACME configuration.

- [ ] **Step 5: Run the repository verification gate**

Run: `pnpm assets:verify && pnpm verify`

Expected: brand, schema, OpenAPI, tests, lint, typecheck, and builds all PASS.

- [ ] **Step 6: Run browser acceptance**

Run: `pnpm --filter @anshow/frontend test:e2e`

Expected: Admin, public, preview, SEO, Chromium, and WebKit critical flows PASS.

- [ ] **Step 7: Inspect the final worktree**

Run: `git status --short && git diff --check`

Expected: only intentional deliverables, no `.DS_Store`, local SQLite files, secrets, generated temporary sessions, or unreviewed image candidates.

- [ ] **Step 8: Commit delivery evidence**

```bash
git add frontend/tests/e2e docs/deployment-tencent-cvm.md docs/delivery/EXTERNAL-TODO.md
git commit -m "Prove nontechnical operators can publish the complete website"
```
