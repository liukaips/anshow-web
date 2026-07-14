# AnShow Administration and Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the secure `/admin` console for multilingual content, media, publishing, navigation, settings, staff accounts, roles, and audit history.

**Architecture:** Admin pages are server-rendered and permission-guarded. Mutations use validated server actions, typed repositories, transactional audit records, and revalidation of affected public paths.

**Tech Stack:** Next.js Server Components and Actions, TypeScript, Drizzle, SQLite, Better Auth, Zod, Tailwind CSS, Lucide, Vitest, Playwright

---

## Execution Order and File Map

Run after the foundation plan. Content tables from the public plan must exist before Task 3.

- `src/app/admin/(protected)/*`: permission-protected admin routes.
- `src/components/admin/*`: dense work-focused admin primitives.
- `src/admin/actions/*`: validated server actions.
- `src/admin/repositories/*`: content, staff, settings, and audit access.
- `src/db/schema/settings.ts`: settings, contact channels, and audit log.
- `src/media/*`: media storage and derivative integration.

### Task 1: Build the Protected Admin Shell and Permission Navigation

**Files:**
- Create: `src/app/admin/(protected)/layout.tsx`
- Create: `src/app/admin/(protected)/page.tsx`
- Create: `src/components/admin/admin-sidebar.tsx`
- Create: `src/components/admin/admin-topbar.tsx`
- Create: `src/components/admin/admin-sidebar.test.tsx`
- Create: `src/auth/require-permission.ts`
- Create: `src/auth/permission-repository.ts`

- [ ] **Step 1: Write the failing permission-navigation test**

```tsx
// src/components/admin/admin-sidebar.test.tsx
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { AdminSidebar } from "./admin-sidebar";

it("hides staff management from a content-only role", () => {
  render(<AdminSidebar permissions={["content.read", "content.write"]} />);
  expect(screen.getByRole("link", { name: "Pages" })).toBeVisible();
  expect(screen.queryByRole("link", { name: "Staff & Roles" })).toBeNull();
});
```

- [ ] **Step 2: Run test and confirm failure**

Run: `pnpm test -- src/components/admin/admin-sidebar.test.tsx`

Expected: FAIL because the admin shell does not exist.

- [ ] **Step 3: Implement the server permission guard**

```ts
// src/auth/require-permission.ts
import { redirect } from "next/navigation";
import { auth } from "./server";
import { headers } from "next/headers";
import { db } from "@/db/client";
import { permissionsForUser } from "./permission-repository";
import { can } from "./permissions";
import type { PermissionKey } from "./permissions";

export async function requireAdminSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/admin/login");
  const permissions = await permissionsForUser(db, session.user.id);
  return { session, permissions };
}

export async function requirePermission(required: PermissionKey) {
  const { session, permissions } = await requireAdminSession();
  if (!can(permissions, required)) redirect("/admin/forbidden");
  return { session, permissions };
}
```

```ts
// src/auth/permission-repository.ts
import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { permissions, rolePermissions, userRoles } from "@/db/schema/rbac";
import type { PermissionKey } from "./permissions";

export async function permissionsForUser(db: AppDatabase, userId: string): Promise<PermissionKey[]> {
  const rows = await db.select({ key: permissions.key }).from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(userRoles.userId, userId));
  return rows.map(({ key }) => key as PermissionKey);
}
```

- [ ] **Step 4: Implement the admin shell**

```tsx
// src/app/admin/(protected)/layout.tsx
import { requireAdminSession } from "@/auth/require-permission";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { session, permissions } = await requireAdminSession();
  return <div className="grid min-h-dvh grid-cols-[224px_1fr] bg-slate-100">
    <AdminSidebar permissions={permissions} />
    <div className="min-w-0"><AdminTopbar email={session.user.email} />{children}</div>
  </div>;
}
```

