# AnShow Enquiries, Security, and Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the short enquiry workflow, reliable email outbox, lead administration, abuse controls, Tencent COS media mode, encrypted backups, restore verification, and production quality gate.

**Architecture:** Hono owns enquiry validation, abuse controls, transactional SQLite persistence, administration routes, and OpenAPI schemas. The Next.js frontend submits to same-origin `/api/public/inquiries` in the browser and uses the generated contract for administration data; it never imports backend repositories or database types. A separate backend-image worker claims outbox and scheduled jobs, while COS and backup adapters isolate external operations from domain logic.

**Tech Stack:** Next.js, React, Hono, `@hono/zod-openapi`, TypeScript, Drizzle, SQLite WAL, Zod, Nodemailer SMTP, Tencent COS SDK, Sharp, Docker Compose, Playwright, axe

---

## Execution Order and File Map

Run after the foundation and admin plans. The public plan can proceed in parallel after foundation, but its enquiry section is completed here.

- `backend/src/db/schema/inquiries.ts`: leads, notes, history, deliveries, and rate limits.
- `backend/src/inquiries/*`: validation, repository, public Hono route, and email template.
- `backend/src/worker/*`: outbox claim/retry and scheduled work.
- `frontend/src/app/admin/(protected)/inquiries/*`: lead workspace.
- `backend/src/security/*`: rate limits, origin checks, and headers.
- `backend/src/media/cos-storage.ts`: Tencent COS adapter.
- `backend/src/backup/*`: consistent backup, scheduler, and restore verification.
- `docs/deployment/*`: Tencent Cloud operations runbook.

### Task 1: Add Enquiry Tables, Validation, and State Machine

**Files:**
- Create: `backend/src/db/schema/inquiries.ts`
- Modify: `backend/src/db/schema/index.ts`
- Create: `backend/src/inquiries/schema.ts`
- Create: `backend/src/inquiries/schema.test.ts`
- Create: `backend/src/inquiries/state-machine.ts`
- Create: `backend/src/inquiries/state-machine.test.ts`

- [ ] **Step 1: Write failing validation and transition tests**

```ts
// backend/src/inquiries/schema.test.ts
import { expect, it } from "vitest";
import { enquirySchema } from "./schema";

it("requires either email or phone", () => {
  expect(enquirySchema.safeParse({
    name: "Elena", company: "Volga", email: "", phone: "",
    transportNeed: "Rail freight", message: "China to Russia", consent: true,
    privacyVersion: "2026-07", locale: "en", startedAt: Date.now() - 3_000,
  }).success).toBe(false);
});
```

```ts
// backend/src/inquiries/state-machine.test.ts
import { expect, it } from "vitest";
import { canTransition } from "./state-machine";

it("does not reopen spam directly as qualified", () => {
  expect(canTransition("spam", "qualified")).toBe(false);
  expect(canTransition("new", "contacted")).toBe(true);
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm --filter @anshow/backend test -- src/inquiries/schema.test.ts src/inquiries/state-machine.test.ts`

Expected: FAIL because enquiry modules do not exist.

- [ ] **Step 3: Define the enquiry schema**

```ts
// backend/src/inquiries/schema.ts
import { z } from "@hono/zod-openapi";

export const enquirySchema = z.object({
  name: z.string().trim().min(2).max(100),
  company: z.string().trim().min(1).max(160),
  email: z.string().trim().email().or(z.literal("")),
  phone: z.string().trim().max(50),
  transportNeed: z.string().trim().min(2).max(200),
  message: z.string().trim().min(10).max(3000),
  consent: z.literal(true),
  privacyVersion: z.string().trim().min(1).max(40),
  locale: z.enum(["en", "zh", "ru"]),
  website: z.string().max(0).default(""),
  startedAt: z.number().int().positive(),
}).superRefine((value, ctx) => {
  if (!value.email && !value.phone) ctx.addIssue({ code: "custom", path: ["email"], message: "Email or phone is required" });
});
export type ValidInquiry = z.infer<typeof enquirySchema>;
```

- [ ] **Step 4: Implement the state machine**

```ts
// backend/src/inquiries/state-machine.ts
export type InquiryStatus = "new" | "contacted" | "qualified" | "closed" | "spam";
const transitions: Record<InquiryStatus, readonly InquiryStatus[]> = {
  new: ["contacted", "qualified", "closed", "spam"],
  contacted: ["qualified", "closed", "spam"],
  qualified: ["contacted", "closed", "spam"],
  closed: ["contacted"],
  spam: ["new"],
};
export function canTransition(from: InquiryStatus, to: InquiryStatus) { return transitions[from].includes(to); }
```

- [ ] **Step 5: Add relational tables**

```ts
// backend/src/db/schema/inquiries.ts
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const inquiries = sqliteTable("inquiries", {
  id: text("id").primaryKey(), name: text("name").notNull(), company: text("company").notNull(),
  email: text("email").notNull(), phone: text("phone").notNull(), transportNeed: text("transport_need").notNull(),
  message: text("message").notNull(), locale: text("locale").notNull(), sourceUrl: text("source_url").notNull(),
  referrer: text("referrer"), utmSource: text("utm_source"), utmMedium: text("utm_medium"), utmCampaign: text("utm_campaign"),
  privacyVersion: text("privacy_version").notNull(), consentedAt: integer("consented_at", { mode: "timestamp" }).notNull(),
  assigneeId: text("assignee_id"), status: text("status").notNull(), createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [index("inquiries_status_idx").on(table.status), index("inquiries_assignee_idx").on(table.assigneeId), index("inquiries_created_idx").on(table.createdAt)]);
export const inquiryNotes = sqliteTable("inquiry_notes", { id: text("id").primaryKey(), inquiryId: text("inquiry_id").notNull(), authorId: text("author_id").notNull(), body: text("body").notNull(), createdAt: integer("created_at", { mode: "timestamp" }).notNull() });
export const inquiryHistory = sqliteTable("inquiry_history", { id: text("id").primaryKey(), inquiryId: text("inquiry_id").notNull(), actorId: text("actor_id"), assigneeId: text("assignee_id"), fromStatus: text("from_status"), toStatus: text("to_status").notNull(), createdAt: integer("created_at", { mode: "timestamp" }).notNull() });
export const notificationDeliveries = sqliteTable("notification_deliveries", { id: text("id").primaryKey(), inquiryId: text("inquiry_id").notNull(), status: text("status").notNull(), attempts: integer("attempts").notNull(), nextAttemptAt: integer("next_attempt_at", { mode: "timestamp" }).notNull(), workerId: text("worker_id"), claimedAt: integer("claimed_at", { mode: "timestamp" }), sentAt: integer("sent_at", { mode: "timestamp" }), lastError: text("last_error"), idempotencyKey: text("idempotency_key").notNull().unique() }, (table) => [index("notification_due_idx").on(table.status, table.nextAttemptAt)]);
export const rateLimits = sqliteTable("rate_limits", { key: text("key").primaryKey(), count: integer("count").notNull(), expiresAt: integer("expires_at", { mode: "timestamp" }).notNull() });
```

- [ ] **Step 6: Verify and commit**

Run:

```bash
pnpm --filter @anshow/backend test -- src/inquiries/schema.test.ts src/inquiries/state-machine.test.ts
pnpm --filter @anshow/backend db:generate
pnpm --filter @anshow/backend typecheck
```

Expected: tests, migration generation, and typecheck pass.

```bash
git add backend/src/inquiries backend/src/db/schema backend/migrations
git commit -m "Give every enquiry a valid and traceable lifecycle" \
  -m "Constraint: A short public form still needs deterministic validation and status history" \
  -m "Confidence: high" -m "Scope-risk: moderate" \
  -m "Tested: validation and state-machine tests, migration generation, and typecheck"
```

### Task 2: Persist Enquiries and Outbox Jobs Atomically

**Files:**
- Create: `backend/src/inquiries/repository.ts`
- Create: `backend/src/inquiries/repository.test.ts`
- Create: `backend/src/inquiries/test-fixture.ts`
- Create: `backend/src/inquiries/route.ts`
- Create: `backend/src/inquiries/route.test.ts`
- Modify: `backend/src/app.ts`
- Create: `frontend/src/components/forms/enquiry-form.tsx`
- Create: `frontend/src/components/forms/enquiry-form.test.tsx`
- Modify: `frontend/src/app/[locale]/page.tsx`
- Modify: `frontend/src/app/[locale]/contact/page.tsx`

- [ ] **Step 1: Write the failing transaction test**

