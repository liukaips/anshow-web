# PPT Content Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic bootstrap catalog with validated, three-language PPT-derived company content while upgrading untouched seed records and preserving every operator-modified record.

**Architecture:** Keep the current localized content tables and store versioned structured detail bodies in the existing `body` text column. Add a seed-revision table that fingerprints the exact bootstrap state, enabling deterministic upgrades of untouched records without overwriting editorial changes. Expand the existing migration runner so every empty, restored, or existing database reaches a complete usable baseline.

**Tech Stack:** TypeScript, Hono, Zod 4, Drizzle ORM, SQLite, Vitest, pnpm.

---

## File Structure

- Create `backend/src/content/structured-body.ts`: versioned Zod schemas and safe legacy-text parser.
- Create `backend/src/content/structured-body.test.ts`: schema, legacy fallback, and unsafe-input tests.
- Create `backend/src/content/seed-catalog.ts`: PPT-derived seed records only.
- Create `backend/src/content/seed-upgrades.ts`: fingerprint and revision-aware insert/update/archive decisions.
- Create `backend/src/content/seed-upgrades.test.ts`: untouched-upgrade and editorial-preservation tests.
- Modify `backend/src/content/seed.ts`: orchestration only; delegate catalog and upgrade decisions.
- Modify `backend/src/content/seed.test.ts`: complete collection counts and published-content assertions.
- Modify `backend/src/db/schema/content.ts`: add `contentSeedRevisions`.
- Modify `backend/src/db/schema/index.ts`: export the new table.
- Generate `backend/migrations/0010_ppt_content_seed_revisions.sql`, `backend/migrations/meta/0010_snapshot.json`, and the matching journal entry with Drizzle.
- Modify `backend/src/content/public-contract.ts`: add parsed structured body to the public contract while retaining raw `body` compatibility during migration.
- Modify `backend/src/content/drizzle-content-store.ts`: English fallback and complete home collections.
- Modify `backend/src/content/public-repository.test.ts`: cases, certificates, proof metrics, alternates, and fallback.
- Modify `backend/src/db/migration-runner.ts`: use the revision-aware initializer.
- Modify `backend/src/db/migrate.integration.test.ts`: empty and old-baseline database coverage.
- Regenerate `openapi/anshow.json` and `frontend/src/generated/api.ts`.

### Task 1: Add a Safe Structured Content Body

**Files:**
- Create: `backend/src/content/structured-body.ts`
- Create: `backend/src/content/structured-body.test.ts`
- Modify: `backend/src/content/public-contract.ts`

- [ ] **Step 1: Write failing schema and legacy-fallback tests**

```ts
import { describe, expect, it } from "vitest";
import { parseContentBody, structuredContentBodySchema } from "./structured-body.js";

describe("structured content body", () => {
  it("accepts the approved version-one blocks", () => {
    expect(structuredContentBodySchema.parse({
      version: 1,
      sections: [
        { type: "paragraph", text: "Door-to-door coordination." },
        { type: "fact-list", items: [{ key: "weight", label: "Weight", value: "12", unit: "t" }] },
        { type: "process", steps: [{ title: "Review", text: "Confirm route and cargo data." }] },
      ],
    }).version).toBe(1);
  });

  it("keeps existing plain text readable", () => {
    expect(parseContentBody("Existing editorial paragraph")).toEqual({
      kind: "legacy-text",
      text: "Existing editorial paragraph",
    });
  });

  it("never accepts executable HTML as a block type", () => {
    expect(() => structuredContentBodySchema.parse({
      version: 1,
      sections: [{ type: "html", html: "<script>alert(1)</script>" }],
    })).toThrow();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter @anshow/backend exec vitest run src/content/structured-body.test.ts`

Expected: FAIL because `structured-body.ts` does not exist.

- [ ] **Step 3: Implement the fixed block union and safe parser**

```ts
import { z } from "zod";

const factSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  value: z.string().min(1).max(120),
  unit: z.string().max(40).optional(),
});

const sectionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: z.string().min(1).max(5000) }),
  z.object({ type: z.literal("fact-list"), items: z.array(factSchema).min(1).max(12) }),
  z.object({ type: z.literal("process"), steps: z.array(z.object({ title: z.string().min(1).max(120), text: z.string().min(1).max(1000) })).min(1).max(8) }),
  z.object({ type: z.literal("bullet-list"), title: z.string().max(160).optional(), items: z.array(z.string().min(1).max(500)).min(1).max(16) }),
  z.object({ type: z.literal("callout"), title: z.string().min(1).max(160), text: z.string().min(1).max(1500) }),
  z.object({ type: z.literal("quote-cta"), title: z.string().min(1).max(160), text: z.string().min(1).max(800) }),
]);

export const structuredContentBodySchema = z.object({
  version: z.literal(1),
  sections: z.array(sectionSchema).min(1).max(24),
});

export function parseContentBody(body: string) {
  try {
    return { kind: "structured" as const, value: structuredContentBodySchema.parse(JSON.parse(body)) };
  } catch {
    return { kind: "legacy-text" as const, text: body };
  }
}
```