```tsx
// src/components/admin/admin-sidebar.tsx
import Link from "next/link";
import type { PermissionKey } from "@/auth/permissions";
import { can } from "@/auth/permissions";

const items: { href: string; label: string; permission: PermissionKey }[] = [
  { href: "/admin", label: "Dashboard", permission: "content.read" },
  { href: "/admin/content/pages", label: "Pages", permission: "content.read" },
  { href: "/admin/content/hero-slides", label: "Hero Slides", permission: "content.read" },
  { href: "/admin/content/services", label: "Services", permission: "content.read" },
  { href: "/admin/content/trade-lanes", label: "Trade Lanes", permission: "content.read" },
  { href: "/admin/content/cargo-types", label: "Special Cargo", permission: "content.read" },
  { href: "/admin/content/editorial", label: "Cases & Insights", permission: "content.read" },
  { href: "/admin/media", label: "Media", permission: "media.read" },
  { href: "/admin/inquiries", label: "Enquiries", permission: "inquiry.read" },
  { href: "/admin/staff", label: "Staff & Roles", permission: "staff.manage" },
  { href: "/admin/settings", label: "Site Settings", permission: "settings.manage" },
  { href: "/admin/audit", label: "Audit Log", permission: "audit.read" },
];

export function AdminSidebar({ permissions }: { permissions: readonly string[] }) {
  return <aside><nav aria-label="Administration">{items.filter((item) => can(permissions, item.permission)).map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav></aside>;
}
```

`AdminTopbar` renders the signed-in email and an icon-based sign-out control. Replace the fixed two-column layout with an off-canvas navigation drawer below `768px` so the admin remains usable on phones.

- [ ] **Step 5: Verify and commit**

Run:

```bash
pnpm test -- src/components/admin/admin-sidebar.test.tsx
pnpm build
```

Expected: test and build pass.

```bash
git add src/app/admin src/components/admin src/auth
git commit -m "Make administration navigation reflect real authority" \
  -m "Constraint: Hidden controls cannot substitute for server-side permission checks" \
  -m "Confidence: high" -m "Scope-risk: broad" \
  -m "Tested: sidebar permission test and production build"
```

### Task 2: Add Settings, Contact Channels, and Audit Storage

**Files:**
- Create: `src/db/schema/settings.ts`
- Modify: `src/db/schema/index.ts`
- Create: `src/admin/repositories/settings-repository.ts`
- Create: `src/admin/repositories/audit-repository.ts`
- Create: `src/admin/repositories/settings-repository.test.ts`
- Create: `src/admin/actions/settings.ts`

- [ ] **Step 1: Write the failing settings test**

```ts
// src/admin/repositories/settings-repository.test.ts
import { expect, it } from "vitest";
import { orderEnabledChannels } from "./settings-repository";

it("orders only enabled contact channels", async () => {
  expect(orderEnabledChannels([
    { kind: "whatsapp", label: "WhatsApp", value: "+100", enabled: true, sortOrder: 2 },
    { kind: "wechat", label: "WeChat", value: "anshow", enabled: false, sortOrder: 1 },
    { kind: "email", label: "Email", value: "sales@anshow.test", enabled: true, sortOrder: 1 },
  ])).toEqual([
    expect.objectContaining({ kind: "email" }),
    expect.objectContaining({ kind: "whatsapp" }),
  ]);
});
```

- [ ] **Step 2: Run test and confirm failure**

Run: `pnpm test -- src/admin/repositories/settings-repository.test.ts`

Expected: FAIL because settings tables do not exist.

- [ ] **Step 3: Define settings and audit tables**

```ts
// src/db/schema/settings.ts
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const siteSettings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  updatedBy: text("updated_by").notNull(),
});

export const contactChannels = sqliteTable("contact_channels", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: ["whatsapp", "wechat", "telegram", "phone", "email"] }).notNull(),
  label: text("label").notNull(),
  value: text("value").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(), actorId: text("actor_id").notNull(),
  action: text("action").notNull(), entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(), detail: text("detail").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```