```ts
// backend/src/inquiries/repository.test.ts
import { expect, it } from "vitest";
import { createInquiryFixture } from "./test-fixture";

it("creates one lead and one email job in one transaction", async () => {
  const fixture = createInquiryFixture();
  const result = await fixture.repository.createWithNotification(fixture.validInput);
  expect(await fixture.count("inquiries")).toBe(1);
  expect(await fixture.count("notification_deliveries")).toBe(1);
  expect(result.status).toBe("new");
});
```

```ts
// backend/src/inquiries/test-fixture.ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { AppDatabase } from "@/db/client";
import * as schema from "@/db/schema";
import { createInquiryRepository, type NewInquiryInput } from "./repository";
type InquiryStatus = "new" | "contacted" | "qualified" | "closed" | "spam";
type HistoryInput = { inquiryId: string; actorId: string; assigneeId?: string; fromStatus?: InquiryStatus; toStatus: InquiryStatus };
interface FixtureAdminPort {
  transaction<T>(work: (tx: FixtureAdminPort) => Promise<T>): Promise<T>; get(id: string): Promise<{ id: string; status: InquiryStatus } | null>;
  updateAssignmentAndStatus(id: string, assigneeId: string, status: InquiryStatus): Promise<void>; insertHistory(row: HistoryInput): Promise<void>;
  insertNote(row: { inquiryId: string; actorId: string; body: string }): Promise<void>; retryDelivery(inquiryId: string): Promise<void>;
  audit(actorId: string, action: string, entityId: string, detail: unknown): Promise<void>;
}
export function createInquiryFixture() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`CREATE TABLE inquiries (id TEXT PRIMARY KEY,name TEXT NOT NULL,company TEXT NOT NULL,email TEXT NOT NULL,phone TEXT NOT NULL,transport_need TEXT NOT NULL,message TEXT NOT NULL,locale TEXT NOT NULL,source_url TEXT NOT NULL,referrer TEXT,utm_source TEXT,utm_medium TEXT,utm_campaign TEXT,privacy_version TEXT NOT NULL,consented_at INTEGER NOT NULL,assignee_id TEXT,status TEXT NOT NULL,created_at INTEGER NOT NULL); CREATE TABLE inquiry_history (id TEXT PRIMARY KEY,inquiry_id TEXT NOT NULL,actor_id TEXT,assignee_id TEXT,from_status TEXT,to_status TEXT NOT NULL,created_at INTEGER NOT NULL); CREATE TABLE inquiry_notes (id TEXT PRIMARY KEY,inquiry_id TEXT NOT NULL,author_id TEXT NOT NULL,body TEXT NOT NULL,created_at INTEGER NOT NULL); CREATE TABLE notification_deliveries (id TEXT PRIMARY KEY,inquiry_id TEXT NOT NULL,status TEXT NOT NULL,attempts INTEGER NOT NULL,next_attempt_at INTEGER NOT NULL,worker_id TEXT,claimed_at INTEGER,sent_at INTEGER,last_error TEXT,idempotency_key TEXT NOT NULL UNIQUE);`);
  const db = drizzle(sqlite, { schema }) as AppDatabase;
  const repository = createInquiryRepository(db);
  const validInput: NewInquiryInput = { name: "Elena", company: "Volga", email: "elena@example.test", phone: "", transportNeed: "Rail", message: "China to Russia freight request", consent: true, privacyVersion: "2026-07", locale: "en", sourceUrl: "/en" };
  const adminPort: FixtureAdminPort = {
    async transaction<T>(work: (tx: FixtureAdminPort) => Promise<T>) { return work(adminPort); },
    async get(id: string) { return sqlite.prepare("SELECT id,status FROM inquiries WHERE id=?").get(id) as { id: string; status: InquiryStatus } | undefined ?? null; },
    async updateAssignmentAndStatus(id: string, assigneeId: string, status: InquiryStatus) { sqlite.prepare("UPDATE inquiries SET assignee_id=?,status=? WHERE id=?").run(assigneeId, status, id); },
    async insertHistory(row: HistoryInput) { sqlite.prepare("INSERT INTO inquiry_history (id,inquiry_id,actor_id,assignee_id,from_status,to_status,created_at) VALUES (?,?,?,?,?,?,?)").run(crypto.randomUUID(), row.inquiryId, row.actorId, row.assigneeId ?? null, row.fromStatus ?? null, row.toStatus, Date.now()); },
    async insertNote(row: { inquiryId: string; actorId: string; body: string }) { sqlite.prepare("INSERT INTO inquiry_notes VALUES (?,?,?,?,?)").run(crypto.randomUUID(), row.inquiryId, row.actorId, row.body, Date.now()); },
    async retryDelivery(inquiryId: string) { sqlite.prepare("UPDATE notification_deliveries SET status='pending',attempts=0 WHERE inquiry_id=?").run(inquiryId); },
    async audit() {},
  };
  return { repository, adminPort, validInput, count: async (table: "inquiries" | "notification_deliveries") => (sqlite.prepare(`SELECT count(*) AS count FROM ${table}`).get() as { count: number }).count, createLead: () => repository.createWithNotification(validInput), history: async (id: string) => sqlite.prepare("SELECT inquiry_id AS inquiryId,assignee_id AS assigneeId,to_status AS toStatus FROM inquiry_history WHERE inquiry_id=?").all(id) };
}
```

- [ ] **Step 2: Run test and confirm failure**

Run: `pnpm --filter @anshow/backend test -- src/inquiries/repository.test.ts`

Expected: FAIL because repository does not exist.

- [ ] **Step 3: Implement the transaction**

```ts
// backend/src/inquiries/repository.ts
import type { AppDatabase } from "@/db/client";
import { inquiries, inquiryHistory, notificationDeliveries } from "@/db/schema/inquiries";
import type { ValidInquiry } from "./schema";
export type NewInquiryInput = Omit<ValidInquiry, "website" | "startedAt"> & { sourceUrl: string; referrer?: string | null; utmSource?: string | null; utmMedium?: string | null; utmCampaign?: string | null };
export function createInquiryRepository(db: AppDatabase) {
  return {
    createWithNotification(input: NewInquiryInput) {
      return db.transaction((tx) => {
        const id = crypto.randomUUID();
        const now = new Date();
        const inquiry = tx.insert(inquiries).values({ id, name: input.name, company: input.company, email: input.email, phone: input.phone, transportNeed: input.transportNeed, message: input.message, locale: input.locale, sourceUrl: input.sourceUrl, referrer: input.referrer, utmSource: input.utmSource, utmMedium: input.utmMedium, utmCampaign: input.utmCampaign, privacyVersion: input.privacyVersion, consentedAt: now, status: "new", createdAt: now }).returning().get();
        tx.insert(notificationDeliveries).values({
          id: crypto.randomUUID(), inquiryId: id, status: "pending", attempts: 0,
          nextAttemptAt: new Date(), idempotencyKey: `inquiry:${id}:sales`,
        }).run();
        tx.insert(inquiryHistory).values({ id: crypto.randomUUID(), inquiryId: id, toStatus: "new", createdAt: new Date() }).run();
        return inquiry;
      });
    },
  };
}
```

- [ ] **Step 4: Expose a typed public Hono endpoint**

