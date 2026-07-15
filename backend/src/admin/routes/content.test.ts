import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../app.js";
import type { PermissionKey } from "../../auth/permissions.js";
import {
  ContentRepositoryError,
  type AdminContentItem,
  type ContentRepository,
} from "../repositories/content-repository.js";

const ITEM: AdminContentItem = {
  id: "content-1",
  code: "freight-service",
  sortOrder: 0,
  archivedAt: null,
  verified: false,
  verificationSource: null,
  createdAt: "2026-07-15T04:00:00.000Z",
  updatedAt: "2026-07-15T04:00:00.000Z",
  translations: {
    en: {
      locale: "en",
      status: "draft",
      scheduledAt: null,
      publishedAt: null,
      title: "Freight service",
      slug: "freight-service",
      summary: "A complete summary.",
      body: "A complete body.",
      seoTitle: "Freight service",
      seoDescription: "A complete search description.",
      altText: "Cargo being handled at a terminal",
      updatedAt: "2026-07-15T04:00:00.000Z",
    },
  },
};

const translationInput = {
  title: "Freight service",
  slug: "freight-service",
  summary: "A complete summary.",
  body: "A complete body.",
  seoTitle: "Freight service",
  seoDescription: "A complete search description.",
  altText: "Cargo being handled at a terminal",
};

function createFakeRepository(): ContentRepository & {
  [Key in keyof ContentRepository]: ReturnType<
    typeof vi.fn<ContentRepository[Key]>
  >;
} {
  return {
    list: vi.fn(async () => [ITEM]),
    get: vi.fn(async () => ITEM),
    create: vi.fn(async () => ITEM),
    saveDraft: vi.fn(async () => ITEM),
    publish: vi.fn(async () => ITEM),
    schedule: vi.fn(async () => ITEM),
    archive: vi.fn(async () => ITEM),
  };
}

const session = async () => ({
  user: { id: "staff-1", email: "staff@example.test" },
});

function jsonRequest(path: string, method: "POST" | "PUT", body: unknown) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createAuthorizedApp(
  repository: ContentRepository,
  permissions: readonly PermissionKey[] = [
    "content.read",
    "content.write",
    "content.publish",
  ],
) {
  return createApp({
    contentRepository: repository,
    getSession: session,
    getPermissions: () => permissions,
  });
}