```ts
// src/admin/repositories/settings-repository.ts
import { db } from "@/db/client";
import { auditLogs, contactChannels } from "@/db/schema/settings";
type Channel = { kind: "whatsapp" | "wechat" | "telegram" | "phone" | "email"; label: string; value: string; enabled: boolean; sortOrder: number };
export function orderEnabledChannels(channels: readonly Channel[]) {
  return channels.filter((channel) => channel.enabled).toSorted((a, b) => a.sortOrder - b.sortOrder);
}
export const settingsRepository = {
  async saveChannelsWithAudit(channels: readonly Channel[], actorId: string) {
    return db.transaction(async (tx) => {
      await tx.delete(contactChannels);
      if (channels.length) await tx.insert(contactChannels).values(channels.map((channel) => ({ id: crypto.randomUUID(), ...channel })));
      await tx.insert(auditLogs).values({ id: crypto.randomUUID(), actorId, action: "settings.channels.update", entityType: "settings", entityId: "contact-channels", detail: JSON.stringify({ count: channels.length }), createdAt: new Date() });
      return orderEnabledChannels(channels);
    });
  },
};
```

- [ ] **Step 4: Implement transactional settings action**

```ts
// src/admin/actions/settings.ts
"use server";
import { z } from "zod";
import { requirePermission } from "@/auth/require-permission";
import { settingsRepository } from "@/admin/repositories/settings-repository";

const channelSchema = z.object({
  kind: z.enum(["whatsapp", "wechat", "telegram", "phone", "email"]),
  label: z.string().min(1).max(80), value: z.string().min(1), enabled: z.boolean(), sortOrder: z.number().int(),
});

export async function saveContactChannels(input: unknown) {
  const session = await requirePermission("settings.manage");
  const channels = z.array(channelSchema).parse(input);
  return settingsRepository.saveChannelsWithAudit(channels, session.session.user.id);
}
```

- [ ] **Step 5: Verify and commit**

Run:

```bash
pnpm test -- src/admin/repositories/settings-repository.test.ts
pnpm db:generate
pnpm typecheck
```

Expected: test, migration generation, and typecheck pass.

```bash
git add src/db/schema src/admin migrations
git commit -m "Keep public contact and configuration changes traceable" \
  -m "Constraint: Staff must configure channels without editing code and every change needs an actor" \
  -m "Confidence: high" -m "Scope-risk: moderate" \
  -m "Tested: settings repository test, migration generation, and typecheck"
```

### Task 3: Build the Multilingual Content Editor and Publishing Rules

**Files:**
- Create: `src/admin/content/content-schema.ts`
- Create: `src/admin/content/content-schema.test.ts`
- Create: `src/admin/repositories/content-repository.ts`
- Create: `src/admin/actions/content.ts`
- Create: `src/components/admin/content-editor.tsx`
- Create: `src/components/admin/locale-tabs.tsx`
- Create: `src/app/admin/(protected)/content/[collection]/page.tsx`
- Create: `src/app/admin/(protected)/content/[collection]/[id]/page.tsx`

- [ ] **Step 1: Write the failing translation-completeness test**

```ts
// src/admin/content/content-schema.test.ts
import { expect, it } from "vitest";
import { canPublishTranslation } from "./content-schema";

it("blocks a translation missing SEO and alt text", () => {
  expect(canPublishTranslation({
    title: "Ocean", slug: "ocean", summary: "Summary", body: "Body",
    seoTitle: "", seoDescription: "", altText: "",
  })).toBe(false);
});
```

- [ ] **Step 2: Run test and confirm failure**

Run: `pnpm test -- src/admin/content/content-schema.test.ts`

Expected: FAIL because the content validation module does not exist.

- [ ] **Step 3: Implement content validation**

```ts
// src/admin/content/content-schema.ts
import { z } from "zod";

export const translationSchema = z.object({
  title: z.string().min(1), slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  summary: z.string().min(1), body: z.string().min(1),
  seoTitle: z.string().min(1).max(60), seoDescription: z.string().min(1).max(160),
  altText: z.string().min(1),
});

export function canPublishTranslation(input: unknown) {
  return translationSchema.safeParse(input).success;
}
```