```ts
// backend/src/inquiries/route.ts
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { createHmac } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { enquirySchema } from "./schema";
import { createInquiryRepository } from "./repository";
import { db } from "@/db/client";
import { rateLimits } from "@/db/schema/inquiries";
import { env } from "@/env";

const PublicInquiryInput = enquirySchema.openapi("PublicInquiryInput");
const InquiryCreated = z.object({ id: z.string().uuid(), status: z.literal("new") }).openapi("InquiryCreated");
const ErrorEnvelope = z.object({ data: z.null(), error: z.object({ code: z.string(), message: z.string(), fieldErrors: z.record(z.string(), z.array(z.string())).optional() }), requestId: z.string() }).openapi("InquiryErrorEnvelope");
const SuccessEnvelope = z.object({ data: InquiryCreated, error: z.null(), requestId: z.string() }).openapi("InquirySuccessEnvelope");

async function consumeEnquiryRateLimit(rawKey: string, now = Date.now()) {
  const windowMs = 600_000; const bucket = Math.floor(now / windowMs); const digest = createHmac("sha256", env.RATE_LIMIT_SECRET).update(rawKey).digest("hex"); const key = `enquiry:${bucket}:${digest}`;
  await db.insert(rateLimits).values({ key, count: 1, expiresAt: new Date((bucket + 1) * windowMs) }).onConflictDoUpdate({ target: rateLimits.key, set: { count: sql`${rateLimits.count} + 1` } });
  const [row] = await db.select({ count: rateLimits.count }).from(rateLimits).where(eq(rateLimits.key, key)).limit(1); return Boolean(row && row.count <= 5);
}

const route = createRoute({
  method: "post", path: "/", request: { body: { content: { "application/json": { schema: PublicInquiryInput } } } },
  responses: {
    201: { description: "Persisted enquiry", content: { "application/json": { schema: SuccessEnvelope } } },
    400: { description: "Invalid submission", content: { "application/json": { schema: ErrorEnvelope } } },
    403: { description: "Invalid origin", content: { "application/json": { schema: ErrorEnvelope } } },
    429: { description: "Rate limited", content: { "application/json": { schema: ErrorEnvelope } } },
  },
});

export const inquiryRoute = new OpenAPIHono().openapi(route, async (context) => {
  const requestId = context.get("requestId");
  const origin = context.req.header("origin");
  if (!origin || new URL(origin).origin !== new URL(env.SITE_URL).origin) return context.json({ data: null, error: { code: "INVALID_ORIGIN", message: "Invalid request origin" }, requestId }, 403);
  const parsed = enquirySchema.safeParse(context.req.valid("json"));
  if (!parsed.success) return context.json({ data: null, error: { code: "VALIDATION_ERROR", message: "Please correct the highlighted fields", fieldErrors: parsed.error.flatten().fieldErrors }, requestId }, 400);
  if (Date.now() - parsed.data.startedAt < 1_500 || parsed.data.website) return context.json({ data: { id: crypto.randomUUID(), status: "new" as const }, error: null, requestId }, 201);
  if (!await consumeEnquiryRateLimit(context.req.header("x-forwarded-for") ?? "unknown")) return context.json({ data: null, error: { code: "RATE_LIMITED", message: "Too many enquiries. Please try again later." }, requestId }, 429);
  const inquiry = createInquiryRepository(db).createWithNotification({ ...parsed.data, sourceUrl: context.req.header("referer") ?? `/${parsed.data.locale}` });
  return context.json({ data: { id: inquiry.id, status: "new" as const }, error: null, requestId }, 201);
});
```

Mount `inquiryRoute` at `/api/public/inquiries` in `backend/src/app.ts`, regenerate `openapi/anshow.json`, and regenerate `frontend/src/generated/api.ts`. The route returns a normal-looking success for honeypot or impossibly fast submissions without writing a row, so automated abuse does not learn which signal fired.

```ts
// backend/src/inquiries/route.test.ts
import { expect, it } from "vitest";
import { createTestApp } from "@/test/app";

it("persists an accepted enquiry through the public API", async () => {
  const fixture = createTestApp();
  const response = await fixture.app.request("/api/public/inquiries", { method: "POST", headers: { "content-type": "application/json", origin: "https://anshow.test", "x-forwarded-for": "203.0.113.8" }, body: JSON.stringify({ name: "Elena", company: "Volga", email: "elena@example.test", phone: "", transportNeed: "Rail", message: "China to Russia freight request", consent: true, privacyVersion: "2026-07", locale: "en", website: "", startedAt: Date.now() - 3_000 }) });
  expect(response.status).toBe(201);
  expect(await fixture.count("inquiries")).toBe(1);
  expect(await fixture.count("notification_deliveries")).toBe(1);
});
```

- [ ] **Step 5: Implement the generated-contract browser form**

```tsx
// frontend/src/components/forms/enquiry-form.tsx
"use client";
import { useRef, useState } from "react";
import type { components } from "@/generated/api";
type Payload = components["schemas"]["PublicInquiryInput"];
type Labels = { name: string; company: string; email: string; phone: string; transportNeed: string; message: string; consent: string; submit: string; submitting: string; success: string; error: string };

export function EnquiryForm({ locale, privacyVersion, labels, request = fetch }: { locale: "en" | "zh" | "ru"; privacyVersion: string; labels: Labels; request?: typeof fetch }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; fieldErrors?: Record<string, string[]> } | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const startedAt = useRef(Date.now());
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setResult(null);
    const data = new FormData(event.currentTarget);
    const payload: Payload = { name: String(data.get("name")), company: String(data.get("company")), email: String(data.get("email")), phone: String(data.get("phone")), transportNeed: String(data.get("transportNeed")), message: String(data.get("message")), consent: data.get("consent") === "on", privacyVersion, locale, website: String(data.get("website")), startedAt: startedAt.current };
    const response = await request("/api/public/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    const next = response.ok ? { ok: true, message: labels.success } : { ok: false, message: body.error?.message ?? labels.error, fieldErrors: body.error?.fieldErrors };
    setResult(next); setPending(false);
    if (!next.ok) requestAnimationFrame(() => form.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
  }
  const invalid = (name: keyof Payload) => Boolean(result?.fieldErrors?.[name]);
  return <form ref={form} onSubmit={submit} noValidate><input className="sr-only" tabIndex={-1} autoComplete="off" name="website" />
    <label>{labels.name}<input name="name" required aria-invalid={invalid("name")} /></label><label>{labels.company}<input name="company" required aria-invalid={invalid("company")} /></label>
    <label>{labels.email}<input name="email" type="email" aria-invalid={invalid("email")} /></label><label>{labels.phone}<input name="phone" type="tel" aria-invalid={invalid("phone")} /></label>
    <label>{labels.transportNeed}<input name="transportNeed" required aria-invalid={invalid("transportNeed")} /></label><label>{labels.message}<textarea name="message" required aria-invalid={invalid("message")} /></label>
    <label><input name="consent" type="checkbox" required />{labels.consent}</label>
    {result && <p role={result.ok ? "status" : "alert"} aria-live="polite">{result.message}</p>}<button disabled={pending}>{pending ? labels.submitting : labels.submit}</button>
  </form>;
}
```

Add all labels and response messages to the EN/ZH/RU locale dictionaries, pass them from both pages, render an inline `<p id="field-error-*">` for each returned field error, and connect it with `aria-describedby`. Controls have a minimum height of `44px`; submission remains interruptible and uses no layout-shifting animation.

- [ ] **Step 6: Write and pass API and form feedback tests**

```tsx
// frontend/src/components/forms/enquiry-form.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { EnquiryForm } from "./enquiry-form";

it("prevents a second submit while pending", async () => {
  const request = vi.fn(() => new Promise<Response>(() => undefined));
  const labels = { name: "Name", company: "Company", email: "Email", phone: "Phone", transportNeed: "Transport requirement", message: "Message", consent: "I agree to the privacy notice", submit: "Submit enquiry", submitting: "Submitting", success: "Received", error: "Try again" };
  render(<EnquiryForm locale="en" privacyVersion="2026-07" labels={labels} request={request as typeof fetch} />);
  await userEvent.click(screen.getByRole("button", { name: "Submit enquiry" }));
  expect(screen.getByRole("button", { name: "Submitting" })).toBeDisabled();
});
```

Run:

```bash
pnpm --filter @anshow/backend test -- src/inquiries/repository.test.ts src/inquiries/route.test.ts
pnpm openapi:generate
pnpm --filter @anshow/frontend test -- src/components/forms/enquiry-form.test.tsx
```

Expected: backend persistence/route tests and frontend form test pass, and `git diff --exit-code openapi/anshow.json frontend/src/generated/api.ts` reports no generated-contract drift after regeneration.

- [ ] **Step 7: Commit**

```bash
git add backend/src/inquiries backend/src/app.ts openapi/anshow.json frontend/src/generated/api.ts frontend/src/components/forms 'frontend/src/app/[locale]'
git commit -m "Acknowledge enquiries only after they are safely stored" \
  -m "Constraint: Email failure must never lose or duplicate a lead" \
  -m "Confidence: high" -m "Scope-risk: broad" \
  -m "Tested: transaction and form feedback tests"
```

### Task 3: Implement the SMTP Worker, Retry Policy, and Localized Emails

**Files:**
- Create: `backend/src/worker/index.ts`
- Create: `backend/src/worker/outbox.ts`
- Create: `backend/src/worker/outbox-port.ts`
- Create: `backend/src/worker/mailer.ts`
- Create: `backend/src/worker/mailer-instance.ts`
- Create: `backend/src/worker/scheduled-content.ts`
- Create: `backend/src/worker/outbox.test.ts`
- Create: `backend/src/inquiries/email-template.ts`
- Create: `backend/src/inquiries/email-template.test.ts`
- Modify: `backend/package.json`
- Modify: `backend/Dockerfile`
- Modify: `compose.yaml`
- Modify: `backend/src/env.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write failing retry and template tests**

```ts
// backend/src/worker/outbox.test.ts
import { expect, it } from "vitest";
import { nextRetryAt } from "./outbox";