describe("administration content routes", () => {
  it("short-circuits unauthenticated requests before repository access", async () => {
    const repository = createFakeRepository();
    const app = createApp({ contentRepository: repository });

    const response = await app.request("/api/admin/content/services");

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      data: null,
      error: { code: "UNAUTHENTICATED" },
    });
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("allows an editor to read and save but blocks publishing before repository access", async () => {
    const repository = createFakeRepository();
    const app = createAuthorizedApp(repository, [
      "content.read",
      "content.write",
    ]);

    expect(
      (await app.request("/api/admin/content/services")).status,
    ).toBe(200);
    expect(
      (
        await app.request(
          jsonRequest(
            "/api/admin/content/services/content-1/translations/en",
            "PUT",
            translationInput,
          ),
        )
      ).status,
    ).toBe(200);

    const publishResponse = await app.request(
      jsonRequest(
        "/api/admin/content/services/content-1/translations/en/publish",
        "POST",
        {},
      ),
    );
    expect(publishResponse.status).toBe(403);
    expect(await publishResponse.json()).toMatchObject({
      error: { code: "FORBIDDEN" },
    });
    expect(repository.publish).not.toHaveBeenCalled();
  });

  it("supports list, detail, create, draft, schedule, publish, and archive with the actor", async () => {
    const repository = createFakeRepository();
    const app = createAuthorizedApp(repository);

    const listResponse = await app.request("/api/admin/content/services");
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toMatchObject({ data: [ITEM], error: null });

    const detailResponse = await app.request(
      "/api/admin/content/services/content-1",
    );
    expect(detailResponse.status).toBe(200);

    const createResponse = await app.request(
      jsonRequest("/api/admin/content/services", "POST", {
        code: "freight-service",
      }),
    );
    expect(createResponse.status).toBe(201);
    expect(repository.create).toHaveBeenCalledWith(
      "services",
      { code: "freight-service" },
      "staff-1",
    );

    const draftResponse = await app.request(
      jsonRequest(
        "/api/admin/content/services/content-1/translations/ru",
        "PUT",
        translationInput,
      ),
    );
    expect(draftResponse.status).toBe(200);
    expect(repository.saveDraft).toHaveBeenCalledWith(
      "services",
      "content-1",
      "ru",
      translationInput,
      "staff-1",
    );

    const scheduledAt = "2026-07-16T04:00:00.000Z";
    const scheduleResponse = await app.request(
      jsonRequest(
        "/api/admin/content/services/content-1/translations/ru/schedule",
        "POST",
        { scheduledAt },
      ),
    );
    expect(scheduleResponse.status).toBe(200);
    expect(repository.schedule).toHaveBeenCalledWith(
      "services",
      "content-1",
      "ru",
      scheduledAt,
      "staff-1",
    );

    const publishResponse = await app.request(
      jsonRequest(
        "/api/admin/content/services/content-1/translations/ru/publish",
        "POST",
        {},
      ),
    );
    expect(publishResponse.status).toBe(200);
    expect(repository.publish).toHaveBeenCalledWith(
      "services",
      "content-1",
      "ru",
      "staff-1",
    );

    const archiveResponse = await app.request(
      jsonRequest(
        "/api/admin/content/services/content-1/archive",
        "POST",
        {},
      ),
    );
    expect(archiveResponse.status).toBe(200);
    expect(repository.archive).toHaveBeenCalledWith(
      "services",
      "content-1",
      "staff-1",
    );
  });

  it.each([
    ["invalid collection", "/api/admin/content/not-a-collection"],
    [
      "invalid locale",
      "/api/admin/content/services/content-1/translations/fr",
    ],
  ])("rejects an %s path parameter", async (_case, path) => {
    const repository = createFakeRepository();
    const app = createAuthorizedApp(repository);
    const response = path.endsWith("fr")
      ? await app.request(jsonRequest(path, "PUT", translationInput))
      : await app.request(path);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("rejects invalid draft bodies before repository access", async () => {
    const repository = createFakeRepository();
    const app = createAuthorizedApp(repository);
    const response = await app.request(
      jsonRequest(
        "/api/admin/content/services/content-1/translations/en",
        "PUT",
        { ...translationInput, slug: "Upper Case" },
      ),
    );

    expect(response.status).toBe(400);
    expect(repository.saveDraft).not.toHaveBeenCalled();
  });

  it.each([
    ["CONTENT_NOT_FOUND", 404],
    ["SLUG_CONFLICT", 409],
    ["PROOF_NOT_VERIFIED", 409],
  ] as const)("maps %s to %i", async (code, status) => {
    const repository = createFakeRepository();
    repository.get.mockRejectedValueOnce(
      new ContentRepositoryError(code, "Mapped domain error"),
    );
    const app = createAuthorizedApp(repository);

    const response = await app.request(
      "/api/admin/content/services/content-1",
    );

    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({
      data: null,
      error: { code, message: "Mapped domain error" },
      requestId: response.headers.get("x-request-id"),
    });
  });

  it("returns the exact proof conflict from the publish endpoint", async () => {
    const repository = createFakeRepository();
    repository.publish.mockRejectedValueOnce(
      new ContentRepositoryError(
        "PROOF_NOT_VERIFIED",
        "Verified proof and a source note are required before publication",
      ),
    );
    const app = createAuthorizedApp(repository);

    const response = await app.request(
      jsonRequest(
        "/api/admin/content/partners/content-1/translations/en/publish",
        "POST",
        {},
      ),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      data: null,
      error: { code: "PROOF_NOT_VERIFIED" },
      requestId: response.headers.get("x-request-id"),
    });
  });
});