- [ ] **Step 4: Implement collection-aware CRUD and publishing**

```ts
// src/admin/repositories/content-repository.ts
import type { Locale } from "@/lib/app-config";
import { translationSchema } from "@/admin/content/content-schema";

export type ContentCollection = "pages" | "hero-slides" | "services" | "trade-lanes" | "cargo-types" | "case-studies" | "articles" | "partners" | "certificates" | "proof-metrics" | "navigation-items";
export interface ContentPort {
  transaction<T>(work: (tx: ContentPort) => Promise<T>): Promise<T>;
  saveTranslation(collection: ContentCollection, id: string, locale: Locale, value: unknown): Promise<{ slug: string }>;
  isVerified(collection: ContentCollection, id: string): Promise<boolean>;
  setPublication(collection: ContentCollection, id: string, locale: Locale, state: "draft" | "scheduled" | "published", at: Date | null): Promise<void>;
  archive(collection: ContentCollection, id: string): Promise<void>;
  audit(actorId: string, action: string, entityId: string, detail: unknown): Promise<void>;
}

export function createContentRepository(port: ContentPort) {
  return {
    updateTranslation(collection: ContentCollection, id: string, locale: Locale, input: unknown, actorId: string) {
      const value = translationSchema.parse(input);
      return port.transaction(async (tx) => {
        const saved = await tx.saveTranslation(collection, id, locale, value);
        await tx.audit(actorId, "content.translation.update", id, { collection, locale });
        return saved;
      });
    },
    publishLocale(collection: ContentCollection, id: string, locale: Locale, input: unknown, actorId: string) {
      translationSchema.parse(input);
      return port.transaction(async (tx) => {
        if (["partners", "certificates", "proof-metrics"].includes(collection) && !(await tx.isVerified(collection, id))) throw new Error("Verification source is required before publishing proof content");
        await tx.setPublication(collection, id, locale, "published", new Date());
        await tx.audit(actorId, "content.publish", id, { collection, locale });
      });
    },
    scheduleLocale(collection: ContentCollection, id: string, locale: Locale, at: Date, actorId: string) {
      if (at <= new Date()) throw new Error("Schedule must be in the future");
      return port.transaction(async (tx) => {
        await tx.setPublication(collection, id, locale, "scheduled", at);
        await tx.audit(actorId, "content.schedule", id, { collection, locale, at: at.toISOString() });
      });
    },
  };
}
```

```ts
// src/admin/actions/content.ts
"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/auth/require-permission";

export async function publishTranslation(input: { collection: ContentCollection; id: string; locale: Locale; value: unknown; path: string }) {
  const { session } = await requirePermission("content.publish");
  await contentRepository.publishLocale(input.collection, input.id, input.locale, input.value, session.user.id);
  revalidatePath(input.path);
}
```

- [ ] **Step 5: Build the editor UI**

```tsx
// src/components/admin/content-editor.tsx
"use client";
import { useEffect, useState } from "react";
type TranslationDraft = { title: string; slug: string; summary: string; body: string; seoTitle: string; seoDescription: string; altText: string; completeness: Record<"en" | "zh" | "ru", boolean> };

export function ContentEditor({ initial, save, publish }: { initial: TranslationDraft; save: (draft: TranslationDraft) => Promise<void>; publish: (draft: TranslationDraft) => Promise<void> }) {
  const [draft, setDraft] = useState(initial);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    addEventListener("beforeunload", warn); return () => removeEventListener("beforeunload", warn);
  }, [dirty]);
  return <form action={async () => { await save(draft); setDirty(false); }}>
    <LocaleTabs locales={["en", "zh", "ru"]} completeness={draft.completeness} />
    {(["title", "slug", "summary", "body", "seoTitle", "seoDescription", "altText"] as const).map((field) => <label key={field}>{field}<textarea name={field} value={draft[field]} onChange={(event) => { setDraft({ ...draft, [field]: event.target.value }); setDirty(true); }} /></label>)}
    <button type="submit">Save draft</button>
    <button type="button" onClick={() => publish(draft)}>Publish</button>
  </form>;
}
```