it("uses bounded exponential retry", () => {
  const base = new Date("2026-07-14T00:00:00Z");
  expect(nextRetryAt(base, 1).toISOString()).toBe("2026-07-14T00:01:00.000Z");
  expect(nextRetryAt(base, 3).toISOString()).toBe("2026-07-14T00:15:00.000Z");
});
```

```ts
// backend/src/inquiries/email-template.test.ts
import { expect, it } from "vitest";
import { renderSalesEmail } from "./email-template";

it("escapes visitor content", () => {
  expect(renderSalesEmail({ name: "<script>", company: "A", message: "Hello", locale: "en" })).not.toContain("<script>");
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm --filter @anshow/backend test -- src/worker/outbox.test.ts src/inquiries/email-template.test.ts`

Expected: FAIL because worker modules do not exist.

- [ ] **Step 3: Implement retry timing and job claiming**

```ts
// backend/src/worker/outbox.ts
const retryMinutes = [1, 5, 15, 60, 360] as const;
export function nextRetryAt(base: Date, attempt: number) {
  const minutes = retryMinutes[Math.min(attempt - 1, retryMinutes.length - 1)];
  return new Date(base.getTime() + minutes * 60_000);
}
```

```ts
// backend/src/worker/outbox.ts
export type DeliveryJob = { id: string; attempts: number; idempotencyKey: string; to: string; subject: string; html: string };
export interface OutboxPort {
  claimDue(limit: number, workerId: string, now: Date): Promise<DeliveryJob[]>;
  markSent(id: string, sentAt: Date): Promise<void>;
  reschedule(id: string, attempts: number, nextAttemptAt: Date, error: string): Promise<void>;
  markFailed(id: string, attempts: number, error: string): Promise<void>;
}

export async function processOutbox(port: OutboxPort, send: (job: DeliveryJob) => Promise<void>, workerId: string, now = new Date()) {
  const jobs = await port.claimDue(10, workerId, now);
  for (const job of jobs) {
    try { await send(job); await port.markSent(job.id, new Date()); }
    catch (error) {
      const attempts = job.attempts + 1;
      const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown SMTP error";
      if (attempts >= 5) await port.markFailed(job.id, attempts, message);
      else await port.reschedule(job.id, attempts, nextRetryAt(new Date(), attempts), message);
    }
  }
}
```

Implement `claimDue` with `BEGIN IMMEDIATE`, select at most ten `pending` jobs where `nextAttemptAt <= now`, update those IDs to `processing` with `workerId` and `claimedAt`, then commit. The unique `idempotencyKey` is sent as the SMTP `Message-ID`, and only `pending` rows are claimable.

- [ ] **Step 4: Implement safe localized templates and SMTP adapter**

```ts
// backend/src/inquiries/email-template.ts
export type SalesEmailInput = { id: string; locale: "en" | "zh" | "ru"; sourceUrl: string; email: string; phone: string; transportNeed: string; message: string };
const subjects = { en: "We received your AnShow enquiry", zh: "我们已收到您的 AnShow 询盘", ru: "Мы получили ваш запрос AnShow" } as const;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
export function renderSalesEmail(input: SalesEmailInput) {
  return `<h1>New enquiry ${escapeHtml(input.id)}</h1><dl><dt>Locale</dt><dd>${escapeHtml(input.locale)}</dd><dt>Source</dt><dd>${escapeHtml(input.sourceUrl)}</dd><dt>Contact</dt><dd>${escapeHtml(input.email || input.phone)}</dd><dt>Requirement</dt><dd>${escapeHtml(input.transportNeed)}</dd></dl><p>${escapeHtml(input.message)}</p>`;
}
export function renderVisitorEmail(locale: "en" | "zh" | "ru") {
  const body = locale === "zh" ? "感谢您的询盘。AnShow 团队将根据您提供的信息与您联系。" : locale === "ru" ? "Спасибо за запрос. Команда AnShow свяжется с вами по указанным контактам." : "Thank you for your enquiry. The AnShow team will follow up using the contact details you provided.";
  return { subject: subjects[locale], html: `<p>${body}</p>` };
}
```

```ts
// backend/src/worker/mailer.ts
import nodemailer from "nodemailer";
import type { DeliveryJob } from "./outbox";
export type SmtpConfig = { host: string; port: number; user: string; password: string; from: string };
export function createMailer(config: SmtpConfig) {
  const transport = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.port === 465, auth: { user: config.user, pass: config.password }, tls: { rejectUnauthorized: true } });
  return { send(job: DeliveryJob) { return transport.sendMail({ from: config.from, to: job.to, subject: job.subject, html: job.html, messageId: `<${job.idempotencyKey}@anshow>` }); } };
}
```

Sales notification includes lead ID, locale, source, contact details, transport need, and escaped message. Never log SMTP passwords or full visitor messages.

Extend `backend/src/env.ts` and `.env.example` with required `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and `SALES_EMAIL` values. Parse the port as an integer from 1 to 65535 and never expose these variables through `NEXT_PUBLIC_*`.

- [ ] **Step 5: Add worker entry and verify**

Add these scripts to `backend/package.json` while preserving the server build entry from the foundation plan:

```json
{"scripts":{"build":"tsup src/server.ts src/worker/index.ts scripts/create-admin.ts --format esm --out-dir dist","worker":"node dist/worker/index.js"}}
```

```ts
// backend/src/worker/index.ts
import { setTimeout as delay } from "node:timers/promises";
import { processOutbox } from "./outbox";
import { outboxPort } from "./outbox-port";
import { mailer } from "./mailer-instance";
import { publishScheduledContent } from "./scheduled-content";

let stopping = false;
process.on("SIGTERM", () => { stopping = true; });
const workerId = `${process.pid}-${crypto.randomUUID()}`;
while (!stopping) {
  await processOutbox(outboxPort, (job) => mailer.send(job), workerId);
  await publishScheduledContent(new Date());
  await delay(5_000);
}
```

The worker loops every 5 seconds, exits cleanly on SIGTERM, and also publishes translations whose `status` is `scheduled` and `scheduledAt <= now`. The backend Docker build runs `pnpm --filter @anshow/backend build` and copies `/workspace/backend/dist` into its runtime stage. Add this Compose service using the same backend image:

```yaml
worker:
  build: { context: ., dockerfile: backend/Dockerfile }
  command: ["node", "dist/worker/index.js"]
  env_file: .env
  depends_on:
    backend: { condition: service_healthy }
  volumes: ["app-data:/data", "media-data:/media"]
  restart: unless-stopped
```

Run:

```bash
pnpm --filter @anshow/backend test -- src/worker/outbox.test.ts src/inquiries/email-template.test.ts
pnpm --filter @anshow/backend typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/worker backend/src/inquiries/email-template* backend/package.json backend/Dockerfile compose.yaml backend/src/env.ts .env.example
git commit -m "Deliver enquiry notifications without coupling them to requests" \
  -m "Constraint: SMTP latency and outages cannot delay or erase public submissions" \
  -m "Confidence: high" -m "Scope-risk: broad" \
  -m "Directive: Preserve idempotency keys and transactional job claiming" \
  -m "Tested: retry and email escaping tests plus typecheck"
```

### Task 4: Build the Lead Workspace, Assignment, History, Notes, and CSV Export

**Files:**
- Create: `backend/src/admin/repositories/inquiry-repository.ts`
- Create: `backend/src/admin/repositories/inquiry-repository.test.ts`
- Create: `backend/src/admin/routes/inquiries.ts`
- Create: `backend/src/admin/routes/inquiries.test.ts`
- Modify: `backend/src/app.ts`
- Create: `frontend/src/api/admin-inquiries.ts`
- Create: `frontend/src/components/admin/inquiry-table.tsx`
- Create: `frontend/src/components/admin/inquiry-detail.tsx`
- Create: `frontend/src/app/admin/(protected)/inquiries/page.tsx`
- Create: `frontend/src/app/admin/(protected)/inquiries/[id]/page.tsx`

- [ ] **Step 1: Write the failing history test**

```ts
// backend/src/admin/repositories/inquiry-repository.test.ts
import { expect, it } from "vitest";
import { createInquiryFixture } from "@/inquiries/test-fixture";
import { createAdminInquiryRepository } from "./inquiry-repository";

it("records assignment and status history", async () => {
  const fixture = createInquiryFixture();
  const lead = await fixture.createLead();
  await createAdminInquiryRepository(fixture.adminPort).assignAndTransition(lead.id, "sales-1", "contacted", "admin-1");
  expect(await fixture.history(lead.id)).toEqual(expect.arrayContaining([
    expect.objectContaining({ assigneeId: "sales-1", toStatus: "contacted" }),
  ]));
});
```

