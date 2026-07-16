import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../app.js";
import type { PermissionKey } from "../../auth/permissions.js";
import {
  ContentRepositoryError,
  type AdminContentItem,
  type ContentRepository,
} from "../repositories/content-repository.js";

const CONTENT_ID = "00000000-0000-4000-8000-000000000001";
const ITEM: AdminContentItem = {
  id: CONTENT_ID,
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
    updateVerification: vi.fn<ContentRepository["updateVerification"]>(
      async () => ITEM,
    ),
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
            `/api/admin/content/services/${CONTENT_ID}/translations/en`,
            "PUT",
            translationInput,
          ),
        )
      ).status,
    ).toBe(200);

    const publishResponse = await app.request(
      jsonRequest(
        `/api/admin/content/services/${CONTENT_ID}/translations/en/publish`,
        "POST",
        translationInput,
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
      `/api/admin/content/services/${CONTENT_ID}`,
    );
    expect(detailResponse.status).toBe(200);

    const createResponse = await app.request(
      jsonRequest("/api/admin/content/services", "POST", {
        titleZh: "冷链运输服务",
      }),
    );
    expect(createResponse.status).toBe(201);
    expect(repository.create).toHaveBeenCalledWith(
      "services",
      { titleZh: "冷链运输服务" },
      "staff-1",
    );

    const draftResponse = await app.request(
      jsonRequest(
        `/api/admin/content/services/${CONTENT_ID}/translations/ru`,
        "PUT",
        translationInput,
      ),
    );
    expect(draftResponse.status).toBe(200);
    expect(repository.saveDraft).toHaveBeenCalledWith(
      "services",
      CONTENT_ID,
      "ru",
      translationInput,
      "staff-1",
    );

    const scheduledAt = "2026-07-16T04:00:00.000Z";
    const scheduleResponse = await app.request(
      jsonRequest(
        `/api/admin/content/services/${CONTENT_ID}/translations/ru/schedule`,
        "POST",
        { ...translationInput, scheduledAt },
      ),
    );
    expect(scheduleResponse.status).toBe(200);
    expect(repository.schedule).toHaveBeenCalledWith(
      "services",
      CONTENT_ID,
      "ru",
      { ...translationInput, scheduledAt },
      "staff-1",
    );

    const publishResponse = await app.request(
      jsonRequest(
        `/api/admin/content/services/${CONTENT_ID}/translations/ru/publish`,
        "POST",
        translationInput,
      ),
    );
    expect(publishResponse.status).toBe(200);
    expect(repository.publish).toHaveBeenCalledWith(
      "services",
      CONTENT_ID,
      "ru",
      translationInput,
      "staff-1",
    );

    const archiveResponse = await app.request(
      jsonRequest(
        `/api/admin/content/services/${CONTENT_ID}/archive`,
        "POST",
        {},
      ),
    );
    expect(archiveResponse.status).toBe(200);
    expect(repository.archive).toHaveBeenCalledWith(
      "services",
      CONTENT_ID,
      "staff-1",
    );
  });

  it.each([
    ["invalid collection", "/api/admin/content/not-a-collection"],
    [
      "invalid locale",
      `/api/admin/content/services/${CONTENT_ID}/translations/fr`,
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
        `/api/admin/content/services/${CONTENT_ID}/translations/en`,
        "PUT",
        { ...translationInput, slug: "Upper Case" },
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { fields: { slug: expect.any(Array) } },
    });
    expect(repository.saveDraft).not.toHaveBeenCalled();
  });

  it.each([
    ["blank title", { titleZh: "   " }],
    ["client code", { titleZh: "冷链运输服务", code: "manual-code" }],
  ])("rejects %s during content creation", async (_case, input) => {
    const repository = createFakeRepository();
    const app = createAuthorizedApp(repository);

    const response = await app.request(
      jsonRequest("/api/admin/content/services", "POST", input),
    );

    expect(response.status).toBe(400);
    expect(repository.create).not.toHaveBeenCalled();
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
      `/api/admin/content/services/${CONTENT_ID}`,
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
        `/api/admin/content/partners/${CONTENT_ID}/translations/en/publish`,
        "POST",
        translationInput,
      ),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      data: null,
      error: { code: "PROOF_NOT_VERIFIED" },
      requestId: response.headers.get("x-request-id"),
    });
  });

  it("allows a content.publish-only actor to publish submitted content", async () => {
    const repository = createFakeRepository();
    const app = createAuthorizedApp(repository, ["content.publish"]);

    const response = await app.request(
      jsonRequest(
        `/api/admin/content/services/${CONTENT_ID}/translations/en/publish`,
        "POST",
        translationInput,
      ),
    );

    expect(response.status).toBe(200);
    expect(repository.publish).toHaveBeenCalledWith(
      "services",
      CONTENT_ID,
      "en",
      translationInput,
      "staff-1",
    );
    expect(repository.saveDraft).not.toHaveBeenCalled();
  });

  it("updates proof verification with content.write and the actor", async () => {
    const repository = createFakeRepository();
    const app = createAuthorizedApp(repository, ["content.write"]);
    const input = {
      verified: true,
      verificationSource: "Official registry record",
    };

    const response = await app.request(
      jsonRequest(
        `/api/admin/content/partners/${CONTENT_ID}/verification`,
        "PUT",
        input,
      ),
    );

    expect(response.status).toBe(200);
    expect(repository.updateVerification).toHaveBeenCalledWith(
      "partners",
      CONTENT_ID,
      input,
      "staff-1",
    );
  });

  it("blocks verification without content.write before repository access", async () => {
    const repository = createFakeRepository();
    const app = createAuthorizedApp(repository, ["content.publish"]);

    const response = await app.request(
      jsonRequest(
        `/api/admin/content/certificates/${CONTENT_ID}/verification`,
        "PUT",
        { verified: true, verificationSource: "Official register" },
      ),
    );

    expect(response.status).toBe(403);
    expect(repository.updateVerification).not.toHaveBeenCalled();
  });

  it("rejects verified proof without a source before repository access", async () => {
    const repository = createFakeRepository();
    const app = createAuthorizedApp(repository, ["content.write"]);

    const response = await app.request(
      jsonRequest(
        `/api/admin/content/proof-metrics/${CONTENT_ID}/verification`,
        "PUT",
        { verified: true, verificationSource: "   " },
      ),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { fields: { verificationSource: expect.any(Array) } },
    });
    expect(repository.updateVerification).not.toHaveBeenCalled();
  });

  it.each([
    ["bad_id", "id"],
    ["../content", "collection"],
    ["Uppercase-ID", "id"],
    ["space%20id", "id"],
  ])("rejects malformed content id %s with a stable 400", async (id, field) => {
    const repository = createFakeRepository();
    const app = createAuthorizedApp(repository);

    const response = await app.request(`/api/admin/content/services/${id}`);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      data: null,
      error: {
        code: "VALIDATION_ERROR",
        fields: { [field]: expect.any(Array) },
      },
    });
    expect(repository.get).not.toHaveBeenCalled();
  });

  it("accepts existing canonical code identifiers", async () => {
    const repository = createFakeRepository();
    const app = createAuthorizedApp(repository);

    const response = await app.request(
      "/api/admin/content/services/service-ocean",
    );

    expect(response.status).toBe(200);
    expect(repository.get).toHaveBeenCalledWith("services", "service-ocean");
  });
});