Add a schedule datetime control and preview link beside the publish command. The server action returns Zod field errors; on failure, focus the first `[aria-invalid=true]` field. All inputs use visible labels and a minimum control height of `44px`.

- [ ] **Step 6: Verify and commit**

Run:

```bash
pnpm test -- src/admin/content/content-schema.test.ts
pnpm build
```

Expected: validation test and build pass.

```bash
git add src/admin/content src/admin/repositories/content-repository.ts src/admin/actions/content.ts src/components/admin 'src/app/admin/(protected)/content'
git commit -m "Let staff publish each language without mixing incomplete content" \
  -m "Constraint: English, Chinese, and Russian publish independently with required SEO and alt text" \
  -m "Confidence: high" -m "Scope-risk: broad" \
  -m "Tested: translation validation test and production build"
```

### Task 4: Add the Media Library and Safe Derivative Workflow

**Files:**
- Create: `src/media/storage.ts`
- Create: `src/media/local-storage.ts`
- Create: `src/media/media-service.ts`
- Create: `src/media/media-service.test.ts`
- Create: `src/admin/actions/media.ts`
- Create: `src/components/admin/media-library.tsx`
- Create: `src/app/admin/(protected)/media/page.tsx`
- Modify: `compose.yaml`
- Modify: `Caddyfile`

- [ ] **Step 1: Write the failing unsafe-upload test**

```ts
// src/media/media-service.test.ts
import { expect, it } from "vitest";
import { validateUpload } from "./media-service";

it("rejects executable content with an image extension", async () => {
  await expect(validateUpload({ name: "photo.jpg", type: "image/jpeg", bytes: Buffer.from("MZ") }))
    .rejects.toThrow("signature");
});
```

- [ ] **Step 2: Run test and confirm failure**

Run: `pnpm test -- src/media/media-service.test.ts`

Expected: FAIL because media validation does not exist.

- [ ] **Step 3: Implement storage and validation contracts**

```ts
// src/media/storage.ts
export interface MediaStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<{ url: string }>;
  delete(key: string): Promise<void>;
}
```

```ts
// src/media/local-storage.ts
import fs from "node:fs/promises";
import path from "node:path";
import type { MediaStorage } from "./storage";
export class LocalStorage implements MediaStorage {
  constructor(private root = "/media") {}
  private target(key: string) { const safe = key.replace(/^\/+/, ""); const target = path.resolve(this.root, safe); if (!target.startsWith(`${path.resolve(this.root)}${path.sep}`)) throw new Error("Invalid media key"); return target; }
  async put(key: string, body: Uint8Array) { const target = this.target(key); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, body, { flag: "wx" }); return { url: `/media/${key.replace(/^\/+/, "")}` }; }
  async delete(key: string) { await fs.rm(this.target(key), { force: true }); }
}
```

Mount `media-data:/srv/media:ro` into Caddy and add this handler before the application proxy:

```yaml
# compose.yaml caddy volume addition
services:
  caddy:
    volumes:
      - media-data:/srv/media:ro
```

```caddyfile
handle_path /media/* {
  root * /srv/media
  header Cache-Control "public, max-age=31536000, immutable"
  file_server
}
handle { reverse_proxy app:3000 }
```

