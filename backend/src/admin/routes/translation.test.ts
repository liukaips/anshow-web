import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../app.js";
import type { TranslationService } from "../../translation/translation-service.js";

function service(): TranslationService {
  return {
    generate: vi.fn(async () => ({ sourceVersion: 2, jobs: [], item: {} as never })),
    listJobs: vi.fn(() => []),
  };
}

describe("admin translation routes", () => {
  it("requires content.write", async () => {
    const translationService = service();
    const app = createApp({
      translationService,
      getSession: async () => ({ user: { id: "staff-1", email: "staff@example.test" } }),
      getPermissions: () => ["content.read"],
    });
    const response = await app.request("/api/admin/content/services/content-1/translations/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targets: ["en", "ru"] }) });
    expect(response.status).toBe(403);
    expect(translationService.generate).not.toHaveBeenCalled();
  });

  it("starts translation for the authenticated actor", async () => {
    const translationService = service();
    const app = createApp({
      translationService,
      getSession: async () => ({ user: { id: "staff-1", email: "staff@example.test" } }),
      getPermissions: () => ["content.write"],
    });
    const response = await app.request("/api/admin/content/services/content-1/translations/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targets: ["en", "ru"], sourceVersion: 2 }) });
    expect(response.status).toBe(200);
    expect(translationService.generate).toHaveBeenCalledWith({ collection: "services", id: "content-1", actorId: "staff-1", targets: ["en", "ru"], sourceVersion: 2 });
  });
});