- [ ] **Step 2: Run test and confirm failure**

Run: `pnpm --filter @anshow/backend test -- src/admin/repositories/inquiry-repository.test.ts`

Expected: FAIL because admin inquiry repository does not exist.

- [ ] **Step 3: Implement transactional lead operations**

```ts
// backend/src/admin/repositories/inquiry-repository.ts
import { canTransition, type InquiryStatus } from "@/inquiries/state-machine";
export interface AdminInquiryPort {
  transaction<T>(work: (tx: AdminInquiryPort) => Promise<T>): Promise<T>;
  get(id: string): Promise<{ id: string; status: InquiryStatus } | null>;
  updateAssignmentAndStatus(id: string, assigneeId: string, status: InquiryStatus): Promise<void>;
  insertHistory(input: { inquiryId: string; actorId: string; assigneeId?: string; fromStatus?: InquiryStatus; toStatus: InquiryStatus }): Promise<void>;
  insertNote(input: { inquiryId: string; actorId: string; body: string }): Promise<void>;
  retryDelivery(inquiryId: string): Promise<void>;
  audit(actorId: string, action: string, entityId: string, detail: unknown): Promise<void>;
}
export function createAdminInquiryRepository(port: AdminInquiryPort) {
  return {
    assignAndTransition(id: string, assigneeId: string, toStatus: InquiryStatus, actorId: string) {
      return port.transaction(async (tx) => {
        const current = await tx.get(id); if (!current) throw new Error("Inquiry not found");
        if (!canTransition(current.status, toStatus)) throw new Error("Invalid inquiry transition");
        await tx.updateAssignmentAndStatus(id, assigneeId, toStatus);
        await tx.insertHistory({ inquiryId: id, actorId, assigneeId, fromStatus: current.status, toStatus });
        await tx.audit(actorId, "inquiry.transition", id, { assigneeId, from: current.status, to: toStatus });
      });
    },
    addNote(id: string, body: string, actorId: string) {
      const normalized = body.trim(); if (!normalized || normalized.length > 4_000) throw new Error("Invalid note");
      return port.transaction(async (tx) => { await tx.insertNote({ inquiryId: id, actorId, body: normalized }); await tx.audit(actorId, "inquiry.note", id, {}); });
    },
    retry(id: string, actorId: string) { return port.transaction(async (tx) => { await tx.retryDelivery(id); await tx.audit(actorId, "inquiry.notification.retry", id, {}); }); },
  };
}
```

The list query accepts search, status, owner, locale, source, from/to dates, and a `(createdAt,id)` cursor, orders newest first, and returns at most 50 rows. Define OpenAPI routes for `GET /`, `GET /:id`, `PATCH /:id/assignment-status`, `POST /:id/notes`, and `POST /:id/notification-retry`; mount them at `/api/admin/inquiries`. Apply `requirePermission("inquiry.read")`, `inquiry.assign`, `inquiry.status`, `inquiry.note`, or `inquiry.retry` to the matching Hono route before invoking the repository. Every mutation reads the authenticated actor from Hono context and returns `{ data, error, requestId }`.

```ts
// backend/src/admin/routes/inquiries.test.ts
import { expect, it } from "vitest";
import { createAdminTestApp } from "@/test/admin-app";

it("rejects assignment without inquiry.assign", async () => {
  const fixture = await createAdminTestApp({ permissions: ["inquiry.read"] });
  const inquiry = await fixture.createInquiry();
  const response = await fixture.request(`/api/admin/inquiries/${inquiry.id}/assignment-status`, { method: "PATCH", body: { assigneeId: "sales-1", status: "contacted" } });
  expect(response.status).toBe(403);
  expect(await fixture.history(inquiry.id)).toHaveLength(1);
});
```

- [ ] **Step 4: Implement safe CSV export**

```ts
// backend/src/admin/routes/inquiries.ts excerpt
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { requirePermission } from "@/auth/permission-middleware";
import { inquiryRepository } from "@/admin/repositories";

const csvCell = (value: unknown) => {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
const exportRoute = createRoute({ method: "get", path: "/export", request: { query: inquiryFilterSchema }, responses: { 200: { description: "Filtered CSV", content: { "text/csv": { schema: z.string() } } } } });
export const adminInquiryRoutes = new OpenAPIHono()
  .use("/export", requirePermission("inquiry.export"))
  .openapi(exportRoute, async (context) => {
    const rows = await inquiryRepository.export(context.req.valid("query"), 10_000);
    const csv = ["id,name,company,email,phone,need,status,owner,locale,createdAt", ...rows.map((row) => [row.id, row.name, row.company, row.email, row.phone, row.transportNeed, row.status, row.ownerEmail, row.locale, row.createdAt.toISOString()].map(csvCell).join(","))].join("\r\n");
    context.header("content-type", "text/csv; charset=utf-8");
    context.header("content-disposition", `attachment; filename="anshow-inquiries-${new Date().toISOString().slice(0, 10)}.csv"`);
    return context.body(`\uFEFF${csv}`, 200);
  });
```

The export applies the active list filters and caps one download at 10,000 rows.

- [ ] **Step 5: Build the workspace UI**

```tsx
// frontend/src/components/admin/inquiry-table.tsx
import type { components } from "@/generated/api";
type InquiryRow = components["schemas"]["AdminInquiryRow"];
export function InquiryTable({ rows }: { rows: readonly InquiryRow[] }) {
  if (!rows.length) return <p>No enquiries match these filters.</p>;
  return <div className="overflow-x-auto"><table><thead><tr>{["Contact", "Company", "Need", "Owner", "Status", "Locale", "Created"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><a href={`/admin/inquiries/${row.id}`}>{row.name}<br />{row.email || row.phone}</a></td><td>{row.company}</td><td>{row.transportNeed}</td><td>{row.ownerName ?? "Unassigned"}</td><td>{row.status}</td><td>{row.locale}</td><td>{row.createdAtLabel}</td></tr>)}</tbody></table></div>;
}
```

```tsx
// frontend/src/components/admin/inquiry-detail.tsx
import type { components } from "@/generated/api";
type InquiryDetailRecord = components["schemas"]["AdminInquiryDetail"];
export function InquiryDetail({ inquiry }: { inquiry: InquiryDetailRecord }) {
  return <main><h1>{inquiry.name}</h1><dl><dt>Company</dt><dd>{inquiry.company}</dd><dt>Source</dt><dd>{inquiry.sourceUrl}</dd><dt>Contact</dt><dd>{inquiry.email || inquiry.phone}</dd></dl><AssignmentForm inquiry={inquiry} /><StatusForm inquiry={inquiry} /><NoteForm inquiryId={inquiry.id} /><HistoryList rows={inquiry.history} /><DeliveryAttempts rows={inquiry.deliveries} /></main>;
}
```

`frontend/src/api/admin-inquiries.ts` wraps the generated contract: server reads call `${BACKEND_INTERNAL_URL}/api/admin/inquiries` and forward the request cookie; browser mutations call same-origin `/api/admin/inquiries/*`. It exports no handwritten DTOs. The pages render loading skeletons from `loading.tsx`; failed notification rows expose a retry button only when `/api/admin/session` includes `inquiry.retry`, while the backend permission middleware remains authoritative.

- [ ] **Step 6: Verify and commit**

Run:

```bash
pnpm --filter @anshow/backend test -- src/admin/repositories/inquiry-repository.test.ts src/admin/routes/inquiries.test.ts
pnpm openapi:generate
pnpm --filter @anshow/backend typecheck
pnpm --filter @anshow/frontend build
```

Expected: history test and build pass.

```bash
git add backend/src/admin/repositories/inquiry-repository* backend/src/admin/routes/inquiries* backend/src/app.ts openapi/anshow.json frontend/src/generated/api.ts frontend/src/api/admin-inquiries.ts frontend/src/components/admin/inquiry* 'frontend/src/app/admin/(protected)/inquiries'
git commit -m "Give sales staff a complete history for every lead" \
  -m "Constraint: Assignment, status, notes, retries, and exports need independent permissions" \
  -m "Confidence: high" -m "Scope-risk: broad" \
  -m "Tested: inquiry history test and production build"
```

### Task 5: Add Rate Limits, Origin Validation, CSP, and Upload Headers