```ts
// src/media/media-service.ts
import sharp from "sharp";
const allowed = new Set(["jpeg", "png", "webp", "avif"]);
export type UploadInput = { name: string; type: string; bytes: Uint8Array };
export async function validateUpload(file: UploadInput) {
  if (file.bytes.byteLength > 20 * 1024 * 1024) throw new Error("Image exceeds 20MB");
  let metadata: sharp.Metadata;
  try { metadata = await sharp(file.bytes, { failOn: "error" }).metadata(); } catch { throw new Error("Image signature is invalid"); }
  if (!metadata.format || !allowed.has(metadata.format)) throw new Error("Unsupported image signature");
  if (!metadata.width || !metadata.height || metadata.width > 8000 || metadata.height > 8000) throw new Error("Image dimensions are invalid");
  return { format: metadata.format, width: metadata.width, height: metadata.height };
}
export async function processUpload(storage: MediaStorage, file: UploadInput) {
  const metadata = await validateUpload(file); const id = crypto.randomUUID();
  const source = sharp(file.bytes).rotate();
  const derivatives = await Promise.all([480, 768, 1280, 1920].flatMap((width) => [
    source.clone().resize({ width, withoutEnlargement: true }).avif({ quality: 55 }).toBuffer().then((body) => storage.put(`${id}/${width}.avif`, body, "image/avif")),
    source.clone().resize({ width, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer().then((body) => storage.put(`${id}/${width}.webp`, body, "image/webp")),
  ]));
  return { id, metadata, derivatives };
}
```

Generate randomized keys, strip source metadata, and enforce the public pipeline's hero/content/thumbnail byte budgets before recording a derivative.

- [ ] **Step 4: Build the library UI and safe actions**

```tsx
// src/components/admin/media-library.tsx
"use client";
type MediaLibraryProps = { assets: readonly { id: string; thumbnailUrl: string; alt: Record<"en" | "zh" | "ru", string>; references: readonly string[] }[]; remove(id: string): Promise<void>; replace(id: string): Promise<void> };
export function MediaLibrary({ assets, remove, replace }: MediaLibraryProps) {
  return <section><div role="toolbar"><input type="search" aria-label="Search media" /><button type="button">Grid view</button><button type="button">List view</button></div>
    <ul>{assets.map((asset) => <li key={asset.id}><img src={asset.thumbnailUrl} alt="" /><label>English alt text<input value={asset.alt.en} readOnly /></label><p>{asset.references.length} references</p><button onClick={() => replace(asset.id)} type="button">Replace</button><button disabled={asset.references.length > 0} onClick={() => remove(asset.id)} type="button">Delete</button></li>)}</ul>
  </section>;
}
```

```ts
// src/admin/actions/media.ts
"use server";
export async function deleteMedia(id: string) {
  await requirePermission("media.write");
  const references = await mediaRepository.references(id);
  if (references.length) return { ok: false as const, error: "Media is still in use" };
  await mediaRepository.delete(id);
  return { ok: true as const };
}
```

Upload and replacement call `mediaService.processUpload`, report progress, preserve the media ID on replacement, and regenerate derivatives. Store focal coordinates and EN/ZH/RU alt text with the media record.

- [ ] **Step 5: Verify and commit**

Run:

```bash
pnpm test -- src/media/media-service.test.ts
pnpm build
```

Expected: unsafe upload test and build pass.

```bash
git add src/media src/admin/actions/media.ts src/components/admin/media-library.tsx 'src/app/admin/(protected)/media'
git commit -m "Keep uploaded media optimized and non-executable" \
  -m "Constraint: Staff uploads must not bypass image budgets or create unsafe public files" \
  -m "Confidence: high" -m "Scope-risk: broad" \
  -m "Tested: upload validation test and production build"
```

### Task 5: Implement Staff Accounts, Custom Roles, and Forced Session Invalidation

**Files:**
- Create: `src/admin/repositories/staff-repository.ts`
- Create: `src/admin/repositories/staff-repository.test.ts`
- Create: `src/admin/actions/staff.ts`
- Create: `src/components/admin/staff-form.tsx`
- Create: `src/components/admin/role-matrix.tsx`
- Create: `src/app/admin/(protected)/staff/page.tsx`
- Create: `src/app/admin/(protected)/staff/[id]/page.tsx`

- [ ] **Step 1: Write the failing session-revocation test**

```ts
// src/admin/repositories/staff-repository.test.ts
import { expect, it } from "vitest";
import { createStaffRepository } from "./staff-repository";
import { vi } from "vitest";

it("revokes sessions when a user is disabled", async () => {
  const deleteSessions = vi.fn();
  const repository = createStaffRepository({ deleteSessions, disableUser: vi.fn(), audit: vi.fn() });
  await repository.disable("user-1", "admin-1");
  expect(deleteSessions).toHaveBeenCalledWith("user-1");
});
```

