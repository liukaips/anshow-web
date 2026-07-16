import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../app.js";
import type { PreviewService } from "../../preview/preview-service.js";

const payload = { homes: { en: { locale: "en" as const, headline: "Preview", slides: [], services: [], tradeLanes: [], cargoTypes: [], proof: [], verifiedTrust: [], certificates: [], cases: [], articles: [], channels: [] }, zh: { locale: "zh" as const, headline: "预览", slides: [], services: [], tradeLanes: [], cargoTypes: [], proof: [], verifiedTrust: [], certificates: [], cases: [], articles: [], channels: [] }, ru: { locale: "ru" as const, headline: "Предпросмотр", slides: [], services: [], tradeLanes: [], cargoTypes: [], proof: [], verifiedTrust: [], certificates: [], cases: [], articles: [], channels: [] } }, collections: { services: { en: [], zh: [], ru: [] }, "trade-lanes": { en: [], zh: [], ru: [] }, "special-cargo": { en: [], zh: [], ru: [] }, insights: { en: [], zh: [], ru: [] }, "case-studies": { en: [], zh: [], ru: [] }, pages: { en: [], zh: [], ru: [] } }, sitemap: [] };

function service(): PreviewService {
  return {
    createSnapshot: vi.fn(async () => ({ snapshotId: "snapshot-1", tokenId: "token-1", rawToken: "raw-token", contentHash: "a".repeat(64), sourceVersions: [], createdAt: new Date(), expiresAt: new Date(Date.now() + 3_600_000) })),
    readSnapshot: vi.fn(() => ({ id: "snapshot-1", payload, contentHash: "a".repeat(64), sourceVersions: [], createdBy: "staff-1", createdAt: new Date(), expiresAt: new Date(Date.now() + 3_600_000), publishedAt: null })),
    revoke: vi.fn(),
    list: vi.fn(() => []),
  };
}

describe("preview routes", () => {
  it("creates an authenticated preview link and serves it without caching", async () => {
    const previewService = service();
    const app = createApp({ previewService, getSession: async () => ({ user: { id: "staff-1", email: "staff@example.test" } }), getPermissions: () => ["preview.create"] });
    const created = await app.request("/api/admin/previews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expiresInHours: 24 }) });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ data: { rawToken: "raw-token" } });

    const publicResponse = await app.request("/api/public/preview/raw-token/zh");
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.headers.get("cache-control")).toBe("private, no-store");
    expect(publicResponse.headers.get("x-robots-tag")).toBe("noindex, noarchive");
    expect(await publicResponse.json()).toMatchObject({ data: { home: { headline: "预览" } } });
  });
});
