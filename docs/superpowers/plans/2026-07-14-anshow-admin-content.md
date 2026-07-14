# AnShow Administration and Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the secure `/admin` console for multilingual content, media, publishing, navigation, settings, staff accounts, roles, and audit history.

**Architecture:** The Hono backend owns every admin repository, Zod/OpenAPI schema, permission middleware, mutation, media operation, and transactional audit record. Next.js server-renders `/admin` by forwarding the staff cookie to the backend and uses generated OpenAPI types; browser mutations call same-origin `/api/admin/*` and never import backend source. Backend authorization is authoritative, while frontend permission-aware navigation only improves usability.

**Tech Stack:** Next.js Server Components, React, Hono, OpenAPI, TypeScript, Drizzle, SQLite, Better Auth, Zod, Tailwind CSS, Lucide, Vitest, Playwright

---

## Execution Order and File Map

Run after the foundation plan. Content tables from the public plan must exist before Task 3.

- `frontend/src/app/admin/(protected)/*`: permission-protected admin routes.
- `frontend/src/components/admin/*`: dense work-focused admin primitives.
- `backend/src/admin/routes/*`: validated Hono OpenAPI administration resources.
- `backend/src/admin/repositories/*`: content, staff, settings, and audit access.
- `backend/src/db/schema/settings.ts`: settings, contact channels, and audit log.
- `backend/src/media/*`: media storage and derivative integration.

### Task 1: Build the Protected Admin Shell and Permission Navigation

**Files:**
- Create: `frontend/src/app/admin/(protected)/layout.tsx`
- Create: `frontend/src/app/admin/(protected)/page.tsx`
- Create: `frontend/src/components/admin/admin-sidebar.tsx`
- Create: `frontend/src/components/admin/admin-topbar.tsx`
- Create: `frontend/src/components/admin/admin-sidebar.test.tsx`
- Create: `backend/src/auth/permission-middleware.ts`
- Create: `backend/src/auth/permission-middleware.test.ts`
- Modify: `frontend/src/api/server.ts`

- [ ] **Step 1: Write the failing permission-navigation test**

```tsx
// frontend/src/components/admin/admin-sidebar.test.tsx
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

Run: `pnpm --filter @anshow/frontend test -- src/components/admin/admin-sidebar.test.tsx`

Expected: FAIL because the admin shell does not exist.

- [ ] **Step 3: Implement the Hono permission middleware**

```ts
// backend/src/auth/permission-middleware.ts
import { createMiddleware } from "hono/factory";
import { auth } from "./server";
import { db } from "@/db/client";
import { permissionsForUser } from "./permission-repository";
import { can } from "./permissions";
import type { PermissionKey } from "./permissions";

export const requirePermission = (required: PermissionKey) => createMiddleware(async (context, next) => {
  const requestId = context.get("requestId");
  const session = await auth.api.getSession({ headers: context.req.raw.headers });
  if (!session) return context.json({ data: null, error: { code: "UNAUTHENTICATED", message: "Authentication required" }, requestId }, 401);
  const permissions = await permissionsForUser(db, session.user.id);
  if (!can(permissions, required)) return context.json({ data: null, error: { code: "FORBIDDEN", message: "Permission denied" }, requestId }, 403);
  context.set("actor", { user: session.user, permissions });
  await next();
});
```

```ts
// backend/src/auth/permission-middleware.test.ts
import { expect, it } from "vitest";
import { createPermissionTestApp } from "@/test/permission-app";