- [ ] **Step 2: Run test and confirm failure**

Run: `pnpm test -- src/admin/repositories/staff-repository.test.ts`

Expected: FAIL because staff repository does not exist.

- [ ] **Step 3: Implement staff lifecycle transactions**

```ts
// src/admin/repositories/staff-repository.ts
export interface StaffTransactionPort {
  disableUser(userId: string): Promise<void>;
  deleteSessions(userId: string): Promise<void>;
  audit(actorId: string, action: string, userId: string): Promise<void>;
}
export function createStaffRepository(port: StaffTransactionPort) {
  return { async disable(userId: string, actorId: string) {
    await port.disableUser(userId);
    await port.deleteSessions(userId);
    await port.audit(actorId, "staff.disable", userId);
  } };
}
```

The production port wraps `disableUser`, session deletion, and audit insertion in one SQLite transaction. Create, enable, password reset, role assignment, and permission replacement use the same port pattern and revoke sessions after password or role changes.

- [ ] **Step 4: Build staff and role screens**

```tsx
// src/components/admin/role-matrix.tsx
import type { PermissionKey } from "@/auth/permissions";
export function RoleMatrix({ all, granted }: { all: readonly PermissionKey[]; granted: readonly PermissionKey[] }) {
  return <fieldset><legend>Permissions</legend>{all.map((permission) => <label key={permission}><input type="checkbox" name="permissions" value={permission} defaultChecked={granted.includes(permission)} />{permission}</label>)}</fieldset>;
}
```

```ts
// src/admin/actions/staff.ts
"use server";
export async function disableStaff(userId: string) {
  const { session } = await requirePermission("staff.manage");
  if (await staffRepository.isLastEnabledSuperAdmin(userId)) return { ok: false as const, error: "The final Super Administrator cannot be disabled" };
  await staffRepository.disable(userId, session.user.id);
  return { ok: true as const };
}
```

The staff forms include email, display name, enabled state, password visibility control, role presets, the custom permission matrix, an explicit destructive confirmation dialog, and the account audit summary.

- [ ] **Step 5: Verify and commit**

Run:

```bash
pnpm test -- src/admin/repositories/staff-repository.test.ts
pnpm build
```

Expected: session-revocation test and build pass.

```bash
git add src/admin/repositories/staff-repository* src/admin/actions/staff.ts src/components/admin/staff-form.tsx src/components/admin/role-matrix.tsx 'src/app/admin/(protected)/staff'
git commit -m "Make staff authority explicit and immediately revocable" \
  -m "Constraint: Role and password changes must invalidate existing sessions" \
  -m "Confidence: high" -m "Scope-risk: broad" \
  -m "Directive: Never allow removal of the final enabled Super Administrator" \
  -m "Tested: session revocation test and production build"
```

### Task 6: Add Dashboard, Audit Log, First-Run Checklist, and Admin E2E

**Files:**
- Create: `src/app/admin/(protected)/audit/page.tsx`
- Create: `src/app/admin/(protected)/settings/page.tsx`
- Create: `src/components/admin/first-run-checklist.tsx`
- Create: `src/admin/dashboard.ts`
- Create: `tests/e2e/admin.spec.ts`

- [ ] **Step 1: Write failing admin E2E coverage**

```ts
// tests/e2e/admin.spec.ts
import { test, expect } from "@playwright/test";

test("content editor cannot see staff management", async ({ page }) => {
  await loginAs(page, "editor@anshow.test", "EditorPass123!");
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: "Pages" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Staff & Roles" })).toHaveCount(0);
});

test("publisher can publish a complete Russian translation", async ({ page }) => {
  await loginAs(page, "publisher@anshow.test", "PublisherPass123!");
  await page.goto("/admin/content/services/service-ocean");
  await page.getByRole("tab", { name: "Русский" }).click();
  await page.getByRole("button", { name: "Publish Russian" }).click();
  await expect(page.getByText("Published")).toBeVisible();
});
```

