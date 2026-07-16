import { describe, expect, it } from "vitest";

import type { PublicContentRepository } from "../content/public-repository.js";
import { createTestDatabase } from "../db/test-db.js";
import { contentWorkflow, previewTokens } from "../db/schema/workflow.js";
import { createPreviewService } from "./preview-service.js";

function repository(): PublicContentRepository {
  let headline = "预览标题";
  return {
    getHome: async (locale) => ({ locale, headline, slides: [], services: [], tradeLanes: [], cargoTypes: [], proof: [], verifiedTrust: [], certificates: [], cases: [], articles: [], channels: [] }),
    listCollection: async () => [],
    getBySlug: async () => null,
    listSitemap: async () => [],
    // Test-only mutation stays outside the service contract.
    set headline(value: string) { headline = value; },
  } as PublicContentRepository & { headline: string };
}

describe("preview service", () => {
  it("captures only approved versions in the publishable change set", async () => {
    const context = createTestDatabase();
    try {
      const updatedAt = new Date("2026-07-15T04:00:00Z");
      context.db.insert(contentWorkflow).values([
        { entityType: "services", entityId: "approved-1", state: "approved", version: 3, updatedAt },
        { entityType: "services", entityId: "draft-1", state: "draft", version: 4, updatedAt },
        { entityType: "articles", entityId: "published-1", state: "published", version: 2, updatedAt },
      ]).run();
      const service = createPreviewService(context.db, repository(), {
        now: () => updatedAt,
        token: () => "approved-change-token",
      });

      const created = await service.createSnapshot({ createdBy: "staff-1", expiresInHours: 24 });

      expect(created.sourceVersions).toEqual([
        { entityType: "services", entityId: "approved-1", version: 3 },
      ]);
    } finally {
      context.close();
    }
  });

  it("keeps snapshots immutable and stores only a token hash", async () => {
    const context = createTestDatabase();
    try {
      const content = repository() as PublicContentRepository & { headline: string };
      const service = createPreviewService(context.db, content, { createId: (() => { let id = 0; return () => `preview-${++id}`; })(), now: () => new Date("2026-07-15T04:00:00Z"), token: () => "raw-preview-token" });
      const created = await service.createSnapshot({ createdBy: "staff-1", expiresInHours: 24 });
      content.headline = "修改后的标题";
      const read = service.readSnapshot(created.rawToken);
      expect(read?.payload.homes.zh.headline).toBe("预览标题");
      expect(context.db.select().from(previewTokens).get()?.tokenHash).not.toContain(created.rawToken);
      expect(created.contentHash).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      context.close();
    }
  });

  it("rejects expired and revoked links", async () => {
    const context = createTestDatabase();
    try {
      let current = new Date("2026-07-15T04:00:00Z");
      let token = 0;
      const service = createPreviewService(context.db, repository(), { now: () => current, token: () => `revocable-token-${++token}` });
      const created = await service.createSnapshot({ createdBy: "staff-1", expiresInHours: 1 });
      service.revoke(created.tokenId);
      expect(service.readSnapshot(created.rawToken)).toBeNull();
      const next = await service.createSnapshot({ createdBy: "staff-1", expiresInHours: 1 });
      current = new Date("2026-07-15T06:00:00Z");
      expect(service.readSnapshot(next.rawToken)).toBeNull();
    } finally {
      context.close();
    }
  });
});