- [ ] **Step 4: Expose the parsed body in the public schema without removing raw `body`**

Add `structuredBody: structuredContentBodySchema.nullable()` to `publicItemSchema`. During the transition, raw `body` remains available for preview snapshots and backward compatibility.

- [ ] **Step 5: Run focused verification**

Run: `pnpm --filter @anshow/backend exec vitest run src/content/structured-body.test.ts src/public/content-routes.test.ts && pnpm --filter @anshow/backend typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/content/structured-body.ts backend/src/content/structured-body.test.ts backend/src/content/public-contract.ts
git commit -m "Let published logistics content use safe structured sections"
```

### Task 2: Add Seed Revision Fingerprints

**Files:**
- Modify: `backend/src/db/schema/content.ts`
- Modify: `backend/src/db/schema/index.ts`
- Generate: `backend/migrations/0010_ppt_content_seed_revisions.sql`
- Generate: `backend/migrations/meta/0010_snapshot.json`
- Modify: `backend/migrations/meta/_journal.json`
- Create: `backend/src/content/seed-upgrades.ts`
- Create: `backend/src/content/seed-upgrades.test.ts`

- [ ] **Step 1: Write failing upgrade-decision tests**

```ts
it("upgrades a record that still matches the previous bootstrap fingerprint", () => {
  expect(decideSeedUpgrade({ current: OLD_SEED, previousSeed: OLD_SEED, nextSeed: PPT_SEED })).toBe("upgrade");
});

it("preserves any operator-modified record", () => {
  expect(decideSeedUpgrade({ current: { ...OLD_SEED, title: "Operator title" }, previousSeed: OLD_SEED, nextSeed: PPT_SEED })).toBe("preserve");
});

it("archives a superseded untouched bootstrap item", () => {
  expect(decideSeedUpgrade({ current: OLD_SEED, previousSeed: OLD_SEED, nextSeed: null })).toBe("archive");
});
```

- [ ] **Step 2: Run and confirm the test fails**

Run: `pnpm --filter @anshow/backend exec vitest run src/content/seed-upgrades.test.ts`

Expected: FAIL because the revision model and decision helper do not exist.

- [ ] **Step 3: Add the revision table**

```ts
export const contentSeedRevisions = sqliteTable(
  "content_seed_revisions",
  {
    collection: text("collection").notNull(),
    ownerId: text("owner_id").notNull(),
    locale: text("locale", { enum: locales }).notNull(),
    seedVersion: integer("seed_version").notNull(),
    appliedFingerprint: text("applied_fingerprint").notNull(),
    appliedAt: timestamp("applied_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.collection, table.ownerId, table.locale] })],
);
```

- [ ] **Step 4: Generate and inspect the migration**

Run: `pnpm --filter @anshow/backend exec drizzle-kit generate --config drizzle.config.ts --name ppt_content_seed_revisions`

Expected: `backend/migrations/0010_ppt_content_seed_revisions.sql`, updated `backend/migrations/meta/_journal.json`, and `backend/migrations/meta/0010_snapshot.json` containing only the intended schema addition.

- [ ] **Step 5: Implement deterministic fingerprints and decisions**

Use `node:crypto` SHA-256 over canonical JSON with sorted object keys. Include base sort order, media ID, process stage, archived state, publication state, slug, title, summary, body, SEO, and alt text. Do not include timestamps.

```ts
export function decideSeedUpgrade(input: UpgradeInput): "insert" | "upgrade" | "preserve" | "archive" | "noop" {
  if (!input.current) return input.nextSeed ? "insert" : "noop";
  if (fingerprint(input.current) !== fingerprint(input.previousSeed)) return "preserve";
  return input.nextSeed ? "upgrade" : "archive";
}
```

- [ ] **Step 6: Run schema, migration, and upgrade tests**

