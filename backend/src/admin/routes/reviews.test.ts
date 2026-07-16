import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../app.js";
import type { ReviewRepository } from "../repositories/review-repository.js";

function repository(): ReviewRepository {
  return {
    list: vi.fn(() => []),
    submit: vi.fn(async () => ({ id: "review-1", entityType: "services", entityId: "content-1", sourceVersion: 3, submittedBy: "editor-1", reviewerId: null, decision: "pending" as const, reason: null, submittedAt: new Date(), decidedAt: null })),
    approve: vi.fn(() => ({ review: {} as never, workflow: {} as never })),
    reject: vi.fn(() => ({ review: {} as never, workflow: {} as never })),
    workflow: vi.fn(() => undefined),
  };
}

describe("review routes", () => {
  it("submits content with content.submit permission", async () => {
    const reviewRepository = repository();
    const app = createApp({ reviewRepository, getSession: async () => ({ user: { id: "editor-1", email: "editor@example.test" } }), getPermissions: () => ["content.submit"] });
    const response = await app.request("/api/admin/reviews/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ collection: "services", id: "content-1", expectedVersion: 2 }) });
    expect(response.status).toBe(201);
    expect(reviewRepository.submit).toHaveBeenCalledWith({ collection: "services", id: "content-1", expectedVersion: 2, submittedBy: "editor-1" });
  });

  it("blocks review decisions without content.review", async () => {
    const reviewRepository = repository();
    const app = createApp({ reviewRepository, getSession: async () => ({ user: { id: "editor-1", email: "editor@example.test" } }), getPermissions: () => ["content.submit"] });
    const response = await app.request("/api/admin/reviews/review-1/approve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: 3 }) });
    expect(response.status).toBe(403);
    expect(reviewRepository.approve).not.toHaveBeenCalled();
  });
});