**Files:**
- Create: `backend/src/security/rate-limit.ts`
- Create: `backend/src/security/rate-limit.test.ts`
- Create: `backend/src/security/origin.ts`
- Create: `backend/src/security/origin.test.ts`
- Modify: `backend/src/auth/server.ts`
- Modify: `backend/src/worker/index.ts`
- Modify: `frontend/next.config.ts`
- Modify: `Caddyfile`
- Modify: `backend/src/inquiries/route.ts`

- [ ] **Step 1: Write failing security tests**

```ts
// backend/src/security/rate-limit.test.ts
import { expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

it("blocks the sixth enquiry in ten minutes", async () => {
  const limiter = createRateLimiter({ limit: 5, windowMs: 600_000 });
  for (let i = 0; i < 5; i += 1) expect(await limiter.consume("ip-hash")).toBe(true);
  expect(await limiter.consume("ip-hash")).toBe(false);
});
```

```ts
// backend/src/security/origin.test.ts
import { expect, it } from "vitest";
import { isAllowedOrigin } from "./origin";

it("rejects a foreign form origin", () => {
  expect(isAllowedOrigin("https://evil.test", "https://anshow.test")).toBe(false);
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm --filter @anshow/backend test -- src/security/rate-limit.test.ts src/security/origin.test.ts`

Expected: FAIL because security helpers do not exist.

- [ ] **Step 3: Implement SQLite-backed limits and origin checks**

```ts
// backend/src/security/rate-limit.ts
import { createHmac } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { AppDatabase } from "@/db/client";
import { rateLimits } from "@/db/schema/inquiries";
import { env } from "@/env";

export function createRateLimiter({ limit, windowMs, now = () => Date.now() }: { limit: number; windowMs: number; now?: () => number }) {
  const buckets = new Map<string, { count: number; expiresAt: number }>();
  return { async consume(key: string) { const current = buckets.get(key); const time = now(); const row = !current || current.expiresAt <= time ? { count: 0, expiresAt: time + windowMs } : current; row.count += 1; buckets.set(key, row); return row.count <= limit; } };
}

export async function consumeRateLimit(db: AppDatabase, action: string, rawKey: string, limit: number, windowMs: number, now = Date.now()) {
  const bucket = Math.floor(now / windowMs);
  const digest = createHmac("sha256", env.RATE_LIMIT_SECRET).update(rawKey).digest("hex");
  const key = `${action}:${bucket}:${digest}`;
  await db.insert(rateLimits).values({ key, count: 1, expiresAt: new Date((bucket + 1) * windowMs) })
    .onConflictDoUpdate({ target: rateLimits.key, set: { count: sql`${rateLimits.count} + 1` } });
  const [row] = await db.select({ count: rateLimits.count }).from(rateLimits).where(eq(rateLimits.key, key)).limit(1);
  return Boolean(row && row.count <= limit);
}
```

Hash IP addresses with a rotating `RATE_LIMIT_SECRET` before persistence. Public enquiry limit is 5 per 10 minutes; login limit is 10 failures per 15 minutes per IP hash and normalized account key. Purge rows whose `expiresAt` is in the past from the worker.

Replace the private origin and rate-limit helpers in `backend/src/inquiries/route.ts` with `isAllowedOrigin` and `consumeRateLimit`. Apply the same limiter in the Better Auth sign-in path at 10 failed attempts per 15 minutes using both the IP digest and normalized account digest. `backend/src/worker/index.ts` deletes expired `rate_limits` rows once per hour; successful login clears only the current account/IP bucket and never disables the public enquiry limit.

```ts
// backend/src/security/origin.ts
export function isAllowedOrigin(origin: string | null, siteUrl: string) {
  if (!origin) return false;
  return new URL(origin).origin === new URL(siteUrl).origin;
}
```

- [ ] **Step 4: Add response headers**

```ts
// frontend/next.config.ts
import createNextIntlPlugin from "next-intl/plugin";
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const csp = ["default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: https:", "font-src 'self'", "connect-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"].join("; ");
export default withNextIntl({
  output: "standalone",
  async headers() { return [{ source: "/:path*", headers: [
    { key: "Content-Security-Policy", value: csp },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ] }]; },
});
```

Keep HSTS, `X-Content-Type-Options`, and `Referrer-Policy` in Caddy as defined by the foundation plan so those values are not duplicated. Extend `img-src` and `connect-src` only with the configured COS/CDN origin when COS mode is enabled.

- [ ] **Step 5: Verify and commit**

Run:

```bash
pnpm --filter @anshow/backend test -- src/security
pnpm --filter @anshow/backend typecheck
pnpm --filter @anshow/frontend build
docker compose up -d frontend backend caddy
curl -kI https://localhost/en -H 'Host: localhost'
```

Expected: tests/build pass and headers are present in the local production server response.

```bash
git add backend/src/security backend/src/auth/server.ts backend/src/worker/index.ts backend/src/inquiries/route.ts frontend/next.config.ts Caddyfile
git commit -m "Reduce abuse without burdening legitimate enquiries" \
  -m "Constraint: Version 1 uses rate limits and honeypots without CAPTCHA" \
  -m "Confidence: high" -m "Scope-risk: broad" \
  -m "Tested: security unit tests, production build, and response header inspection"
```

### Task 6: Implement Tencent COS Media Storage

**Files:**
- Create: `backend/src/media/cos-storage.ts`
- Create: `backend/src/media/cos-storage.test.ts`
- Modify: `backend/src/media/storage.ts`
- Modify: `backend/src/env.ts`
- Modify: `.env.example`

- [ ] **Step 1: Install the Tencent COS SDK and write failing adapter test**

Run: `pnpm --filter @anshow/backend add cos-nodejs-sdk-v5`

```ts
// backend/src/media/cos-storage.test.ts
import { expect, it, vi } from "vitest";
import { CosStorage } from "./cos-storage";

it("writes immutable cache metadata", async () => {
  const putObject = vi.fn((_args, callback) => callback(null, {}));
  const storage = new CosStorage({ client: { putObject } as never, bucket: "b", region: "r", publicBaseUrl: "https://assets.anshow.test" });
  await storage.put("media/hash.avif", new Uint8Array([1]), "image/avif");
  expect(putObject).toHaveBeenCalledWith(expect.objectContaining({ CacheControl: "public,max-age=31536000,immutable" }), expect.any(Function));
});
```

- [ ] **Step 2: Run test and confirm failure**

Run: `pnpm --filter @anshow/backend test -- src/media/cos-storage.test.ts`

Expected: FAIL because COS adapter does not exist.

- [ ] **Step 3: Implement the adapter**

`CosStorage` implements `MediaStorage.put/delete`, applies correct content type and immutable cache control, normalizes public URLs, and never exposes secret ID/key to client bundles. `MEDIA_DRIVER=cos` requires bucket, region, public base URL, secret ID, and secret key at startup.

```ts
// backend/src/env.ts COS refinement
const cosSchema = z.object({ COS_BUCKET: z.string().min(1), COS_REGION: z.string().min(1), COS_PUBLIC_BASE_URL: z.string().url(), COS_SECRET_ID: z.string().min(1), COS_SECRET_KEY: z.string().min(1) });
export function requireCosEnv(input: Record<string, unknown>) { return cosSchema.parse(input); }
```

```ts
// backend/src/media/cos-storage.ts
import type COS from "cos-nodejs-sdk-v5";
import type { MediaStorage } from "./storage";
export class CosStorage implements MediaStorage {
  constructor(private config: { client: COS; bucket: string; region: string; publicBaseUrl: string }) {}
  put(key: string, body: Uint8Array, contentType: string) {
    return new Promise<{ url: string }>((resolve, reject) => this.config.client.putObject({
      Bucket: this.config.bucket, Region: this.config.region, Key: key, Body: Buffer.from(body),
      ContentType: contentType, CacheControl: "public,max-age=31536000,immutable",
    }, (error) => error ? reject(error) : resolve({ url: `${this.config.publicBaseUrl}/${key}` })));
  }
  delete(key: string) {
    return new Promise<void>((resolve, reject) => this.config.client.deleteObject({ Bucket: this.config.bucket, Region: this.config.region, Key: key }, (error) => error ? reject(error) : resolve()));
  }
}
```

- [ ] **Step 4: Verify and commit**

Run:

```bash
pnpm --filter @anshow/backend test -- src/media/cos-storage.test.ts
pnpm --filter @anshow/backend typecheck
```

Expected: test and typecheck pass.