```ts
// tests/e2e/helpers/auth.ts
import type { Page } from "@playwright/test";
export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/admin");
}
```

Import `loginAs` from `./helpers/auth` in `tests/e2e/admin.spec.ts`.

- [ ] **Step 2: Run E2E and confirm failure**

Run: `pnpm test:e2e -- tests/e2e/admin.spec.ts`

Expected: FAIL because dashboard and complete admin routes are absent.

- [ ] **Step 3: Implement dashboard and first-run checklist**

```ts
// src/admin/dashboard.ts
export interface DashboardRepository {
  countNewEnquiries(): Promise<number>; countOpenLeads(): Promise<number>; countTranslationGaps(): Promise<number>;
  countPublished(): Promise<number>; countScheduled(): Promise<number>; countUnassigned(): Promise<number>; recentAudit(limit: number): Promise<unknown[]>;
}
export async function getDashboard(repository: DashboardRepository) {
  const [newEnquiries, openLeads, translationGaps, publishedItems, scheduledItems, unassignedEnquiries, recentAudit] = await Promise.all([
    repository.countNewEnquiries(), repository.countOpenLeads(), repository.countTranslationGaps(),
    repository.countPublished(), repository.countScheduled(), repository.countUnassigned(), repository.recentAudit(10),
  ]);
  return { newEnquiries, openLeads, translationGaps, publishedItems, scheduledItems, unassignedEnquiries, recentAudit };
}
```

```tsx
// src/components/admin/first-run-checklist.tsx
type CompanySettings = { legalName: string; publicEmail: string; publicPhone: string; privacyController: string; enabledChannelCount: number };
export function FirstRunChecklist({ settings }: { settings: CompanySettings }) {
  const items = [
    ["Legal name", Boolean(settings.legalName)],
    ["Public contact", Boolean(settings.publicEmail || settings.publicPhone)],
    ["Privacy controller", Boolean(settings.privacyController)],
    ["Contact channel", settings.enabledChannelCount > 0],
  ] as const;
  return <section aria-labelledby="first-run"><h2 id="first-run">Launch checklist</h2><ul>{items.map(([label, done]) => <li key={label}>{done ? "Complete" : "Required"}: {label}</li>)}</ul></section>;
}
```

Proof metrics, certifications, and partners remain unpublished until their records have a verified flag and a source note.

- [ ] **Step 4: Implement audit list and filters**

```tsx
// src/app/admin/(protected)/audit/page.tsx
export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("audit.read");
  const filters = auditFilterSchema.parse(await searchParams);
  const result = await auditRepository.list(filters);
  return <main><h1>Audit log</h1><AuditFilters value={filters} /><table><tbody>{result.items.map((row) => <tr key={row.id}><td>{row.actorEmail}</td><td>{row.action}</td><td>{row.entityType}</td><td><dl>{Object.entries(row.detail).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl></td></tr>)}</tbody></table><Pagination cursor={result.nextCursor} /></main>;
}
```

`auditFilterSchema` accepts actor, action, entity type, from/to dates, and cursor. The repository orders by `(createdAt, id)` descending and returns at most 50 rows.

- [ ] **Step 5: Verify admin completion**

Run:

```bash
pnpm test
pnpm build
pnpm test:e2e -- tests/e2e/admin.spec.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin src/components/admin src/admin tests/e2e
git commit -m "Give staff a complete and auditable publishing workspace" \
  -m "Constraint: The site cannot show fabricated proof while company facts remain unconfigured" \
  -m "Confidence: high" -m "Scope-risk: broad" \
  -m "Tested: unit suite, production build, and admin Playwright flows"
```

## Administration Completion Gate

Run:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e -- tests/e2e/admin.spec.ts
```

Expected: authorized staff can manage all specified collections and translations, publish per locale, process media, configure channels, manage accounts/roles, and inspect audits. Unauthorized users receive no route or action access.