Run: `pnpm --filter @anshow/backend exec vitest run src/content/seed-upgrades.test.ts src/db/content-schema.test.ts && pnpm db:check`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/db/schema backend/src/content/seed-upgrades.ts backend/src/content/seed-upgrades.test.ts backend/migrations
git commit -m "Protect editorial changes while evolving bootstrap content"
```

### Task 3: Replace the Generic Catalog with PPT Content

**Files:**
- Create: `backend/src/content/seed-catalog.ts`
- Modify: `backend/src/content/seed.ts`
- Modify: `backend/src/content/seed.test.ts`

- [ ] **Step 1: Change the catalog-count test to the approved baseline**

```ts
expect(collectionCounts).toEqual({
  "hero-slides": 4,
  services: 7,
  "trade-lanes": 4,
  "cargo-types": 4,
  pages: 7,
  "case-studies": 8,
  articles: 3,
  certificates: 4,
  "proof-metrics": 4,
  "navigation-items": 9,
});
```

Also assert that every case has one structured fact list and all three locales carry identical canonical fact keys and values.

- [ ] **Step 2: Run the seed tests and confirm the count failure**

Run: `pnpm --filter @anshow/backend exec vitest run src/content/seed.test.ts`

Expected: FAIL because cases, certificates, and proof metrics still use the old catalog.

- [ ] **Step 3: Define the exact stable codes**

Use these codes:

```ts
const heroCodes = ["ocean", "air", "rail", "road"];
const serviceCodes = ["ocean-freight", "air-freight", "rail-freight", "road-freight", "warehousing", "customs-origin", "insurance-solutions"];
const laneCodes = ["china-russia", "china-europe", "central-asia", "global-network"];
const cargoCodes = ["dangerous-goods", "oversized-cargo", "temperature-controlled", "complex-projects"];
const caseCodes = ["un1263-hamburg", "un3265-india", "un3480-los-angeles", "injection-machine-turkey", "excavators-tir-moscow", "auto-parts-rail-russia", "electronics-air-munich", "semiconductor-import-clearance"];
const certificateCodes = ["iata", "nvocc", "wca", "jctrans"];
const proofCodes = ["founded-2012", "exception-response", "multilingual-support", "transparent-pricing"];
```

- [ ] **Step 4: Write complete EN/ZH/RU translations**

For every code, provide `title`, `slug`, `summary`, version-one structured `body`, `seoTitle`, `seoDescription`, and factual `altText`. Use the approved wording from `docs/superpowers/specs/2026-07-18-ppt-content-public-experience-design.md`; do not use absolute satisfaction, coverage, or zero-risk claims.

The case bodies must encode the canonical PPT facts exactly:

```ts
facts("un1263-hamburg", [{ key: "weight", value: "12", unit: "t" }, { key: "un", value: "UN1263" }, { key: "duration", value: "28", unit: "days" }]);
facts("injection-machine-turkey", [{ key: "dimensions", value: "11.8 × 2.6 × 3.2", unit: "m" }, { key: "weight", value: "28", unit: "t" }, { key: "equipment", value: "40-foot flat rack" }]);
facts("excavators-tir-moscow", [{ key: "distance", value: "8,600", unit: "km" }, { key: "duration", value: "15", unit: "days" }]);
```

- [ ] **Step 5: Extend `SeedCollection` and insert switches**

Add `certificates` and `proof-metrics` to the union and route them to existing `certificates`, `certificateTranslations`, `proofMetrics`, and `proofMetricTranslations` tables.

- [ ] **Step 6: Run seed tests**

Run: `pnpm --filter @anshow/backend exec vitest run src/content/seed.test.ts`

Expected: PASS with 8 published cases, 4 published certificate descriptions, and 4 published proof metrics.

- [ ] **Step 7: Commit**

```bash
git add backend/src/content/seed-catalog.ts backend/src/content/seed.ts backend/src/content/seed.test.ts
git commit -m "Make the company presentation the published content baseline"
```

### Task 4: Apply Version-Aware Catalog Upgrades

**Files:**
- Modify: `backend/src/content/seed.ts`
- Modify: `backend/src/content/seed.test.ts`
- Modify: `backend/src/content/seed-upgrades.ts`

- [ ] **Step 1: Add failing database upgrade tests**

Create one test database seeded with the current generic catalog, edit the English ocean title and media, then run the PPT seed. Assert:

```ts
expect(read("services", "ocean-freight", "en").title).toBe("Operator title");
expect(read("services", "air-freight", "en").title).toBe("Air Freight for Time-Critical Cargo");
expect(readBase("services", "multimodal").archivedAt).toEqual(PPT_SEEDED_AT);
expect(readBase("case-studies", "un1263-hamburg")).toBeDefined();
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm --filter @anshow/backend exec vitest run src/content/seed.test.ts -t "upgrades untouched generic content"`

Expected: FAIL because current seeding only uses `onConflictDoNothing`.

- [ ] **Step 3: Route every seed item through the revision decision**

Within a single database transaction: read current base and translation rows, compare against the known previous catalog fingerprint, apply insert/update/archive, then upsert the new revision row. A `preserve` decision must not update the revision fingerprint.

- [ ] **Step 4: Return an operator-readable initialization summary**

```ts
export type SeedResult = {
  inserted: number;
  upgraded: number;
  archived: number;
  preserved: Array<{ collection: SeedCollection; code: string; locale: Locale }>;
};
```

Log only codes and decisions; do not log content bodies or contact data.

- [ ] **Step 5: Run all content seed tests**

Run: `pnpm --filter @anshow/backend exec vitest run src/content/seed.test.ts src/content/seed-upgrades.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/content/seed.ts backend/src/content/seed.test.ts backend/src/content/seed-upgrades.ts
git commit -m "Upgrade untouched bootstrap copy without touching editorial work"
```

### Task 5: Publish Complete Home Data and English Fallbacks

**Files:**
- Modify: `backend/src/content/drizzle-content-store.ts`
- Modify: `backend/src/content/public-contract.ts`
- Modify: `backend/src/content/public-repository.test.ts`
- Modify: `backend/src/public/content-routes.test.ts`

- [ ] **Step 1: Add failing repository expectations**

```ts
expect(home.cases).toHaveLength(8);
expect(home.certificates).toHaveLength(4);
expect(home.proof).toHaveLength(4);
expect(home.services).toHaveLength(7);
expect(home.cases[0]?.structuredBody?.version).toBe(1);
```

Delete one published Russian service translation and assert `listCollection("services", "ru")` returns the published English record with `locale: "en"` while preserving Russian route navigation.

- [ ] **Step 2: Run and verify failure**

Run: `pnpm --filter @anshow/backend exec vitest run src/content/public-repository.test.ts`

Expected: FAIL on missing structured bodies or locale fallback.

- [ ] **Step 3: Parse structured bodies at the repository boundary**

Set `structuredBody` to the parsed value for version-one content and `null` for legacy text. Keep `body` unchanged.

- [ ] **Step 4: Add per-item English fallback**

Query the requested locale first, then fill only missing owner IDs from published English translations. Never return drafts, scheduled records, archived bases, or English content when the requested locale record exists but is unpublished intentionally.

- [ ] **Step 5: Verify sitemap alternates remain publication-aware**

Fallback display must not invent a Russian alternate URL for an unpublished Russian translation. Sitemap and language switcher continue to list only actual published translations.

- [ ] **Step 6: Run repository and route tests**

Run: `pnpm --filter @anshow/backend exec vitest run src/content/public-repository.test.ts src/public/content-routes.test.ts`

Expected: PASS.

- [ ] **Step 7: Regenerate OpenAPI types and commit**

Run: `pnpm openapi:generate && pnpm openapi:check`

```bash
git add backend/src/content backend/src/public openapi/anshow.json frontend/src/generated/api.ts
git commit -m "Expose the complete published company story through typed APIs"
```

### Task 6: Make Production Migration Initialize and Upgrade Content

**Files:**
- Modify: `backend/src/db/migration-runner.ts`
- Modify: `backend/src/db/migrate.integration.test.ts`
- Modify: `backend/src/db/migrate.ts`

- [ ] **Step 1: Extend integration tests for empty and old databases**

```ts
it("migrates an empty database and publishes the PPT baseline", async () => {
  await migrateAndInitializeDatabase({ databaseUrl });
  expect(countRows(databaseUrl, "case_studies")).toBe(8);
  expect(countRows(databaseUrl, "certificates")).toBe(4);
});

it("upgrades untouched old seed rows but preserves edited rows", async () => {
  await prepareOldSeedDatabase(databaseUrl);
  editServiceTitle(databaseUrl, "ocean-freight", "Operator title");
  await migrateAndInitializeDatabase({ databaseUrl });
  expect(readTitle(databaseUrl, "ocean-freight")).toBe("Operator title");
  expect(readTitle(databaseUrl, "air-freight")).toContain("Time-Critical");
});
```

- [ ] **Step 2: Run and verify failure**

Run: `pnpm --filter @anshow/backend exec vitest run src/db/migrate.integration.test.ts`

Expected: FAIL until the revision-aware result is wired through the production runner.

- [ ] **Step 3: Invoke migrations, catalog validation, and seeding in order**

`migrateAndInitializeDatabase()` must open one application database, run Drizzle migrations, call `seedPublicContent`, log the result summary, and close only when it owns the connection.

- [ ] **Step 4: Run backend verification**

Run: `pnpm --filter @anshow/backend test && pnpm --filter @anshow/backend lint && pnpm --filter @anshow/backend typecheck && pnpm --filter @anshow/backend build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/db
git commit -m "Make every deployed database start with the approved company content"
```