```bash
git add backend/package.json pnpm-lock.yaml backend/src/media backend/src/env.ts .env.example
git commit -m "Serve production media through Tencent COS and CDN" \
  -m "Constraint: International visitors should not fetch every asset from the application container" \
  -m "Confidence: medium" -m "Scope-risk: moderate" \
  -m "Tested: COS adapter unit test and typecheck"
```

### Task 7: Add Encrypted Backup, COS Retention, and Restore Verification

**Files:**
- Create: `backend/src/backup/create-backup.ts`
- Create: `backend/src/backup/verify-restore.ts`
- Create: `backend/src/backup/cos-backup-storage.ts`
- Create: `backend/src/backup/scheduler.ts`
- Create: `backend/src/backup/backup.test.ts`
- Create: `backend/src/db/schema/operations.ts`
- Modify: `backend/src/db/schema/index.ts`
- Modify: `backend/package.json`
- Modify: `backend/Dockerfile`
- Modify: `compose.yaml`
- Modify: `backend/src/env.ts`
- Modify: `.env.example`
- Create: `docs/deployment/backup-and-restore.md`

- [ ] **Step 1: Write the failing retention test**

```ts
// backend/src/backup/backup.test.ts
import { expect, it } from "vitest";
import { retentionClass } from "./create-backup";

it("classifies daily, weekly, and monthly backups", () => {
  expect(retentionClass(new Date("2026-07-14T00:00:00Z"))).toContain("daily");
  expect(retentionClass(new Date("2026-07-01T00:00:00Z"))).toContain("monthly");
});
```

- [ ] **Step 2: Run test and confirm failure**

Run: `pnpm --filter @anshow/backend test -- src/backup/backup.test.ts`

Expected: FAIL because backup script does not exist.

- [ ] **Step 3: Implement consistent encrypted backup**

```ts
// backend/src/backup/create-backup.ts
import { createCipheriv, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";

export interface BackupConfig {
  databasePath: string; stagingRoot: string; encryptionKey: string;
  media: { list(): Promise<unknown[]> };
  caddyDataRoot: string;
  configuration: { snapshot(): Promise<Record<string, string | number | boolean>> };
  storage: { putFile(key: string, file: string, metadata: { retention: string }): Promise<void>; prune(policy: { daily: number; weekly: number; monthly: number }): Promise<void> };
}
export function retentionClass(date: Date) {
  const classes = ["daily"];
  if (date.getUTCDay() === 0) classes.push("weekly");
  if (date.getUTCDate() === 1) classes.push("monthly");
  return classes;
}
export async function run(command: string, args: string[]) { await new Promise<void>((resolve, reject) => { const child = spawn(command, args, { stdio: "inherit" }); child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`))); }); }
async function encrypt(input: string, output: string, key: Buffer) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key, iv);
  const target = createWriteStream(output); target.write(Buffer.concat([Buffer.from("ANSHOW1"), iv]));
  await pipeline(createReadStream(input), cipher, target);
  await fs.appendFile(output, cipher.getAuthTag());
}
export async function createBackup(config: BackupConfig) {
  const staging = await fs.mkdtemp(path.join(config.stagingRoot, "anshow-backup-"));
  try {
    const snapshot = path.join(staging, "anshow.db");
    const database = new Database(config.databasePath, { readonly: true });
    await database.backup(snapshot); database.close();
    await fs.writeFile(path.join(staging, "media-manifest.json"), JSON.stringify(await config.media.list(), null, 2));
    await fs.writeFile(path.join(staging, "configuration.json"), JSON.stringify(await config.configuration.snapshot(), null, 2));
    await run("tar", ["-cf", path.join(staging, "caddy-data.tar"), "-C", config.caddyDataRoot, "."]);
    const archive = `${staging}.tar`; await run("tar", ["-cf", archive, "-C", staging, "."]);
    const encrypted = `${archive}.enc`; await encrypt(archive, encrypted, Buffer.from(config.encryptionKey, "base64"));
    const now = new Date(); const key = `backups/${now.toISOString()}.tar.enc`;
    await config.storage.putFile(key, encrypted, { retention: retentionClass(now).join(",") });
    await config.storage.prune({ daily: 7, weekly: 4, monthly: 6 });
    return { key };
  } finally { await fs.rm(staging, { recursive: true, force: true }); await fs.rm(`${staging}.tar`, { force: true }); await fs.rm(`${staging}.tar.enc`, { force: true }); }
}
```

Validate that `BACKUP_ENCRYPTION_KEY` decodes to exactly 32 bytes. `backend/src/backup/cos-backup-storage.ts` implements `putFile`, `downloadLatest`, and retention pruning against the configured private COS backup prefix; media objects continue to use the public media adapter and are never mixed with backup objects. Add a `backup_runs` table with `id`, `status`, `objectKey`, `startedAt`, `finishedAt`, and redacted `error`; the scheduler records every success/failure and sends the configured administrator a short failure notification without secrets or visitor content.

Add `BACKUP_ENCRYPTION_KEY` and `BACKUP_STAGING_ROOT=/staging` to the server-only environment schema and `.env.example`. Validation decodes the key from base64 and rejects any value that is not exactly 32 bytes.

- [ ] **Step 4: Implement restore verification**

```ts
// backend/src/backup/verify-restore.ts
import { createDecipheriv } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import { run } from "./create-backup";