it("returns 403 before a protected handler runs", async () => {
  const fixture = createPermissionTestApp({ permissions: ["content.read"] });
  const response = await fixture.request("/write");
  expect(response.status).toBe(403);
  expect(fixture.handler).not.toHaveBeenCalled();
});
```

Augment the shared Hono environment type with `actor: { user: { id: string; email: string }; permissions: PermissionKey[] }`. Every admin route added in later tasks attaches `requirePermission(...)` before its handler; frontend visibility checks do not grant access.

- [ ] **Step 4: Implement the frontend-only session shell**

```tsx
// frontend/src/app/admin/(protected)/layout.tsx
import { redirect } from "next/navigation";
import { getAdminSession } from "@/api/server";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return <div className="grid min-h-dvh grid-cols-1 bg-neutral-100 md:grid-cols-[224px_1fr]">
    <AdminSidebar permissions={session.permissions} />
    <div className="min-w-0"><AdminTopbar email={session.user.email} />{children}</div>
  </div>;
}
```

```tsx
// frontend/src/components/admin/admin-sidebar.tsx
import Link from "next/link";
const items: { href: string; label: string; permission: string }[] = [
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
  return <aside><nav aria-label="Administration">{items.filter((item) => permissions.includes(item.permission)).map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav></aside>;
}
```

`AdminTopbar` renders the signed-in email and an icon-based sign-out control. Replace the fixed two-column layout with an off-canvas navigation drawer below `768px` so the admin remains usable on phones.

- [ ] **Step 5: Verify and commit**

Run:

```bash
pnpm --filter @anshow/backend test -- src/auth/permission-middleware.test.ts
pnpm --filter @anshow/frontend test -- src/components/admin/admin-sidebar.test.tsx
pnpm --filter @anshow/backend typecheck
pnpm --filter @anshow/frontend build
```

Expected: test and build pass.

```bash
git add backend/src/auth/permission-middleware* frontend/src/app/admin frontend/src/components/admin frontend/src/api/server.ts
git commit -m "Make administration navigation reflect real authority" \
  -m "Constraint: Hidden controls cannot substitute for server-side permission checks" \
  -m "Confidence: high" -m "Scope-risk: broad" \
  -m "Tested: sidebar permission test and production build"
```

### Task 2: Add Settings, Contact Channels, and Audit Storage

**Files:**
- Create: `backend/src/db/schema/settings.ts`
- Modify: `backend/src/db/schema/index.ts`
- Create: `backend/src/admin/repositories/settings-repository.ts`
- Create: `backend/src/admin/repositories/audit-repository.ts`
- Create: `backend/src/admin/repositories/settings-repository.test.ts`
- Create: `backend/src/admin/routes/settings.ts`
- Create: `backend/src/admin/routes/settings.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Write the failing settings test**

```ts
// backend/src/admin/repositories/settings-repository.test.ts
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

Run: `pnpm --filter @anshow/backend test -- src/admin/repositories/settings-repository.test.ts`

Expected: FAIL because settings tables do not exist.

- [ ] **Step 3: Define settings and audit tables**

```ts
// backend/src/db/schema/settings.ts
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
// backend/src/admin/repositories/settings-repository.ts
import { db } from "@/db/client";
import { auditLogs, contactChannels } from "@/db/schema/settings";
type Channel = { kind: "whatsapp" | "wechat" | "telegram" | "phone" | "email"; label: string; value: string; enabled: boolean; sortOrder: number };
export function orderEnabledChannels(channels: readonly Channel[]) {
  return channels.filter((channel) => channel.enabled).toSorted((a, b) => a.sortOrder - b.sortOrder);
}
export const settingsRepository = {
  saveChannelsWithAudit(channels: readonly Channel[], actorId: string) {
    return db.transaction((tx) => {
      tx.delete(contactChannels).run();
      if (channels.length) tx.insert(contactChannels).values(channels.map((channel) => ({ id: crypto.randomUUID(), ...channel }))).run();
      tx.insert(auditLogs).values({ id: crypto.randomUUID(), actorId, action: "settings.channels.update", entityType: "settings", entityId: "contact-channels", detail: JSON.stringify({ count: channels.length }), createdAt: new Date() }).run();
      return orderEnabledChannels(channels);
    });
  },
};
```

- [ ] **Step 4: Implement permission-guarded settings routes**

```ts
// backend/src/admin/routes/settings.ts
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { requirePermission } from "@/auth/permission-middleware";
import { settingsRepository } from "@/admin/repositories/settings-repository";

const channelSchema = z.object({
  kind: z.enum(["whatsapp", "wechat", "telegram", "phone", "email"]),
  label: z.string().min(1).max(80), value: z.string().min(1), enabled: z.boolean(), sortOrder: z.number().int(),
});

const saveRoute = createRoute({ method: "put", path: "/contact-channels", request: { body: { content: { "application/json": { schema: z.object({ channels: z.array(channelSchema) }).openapi("SaveContactChannelsInput") } } } }, responses: { 200: { description: "Saved channels", content: { "application/json": { schema: z.object({ data: z.array(channelSchema), error: z.null(), requestId: z.string() }) } } } } });
export const settingsRoutes = new OpenAPIHono()
  .use("/contact-channels", requirePermission("settings.manage"))
  .openapi(saveRoute, async (context) => {
    const actor = context.get("actor");
    const channels = await settingsRepository.saveChannelsWithAudit(context.req.valid("json").channels, actor.user.id);
    return context.json({ data: channels, error: null, requestId: context.get("requestId") }, 200);
  });
```

Add `GET /api/admin/settings`, `PUT /api/admin/settings`, `GET /api/admin/contact-channels`, and the route above with named OpenAPI schemas. Site settings are an explicit allowlisted object for company identity, public contacts, privacy controller, SMTP recipient metadata, locale defaults, media mode, and feature flags; secrets remain environment-only. Mount the route group in `backend/src/app.ts` and regenerate the contract.

- [ ] **Step 5: Verify and commit**

Run:

```bash
pnpm --filter @anshow/backend test -- src/admin/repositories/settings-repository.test.ts src/admin/routes/settings.test.ts
pnpm --filter @anshow/backend db:generate
pnpm --filter @anshow/backend typecheck
pnpm openapi:generate
```

Expected: test, migration generation, and typecheck pass.

```bash
git add backend/src/db/schema backend/src/admin backend/src/app.ts backend/migrations openapi/anshow.json frontend/src/generated/api.ts
git commit -m "Keep public contact and configuration changes traceable" \
  -m "Constraint: Staff must configure channels without editing code and every change needs an actor" \
  -m "Confidence: high" -m "Scope-risk: moderate" \
  -m "Tested: settings repository test, migration generation, and typecheck"
```

### Task 3: Build the Multilingual Content Editor and Publishing Rules

**Files:**
- Create: `backend/src/admin/content/content-schema.ts`
- Create: `backend/src/admin/content/content-schema.test.ts`
- Create: `backend/src/admin/repositories/content-repository.ts`
- Create: `backend/src/admin/routes/content.ts`
- Create: `backend/src/admin/routes/content.test.ts`
- Modify: `backend/src/app.ts`
- Create: `frontend/src/api/admin-content.ts`
- Create: `frontend/src/components/admin/content-editor.tsx`
- Create: `frontend/src/components/admin/locale-tabs.tsx`
- Create: `frontend/src/app/admin/(protected)/content/[collection]/page.tsx`
- Create: `frontend/src/app/admin/(protected)/content/[collection]/[id]/page.tsx`

- [ ] **Step 1: Write the failing translation-completeness test**

```ts
// backend/src/admin/content/content-schema.test.ts
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

Run: `pnpm --filter @anshow/backend test -- src/admin/content/content-schema.test.ts`

Expected: FAIL because the content validation module does not exist.

- [ ] **Step 3: Implement content validation**

```ts
// backend/src/admin/content/content-schema.ts
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
// backend/src/admin/repositories/content-repository.ts
import type { Locale } from "@/content/types";
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
// backend/src/admin/routes/content.ts
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { requirePermission } from "@/auth/permission-middleware";
import { contentRepository } from "@/admin/repositories";
import { translationSchema } from "@/admin/content/content-schema";

const params = z.object({ collection: z.enum(["pages", "hero-slides", "services", "trade-lanes", "cargo-types", "case-studies", "articles", "partners", "certificates", "proof-metrics", "navigation-items"]), id: z.string().uuid(), locale: z.enum(["en", "zh", "ru"]) });
const publishRoute = createRoute({ method: "post", path: "/{collection}/{id}/translations/{locale}/publish", request: { params, body: { content: { "application/json": { schema: translationSchema.openapi("PublishTranslationInput") } } } }, responses: { 200: { description: "Published", content: { "application/json": { schema: z.object({ data: z.object({ status: z.literal("published") }), error: z.null(), requestId: z.string() }) } } } } });

export const contentRoutes = new OpenAPIHono()
  .use("/*", requirePermission("content.read"))
  .use("/:collection/:id/translations/:locale/publish", requirePermission("content.publish"))
  .openapi(publishRoute, async (context) => {
    const input = context.req.valid("param");
    await contentRepository.publishLocale(input.collection, input.id, input.locale, context.req.valid("json"), context.get("actor").user.id);
    return context.json({ data: { status: "published" as const }, error: null, requestId: context.get("requestId") }, 200);
  });
```

Add list/detail/create/update/archive/schedule routes under `/api/admin/content/*`; apply `content.read`, `content.write`, or `content.publish` per route. Test that an editor cannot publish, that invalid proof records return `409 PROOF_NOT_VERIFIED`, and that a Russian translation can publish without publishing English or Chinese. Mount the routes and regenerate OpenAPI. Public reads use `cache: "no-store"`, so successful backend writes are visible without importing Next.js cache APIs into the backend.

- [ ] **Step 5: Build the editor UI**

```tsx
// frontend/src/components/admin/content-editor.tsx
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

`frontend/src/api/admin-content.ts` derives request and response types from `frontend/src/generated/api.ts`: server reads use `BACKEND_INTERNAL_URL` with forwarded cookies and browser writes use same-origin `/api/admin/content/*`. The editor pages pass these client functions into `ContentEditor`; no frontend file imports a backend repository or schema. Add a schedule datetime control and preview link beside the publish command. API validation errors map to inline field errors; on failure, focus the first `[aria-invalid=true]` field. All inputs use visible labels and a minimum control height of `44px`.

- [ ] **Step 6: Verify and commit**

Run:

```bash
pnpm --filter @anshow/backend test -- src/admin/content/content-schema.test.ts src/admin/routes/content.test.ts
pnpm --filter @anshow/backend typecheck
pnpm openapi:generate
pnpm --filter @anshow/frontend build
```

Expected: validation test and build pass.

```bash
git add backend/src/admin/content backend/src/admin/repositories/content-repository.ts backend/src/admin/routes/content* backend/src/app.ts openapi/anshow.json frontend/src/generated/api.ts frontend/src/api/admin-content.ts frontend/src/components/admin 'frontend/src/app/admin/(protected)/content'
git commit -m "Let staff publish each language without mixing incomplete content" \
  -m "Constraint: English, Chinese, and Russian publish independently with required SEO and alt text" \
  -m "Confidence: high" -m "Scope-risk: broad" \
  -m "Tested: translation validation test and production build"
```

### Task 4: Add the Media Library and Safe Derivative Workflow

**Files:**
- Create: `backend/src/media/storage.ts`
- Create: `backend/src/media/local-storage.ts`
- Create: `backend/src/media/media-service.ts`
- Create: `backend/src/media/media-service.test.ts`
- Create: `backend/src/admin/routes/media.ts`
- Create: `backend/src/admin/routes/media.test.ts`
- Modify: `backend/src/app.ts`
- Create: `frontend/src/api/admin-media.ts`
- Create: `frontend/src/components/admin/media-library.tsx`
- Create: `frontend/src/app/admin/(protected)/media/page.tsx`
- Modify: `compose.yaml`
- Modify: `Caddyfile`

- [ ] **Step 1: Write the failing unsafe-upload test**

```ts
// backend/src/media/media-service.test.ts
import { expect, it } from "vitest";
import { validateUpload } from "./media-service";

it("rejects executable content with an image extension", async () => {
  await expect(validateUpload({ name: "photo.jpg", type: "image/jpeg", bytes: Buffer.from("MZ") }))
    .rejects.toThrow("signature");
});
```

- [ ] **Step 2: Run test and confirm failure**

Run: `pnpm --filter @anshow/backend test -- src/media/media-service.test.ts`

Expected: FAIL because media validation does not exist.

- [ ] **Step 3: Implement storage and validation contracts**

```ts
// backend/src/media/storage.ts
export interface MediaStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<{ url: string }>;
  delete(key: string): Promise<void>;
}
```

```ts
// backend/src/media/local-storage.ts
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
handle /api/* { reverse_proxy backend:4000 }
handle { reverse_proxy frontend:3000 }
```

```ts
// backend/src/media/media-service.ts
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
// frontend/src/components/admin/media-library.tsx
"use client";
type MediaLibraryProps = { assets: readonly { id: string; thumbnailUrl: string; alt: Record<"en" | "zh" | "ru", string>; references: readonly string[] }[]; remove(id: string): Promise<void>; replace(id: string): Promise<void> };
export function MediaLibrary({ assets, remove, replace }: MediaLibraryProps) {
  return <section><div role="toolbar"><input type="search" aria-label="Search media" /><button type="button">Grid view</button><button type="button">List view</button></div>
    <ul>{assets.map((asset) => <li key={asset.id}><img src={asset.thumbnailUrl} alt="" /><label>English alt text<input value={asset.alt.en} readOnly /></label><p>{asset.references.length} references</p><button onClick={() => replace(asset.id)} type="button">Replace</button><button disabled={asset.references.length > 0} onClick={() => remove(asset.id)} type="button">Delete</button></li>)}</ul>
  </section>;
}
```

```ts
// backend/src/admin/routes/media.ts
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { requirePermission } from "@/auth/permission-middleware";
import { mediaRepository, mediaService } from "@/media/wiring";

const deleteRoute = createRoute({ method: "delete", path: "/{id}", request: { params: z.object({ id: z.string().uuid() }) }, responses: { 200: { description: "Deleted", content: { "application/json": { schema: z.object({ data: z.object({ deleted: z.literal(true) }), error: z.null(), requestId: z.string() }) } } }, 409: { description: "Still referenced", content: { "application/json": { schema: z.object({ data: z.null(), error: z.object({ code: z.literal("MEDIA_IN_USE"), message: z.string(), references: z.array(z.string()) }), requestId: z.string() }) } } } } });
export const mediaRoutes = new OpenAPIHono()
  .use("/:id", requirePermission("media.write"))
  .openapi(deleteRoute, async (context) => {
    const { id } = context.req.valid("param");
    const references = await mediaRepository.references(id);
    if (references.length) return context.json({ data: null, error: { code: "MEDIA_IN_USE" as const, message: "Media is still in use", references }, requestId: context.get("requestId") }, 409);
    await mediaService.deleteWithAudit(id, context.get("actor").user.id);
    return context.json({ data: { deleted: true as const }, error: null, requestId: context.get("requestId") }, 200);
  });
```

Add `GET /api/admin/media`, `POST /api/admin/media`, `PUT /api/admin/media/:id`, and the delete route. Protect listing with `media.read` and every upload/replace/delete mutation with `media.write`. Upload and replacement accept multipart data in Hono, call `mediaService.processUpload`, stream progress through explicit UI states, preserve the media ID on replacement, and regenerate derivatives. Store focal coordinates and EN/ZH/RU alt text with the media record. `frontend/src/api/admin-media.ts` uses generated response types and same-origin browser requests; local storage is written only by the backend and mounted read-only into Caddy.

- [ ] **Step 5: Verify and commit**

Run:

```bash
pnpm --filter @anshow/backend test -- src/media/media-service.test.ts src/admin/routes/media.test.ts
pnpm --filter @anshow/backend typecheck
pnpm openapi:generate
pnpm --filter @anshow/frontend build
docker compose config
```

Expected: unsafe upload test and build pass.

```bash
git add backend/src/media backend/src/admin/routes/media* backend/src/app.ts compose.yaml Caddyfile openapi/anshow.json frontend/src/generated/api.ts frontend/src/api/admin-media.ts frontend/src/components/admin/media-library.tsx 'frontend/src/app/admin/(protected)/media'
git commit -m "Keep uploaded media optimized and non-executable" \
  -m "Constraint: Staff uploads must not bypass image budgets or create unsafe public files" \
  -m "Confidence: high" -m "Scope-risk: broad" \
  -m "Tested: upload validation test and production build"
```

### Task 5: Implement Staff Accounts, Custom Roles, and Forced Session Invalidation

**Files:**
- Create: `backend/src/admin/repositories/staff-repository.ts`
- Create: `backend/src/admin/repositories/staff-repository.test.ts`
- Create: `backend/src/admin/routes/staff.ts`
- Create: `backend/src/admin/routes/staff.test.ts`
- Modify: `backend/src/auth/server.ts`
- Modify: `backend/src/app.ts`
- Create: `frontend/src/api/admin-staff.ts`
- Create: `frontend/src/components/admin/staff-form.tsx`
- Create: `frontend/src/components/admin/role-matrix.tsx`
- Create: `frontend/src/app/admin/(protected)/staff/page.tsx`
- Create: `frontend/src/app/admin/(protected)/staff/[id]/page.tsx`

- [ ] **Step 1: Write the failing session-revocation test**

```ts
// backend/src/admin/repositories/staff-repository.test.ts
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

Run: `pnpm --filter @anshow/backend test -- src/admin/repositories/staff-repository.test.ts`

Expected: FAIL because staff repository does not exist.

- [ ] **Step 3: Implement staff lifecycle transactions**

```ts
// backend/src/admin/repositories/staff-repository.ts
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
// frontend/src/components/admin/role-matrix.tsx
import type { PermissionKey } from "@/auth/permissions";
export function RoleMatrix({ all, granted }: { all: readonly PermissionKey[]; granted: readonly PermissionKey[] }) {
  return <fieldset><legend>Permissions</legend>{all.map((permission) => <label key={permission}><input type="checkbox" name="permissions" value={permission} defaultChecked={granted.includes(permission)} />{permission}</label>)}</fieldset>;
}
```

```ts
// backend/src/admin/routes/staff.ts
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { requirePermission } from "@/auth/permission-middleware";
import { staffRepository } from "@/admin/repositories";

const disableRoute = createRoute({ method: "post", path: "/{id}/disable", request: { params: z.object({ id: z.string() }) }, responses: { 200: { description: "Disabled", content: { "application/json": { schema: z.object({ data: z.object({ disabled: z.literal(true) }), error: z.null(), requestId: z.string() }) } } }, 409: { description: "Final super administrator", content: { "application/json": { schema: z.object({ data: z.null(), error: z.object({ code: z.literal("LAST_SUPER_ADMIN"), message: z.string() }), requestId: z.string() }) } } } } });
export const staffRoutes = new OpenAPIHono()
  .use("/*", requirePermission("staff.manage"))
  .openapi(disableRoute, async (context) => {
    const { id } = context.req.valid("param");
    if (await staffRepository.isLastEnabledSuperAdmin(id)) return context.json({ data: null, error: { code: "LAST_SUPER_ADMIN" as const, message: "The final Super Administrator cannot be disabled" }, requestId: context.get("requestId") }, 409);
    await staffRepository.disable(id, context.get("actor").user.id);
    return context.json({ data: { disabled: true as const }, error: null, requestId: context.get("requestId") }, 200);
  });
```

Enable Better Auth's server-side admin plugin in `backend/src/auth/server.ts` and call its backend API only from the Hono staff service for account creation, password resets, and session revocation. Custom AnShow roles and permissions remain in the Drizzle RBAC tables; the service performs the Better Auth identity change, RBAC change, session revocation, and audit write in a defined failure order with compensation for a newly created user if RBAC assignment fails. Add list/detail/create/enable/disable/password-reset/role routes and test that each requires `staff.manage` and that the last enabled Super Administrator cannot be disabled or demoted.

`frontend/src/api/admin-staff.ts` derives types from OpenAPI and exposes cookie-forwarding server reads plus same-origin mutations. The staff forms include email, display name, enabled state, password visibility control, role presets, the custom permission matrix, an explicit destructive confirmation dialog, and the account audit summary.

- [ ] **Step 5: Verify and commit**

Run:

```bash
pnpm --filter @anshow/backend test -- src/admin/repositories/staff-repository.test.ts src/admin/routes/staff.test.ts
pnpm --filter @anshow/backend typecheck
pnpm openapi:generate
pnpm --filter @anshow/frontend build
```

Expected: session-revocation test and build pass.

```bash
git add backend/src/admin/repositories/staff-repository* backend/src/admin/routes/staff* backend/src/auth/server.ts backend/src/app.ts openapi/anshow.json frontend/src/generated/api.ts frontend/src/api/admin-staff.ts frontend/src/components/admin/staff-form.tsx frontend/src/components/admin/role-matrix.tsx 'frontend/src/app/admin/(protected)/staff'
git commit -m "Make staff authority explicit and immediately revocable" \
  -m "Constraint: Role and password changes must invalidate existing sessions" \
  -m "Confidence: high" -m "Scope-risk: broad" \
  -m "Directive: Never allow removal of the final enabled Super Administrator" \
  -m "Tested: session revocation test and production build"
```

### Task 6: Add Dashboard, Audit Log, First-Run Checklist, and Admin E2E

**Files:**
- Create: `frontend/src/app/admin/(protected)/audit/page.tsx`
- Create: `frontend/src/app/admin/(protected)/settings/page.tsx`
- Create: `frontend/src/components/admin/first-run-checklist.tsx`
- Create: `backend/src/admin/dashboard.ts`
- Create: `backend/src/admin/routes/dashboard.ts`
- Create: `backend/src/admin/routes/audit.ts`
- Modify: `backend/src/app.ts`
- Create: `frontend/src/api/admin-dashboard.ts`
- Create: `frontend/src/api/admin-audit.ts`
- Create: `frontend/src/api/admin-settings.ts`
- Create: `frontend/tests/e2e/admin.spec.ts`

- [ ] **Step 1: Write failing admin E2E coverage**

```ts
// frontend/tests/e2e/admin.spec.ts
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
// frontend/tests/e2e/helpers/auth.ts
import type { Page } from "@playwright/test";
export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/admin");
}
```

Import `loginAs` from `./helpers/auth` in `frontend/tests/e2e/admin.spec.ts`.

- [ ] **Step 2: Run E2E and confirm failure**

Run: `pnpm --filter @anshow/frontend test:e2e -- tests/e2e/admin.spec.ts`

Expected: FAIL because dashboard and complete admin routes are absent.

- [ ] **Step 3: Implement dashboard and first-run checklist**

```ts
// backend/src/admin/dashboard.ts
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
// frontend/src/components/admin/first-run-checklist.tsx
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

```ts
// backend/src/admin/routes/dashboard.ts
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { requirePermission } from "@/auth/permission-middleware";
import { dashboardRepository } from "@/admin/repositories";
import { getDashboard } from "@/admin/dashboard";

const DashboardData = z.object({ newEnquiries: z.number().int(), openLeads: z.number().int(), translationGaps: z.number().int(), publishedItems: z.number().int(), scheduledItems: z.number().int(), unassignedEnquiries: z.number().int(), recentAudit: z.array(z.object({ id: z.string(), action: z.string(), createdAt: z.string() })), checklist: z.object({ legalName: z.boolean(), publicContact: z.boolean(), privacyController: z.boolean(), contactChannel: z.boolean() }) }).openapi("AdminDashboardData");
const route = createRoute({ method: "get", path: "/", responses: { 200: { description: "Dashboard", content: { "application/json": { schema: z.object({ data: DashboardData, error: z.null(), requestId: z.string() }) } } } } });
export const dashboardRoutes = new OpenAPIHono()
  .use("/", requirePermission("content.read"))
  .openapi(route, async (context) => context.json({ data: await getDashboard(dashboardRepository), error: null, requestId: context.get("requestId") }, 200));
```

Mount this group at `/api/admin/dashboard`. The repository adds the first-run checklist to the returned dashboard result; the frontend dashboard page loads it through `frontend/src/api/admin-dashboard.ts` and forwards the session cookie during SSR.

- [ ] **Step 4: Implement audit list and filters**

```tsx
// frontend/src/app/admin/(protected)/audit/page.tsx
import { getAuditRows } from "@/api/admin-audit";
export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const filters = await searchParams;
  const result = await getAuditRows(filters);
  return <main><h1>Audit log</h1><AuditFilters value={filters} /><table><tbody>{result.items.map((row) => <tr key={row.id}><td>{row.actorEmail}</td><td>{row.action}</td><td>{row.entityType}</td><td><dl>{Object.entries(row.detail).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl></td></tr>)}</tbody></table><Pagination cursor={result.nextCursor} /></main>;
}
```

`backend/src/admin/routes/audit.ts` validates actor, action, entity type, from/to dates, and cursor, applies `audit.read`, and returns at most 50 rows ordered by `(createdAt, id)` descending. `frontend/src/api/admin-audit.ts` uses its generated response type; the page never imports the backend filter schema or repository. The settings page follows the same server-read/browser-write split through `frontend/src/api/admin-settings.ts`.

```ts
// backend/src/admin/routes/audit.ts excerpt
const auditListRoute = createRoute({ method: "get", path: "/", request: { query: auditFilterSchema }, responses: { 200: { description: "Audit records", content: { "application/json": { schema: AuditListEnvelope } } } } });
export const auditRoutes = new OpenAPIHono()
  .use("/", requirePermission("audit.read"))
  .openapi(auditListRoute, async (context) => context.json({ data: await auditRepository.list(context.req.valid("query")), error: null, requestId: context.get("requestId") }, 200));
```

- [ ] **Step 5: Verify admin completion**

Run:

```bash
pnpm --filter @anshow/backend test
pnpm --filter @anshow/frontend test
pnpm openapi:generate
pnpm --filter @anshow/backend typecheck
pnpm --filter @anshow/frontend build
pnpm --filter @anshow/frontend test:e2e -- tests/e2e/admin.spec.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/admin backend/src/app.ts openapi/anshow.json frontend/src/generated/api.ts frontend/src/api frontend/src/app/admin frontend/src/components/admin frontend/tests/e2e
git commit -m "Give staff a complete and auditable publishing workspace" \
  -m "Constraint: The site cannot show fabricated proof while company facts remain unconfigured" \
  -m "Confidence: high" -m "Scope-risk: broad" \
  -m "Tested: unit suite, production build, and admin Playwright flows"
```

## Administration Completion Gate

Run:

```bash
pnpm -r test
pnpm -r lint
pnpm -r typecheck
pnpm -r build
pnpm --filter @anshow/frontend test:e2e -- tests/e2e/admin.spec.ts
```

Expected: authorized staff can manage all specified collections and translations, publish per locale, process media, configure channels, manage accounts/roles, and inspect audits. Unauthorized users receive no route or action access.