export interface RestoreConfig { stagingRoot: string; encryptionKey: string; storage: { downloadLatest(target: string): Promise<void> } }
export async function decryptBackup(input: string, output: string, encodedKey: string) {
  const bytes = await fs.readFile(input); const header = bytes.subarray(0, 7).toString("ascii");
  if (header !== "ANSHOW1") throw new Error("Invalid backup header");
  const iv = bytes.subarray(7, 19); const tag = bytes.subarray(bytes.length - 16); const ciphertext = bytes.subarray(19, bytes.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(encodedKey, "base64"), iv); decipher.setAuthTag(tag);
  await fs.writeFile(output, Buffer.concat([decipher.update(ciphertext), decipher.final()]));
}
export async function verifyRestore(config: RestoreConfig) {
  const isolated = await fs.mkdtemp(path.join(config.stagingRoot, "anshow-restore-"));
  try {
    const encrypted = path.join(isolated, "backup.enc"); await config.storage.downloadLatest(encrypted);
    const archive = path.join(isolated, "backup.tar"); await decryptBackup(encrypted, archive, config.encryptionKey);
    await run("tar", ["-xf", archive, "-C", isolated]);
    const restored = new Database(path.join(isolated, "anshow.db"), { readonly: true });
    const integrity = restored.pragma("integrity_check", { simple: true });
    if (integrity !== "ok") throw new Error(`SQLite integrity check failed: ${integrity}`);
    const tables = new Set((restored.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(({ name }) => name));
    for (const required of ["user", "session", "services", "service_translations", "inquiries", "notification_deliveries"]) if (!tables.has(required)) throw new Error(`Missing table ${required}`);
    restored.close();
    const manifest = JSON.parse(await fs.readFile(path.join(isolated, "media-manifest.json"), "utf8"));
    if (!Array.isArray(manifest)) throw new Error("Invalid media manifest");
    const configuration = JSON.parse(await fs.readFile(path.join(isolated, "configuration.json"), "utf8"));
    await fs.access(path.join(isolated, "caddy-data.tar"));
    return { ok: true as const, tables: tables.size, media: manifest.length, configurationKeys: Object.keys(configuration).length };
  } finally { await fs.rm(isolated, { recursive: true, force: true }); }
}
```

`decryptBackup` checks the `ANSHOW1` header and AES-GCM authentication tag before extracting. Never point the production app at the verification database.

- [ ] **Step 5: Add the scheduler, backend-image service, and runbook**

```ts
// backend/src/backup/scheduler.ts
import { setTimeout as delay } from "node:timers/promises";
import { createBackup } from "./create-backup";
import { backupConfig, backupRuns, notifyBackupFailure } from "./wiring";

let stopping = false;
process.on("SIGTERM", () => { stopping = true; });
while (!stopping) {
  const run = await backupRuns.start(new Date());
  try {
    const result = await createBackup(backupConfig);
    await backupRuns.succeed(run.id, result.key, new Date());
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown backup error";
    await backupRuns.fail(run.id, message, new Date());
    await notifyBackupFailure(message);
  }
  if (!stopping) await delay(86_400_000);
}
```

Add `src/backup/scheduler.ts` and `src/backup/verify-restore.ts` as `tsup` entries in `backend/package.json`, producing `dist/backup/scheduler.js` and `dist/backup/verify-restore.js`. Install `tar` in the backend runtime stage; do not create a separate dependency image that can drift from the backend schema and native SQLite build. The configuration snapshot contains only non-secret mode/version identifiers and hashes, never `.env`, SMTP credentials, COS credentials, Better Auth secrets, or the backup key.

```yaml
# compose.yaml addition
  backup:
    build: { context: ., dockerfile: backend/Dockerfile }
    command: ["node", "dist/backup/scheduler.js"]
    env_file: .env
    depends_on:
      backend: { condition: service_healthy }
    volumes: ["app-data:/data", "media-data:/media:ro", "caddy-data:/caddy-data:ro", "backup-staging:/staging"]
    restart: unless-stopped
volumes:
  backup-staging: {}
```

```markdown
<!-- docs/deployment/backup-and-restore.md -->
1. Stop writers: `docker compose stop frontend backend worker backup`.
2. Download and decrypt the selected COS backup into an isolated directory.
3. Run `docker compose run --rm backend node dist/backup/verify-restore.js --file <backup>` and require `ok`.
4. Copy the verified database to the `app-data` volume; restore media objects from `media-manifest.json` and Caddy state from `caddy-data.tar` only while Caddy is stopped.
5. Run `docker compose run --rm backend pnpm db:migrate`.
6. Start services with `docker compose up -d backend frontend worker backup caddy` and verify `/api/health`, admin login, and one read-only public route.
7. Keep the replaced database until the restored system has passed the release checklist.
```

- [ ] **Step 6: Verify and commit**

Run:

```bash
pnpm --filter @anshow/backend test -- src/backup/backup.test.ts
pnpm --filter @anshow/backend typecheck
docker compose config
pnpm --filter @anshow/backend backup:dry-run
pnpm --filter @anshow/backend backup:verify-fixture
```

Expected: test passes, Compose is valid, dry-run leaves no plaintext archive, fixture restore reports `ok`.

```bash
git add backend/src/backup backend/src/db/schema backend/package.json backend/Dockerfile backend/migrations compose.yaml backend/src/env.ts .env.example docs/deployment/backup-and-restore.md
git commit -m "Make AnShow recoverable after a server loss" \
  -m "Constraint: A local volume is not a backup and live SQLite files cannot be copied raw" \
  -m "Confidence: high" -m "Scope-risk: broad" \
  -m "Directive: Keep restore verification isolated from the production database" \
  -m "Tested: retention test, compose config, backup dry-run, and fixture restore"
```

### Task 8: Complete Production E2E, Accessibility, Performance, and Deployment Runbook

**Files:**
- Create: `frontend/tests/e2e/enquiry.spec.ts`
- Create: `frontend/tests/e2e/accessibility.spec.ts`
- Create: `frontend/tests/e2e/performance.spec.ts`
- Create: `docs/deployment/tencent-cloud.md`
- Create: `docs/deployment/release-checklist.md`

- [ ] **Step 1: Write full enquiry and permission E2E flows**

```ts
// frontend/tests/e2e/enquiry.spec.ts
import { test, expect } from "@playwright/test";

test("persists a Chinese enquiry before showing success", async ({ page }) => {
  await page.goto("/zh");
  await page.getByLabel("姓名").fill("李伟");
  await page.getByLabel("公司").fill("华江贸易");
  await page.getByLabel("邮箱").fill("li@example.test");
  await page.getByLabel("运输需求").fill("中俄铁路运输");
  await page.getByLabel("留言").fill("需要了解铁路运输服务和操作流程。");
  await page.getByRole("checkbox", { name: /隐私/ }).check();
  await page.getByRole("button", { name: "提交询盘" }).click();
  await expect(page.getByRole("status")).toContainText("已收到");
});
```

- [ ] **Step 2: Add accessibility and motion E2E**

```ts
// frontend/tests/e2e/accessibility.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
for (const path of ["/en", "/zh", "/ru", "/admin/login", "/en/services/ocean-freight"]) {
  test(`${path} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(path); const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
  });
}
test.use({ reducedMotion: "reduce", viewport: { width: 375, height: 812 } });
test("mobile reduced-motion experience remains readable", async ({ page }) => {
  await page.goto("/en");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await expect(page.locator("[data-process-complete]")).toBeVisible();
  expect(await page.locator("button, input, textarea, select").evaluateAll((nodes) => nodes.every((node) => node.getBoundingClientRect().height >= 44))).toBe(true);
});
```

Add a keyboard-only test that tabs through language, carousel pause, quote, and form controls, then submits an invalid form and asserts focus moves to the first invalid field.

- [ ] **Step 3: Add measurable performance assertions**

```ts
// frontend/tests/e2e/performance.spec.ts
import { test, expect } from "@playwright/test";
test("mobile avoids heavy scenes and image budget regressions", async ({ page }) => {
  const responses: { url: string; bytes: number }[] = [];
  page.on("response", async (response) => { const type = response.request().resourceType(); if (["image", "script"].includes(type)) responses.push({ url: response.url(), bytes: Number(response.headers()["content-length"] ?? 0) }); });
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/en", { waitUntil: "networkidle" });
  expect(responses.some(({ url }) => /three(\.module)?|three-shared/.test(url))).toBe(false);
  const hero = responses.find(({ url }) => /hero-ocean.*\.(avif|webp)/.test(url)); expect(hero?.bytes ?? Infinity).toBeLessThanOrEqual(140 * 1024);
  const cls = await page.evaluate(() => performance.getEntriesByType("layout-shift").reduce((sum, entry) => sum + ((entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean }).hadRecentInput ? 0 : ((entry as PerformanceEntry & { value?: number }).value ?? 0)), 0));
  expect(cls).toBeLessThan(0.1);
});
```

Run the production build behind Caddy under the agreed Playwright desktop profile and collect LCP and event timing with `PerformanceObserver` installed through `page.addInitScript`; assert LCP below 2.5s and the longest interaction below 200ms. Fail the test when a desktop hero exceeds 280KB, a mobile hero exceeds 140KB, a content image exceeds 90KB, or a thumbnail exceeds 35KB.

- [ ] **Step 4: Write Tencent Cloud deployment runbook**

```markdown
<!-- docs/deployment/tencent-cloud.md -->
# Tencent Cloud Deployment
1. Provision a Linux CVM with sufficient CPU/RAM for Next.js image builds and attach persistent storage for Docker volumes.
2. Allow inbound TCP 80 and 443 only; keep SSH restricted to administrative source addresses.
3. Create a Tencent DNS A record for the production hostname pointing to the CVM public IP and wait for it to resolve.
4. Install Docker Engine with the Compose plugin, clone the release, and create `.env` from `.env.example` with `SITE_HOST`, `SITE_URL`, Better Auth, SMTP, COS, rate-limit, and backup secrets.
5. Run `docker compose run --rm backend pnpm db:migrate` and the documented first-admin command.
6. Start with `docker compose up -d --build`; verify `docker compose ps`, `https://<host>/api/health`, and the Caddy certificate issuer in `docker compose logs caddy`.
7. Complete legal name, public contact, privacy controller, and one contact channel in `/admin/settings` before publishing.
8. Trigger one backup and one isolated restore verification before accepting traffic.
9. Update with a database backup, `docker compose build`, migration, and `docker compose up -d`; roll back to the previous image and compatible database backup if health checks fail.
```

The release checklist records image tags, migration ID, certificate result, backup object key, restore-verification output, admin login, public EN/ZH/RU checks, and rollback owner.

- [ ] **Step 5: Run the complete release gate**

Run:

```bash
pnpm -r test
pnpm -r lint
pnpm -r typecheck
pnpm -r build
pnpm --filter @anshow/frontend test:e2e
docker compose config
docker compose build
```

Expected: every command passes with zero known errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/tests/e2e docs/deployment
git commit -m "Prove AnShow is ready for a Tencent Cloud handoff" \
  -m "Constraint: Delivery includes deployment, recovery, accessibility, and performance evidence" \
  -m "Confidence: high" -m "Scope-risk: broad" \
  -m "Tested: full unit, lint, typecheck, build, E2E, Compose, and Docker release gate"
```

## Operations Completion Gate

The release is complete only when:

- Every enquiry is stored before success is shown.
- SMTP jobs retry safely and never duplicate a lead.
- Authorized staff can assign, note, transition, retry, and export leads.
- Security headers, origin checks, rate limits, and upload checks pass.
- COS mode serves immutable optimized assets.
- Encrypted off-server backups and isolated restore checks pass.
- Full EN/ZH/RU E2E, accessibility, performance, Docker, and Tencent Cloud runbooks are complete.
