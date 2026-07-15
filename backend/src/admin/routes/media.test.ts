import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../app.js";
import {
  MediaRepositoryError,
  type AdminMediaAsset,
} from "../repositories/media-repository.js";
import type { MediaService } from "../../media/media-service.js";

const MEDIA_ID = "11111111-1111-4111-8111-111111111111";
const asset = {
  id: MEDIA_ID,
  storageKey: `${MEDIA_ID}/generation/master.jpg`,
  mimeType: "image/jpeg",
  width: 1200,
  height: 800,
  dominantColor: "#334455",
  focalX: 0.5,
  focalY: 0.5,
  alt: { en: "Truck", zh: "卡车", ru: "Грузовик" },
  derivatives: [
    {
      id: "derivative-1",
      storageKey: `${MEDIA_ID}/generation/480.webp`,
      url: `/media/${MEDIA_ID}/generation/480.webp`,
      format: "webp",
      width: 480,
      height: 320,
      byteSize: 12_000,
    },
  ],
  createdAt: "2026-07-15T04:00:00.000Z",
  replacedAt: null,
  references: [],
  referenceCount: 0,
} as const satisfies AdminMediaAsset;

function fakeService(overrides: Partial<MediaService> = {}) {
  const unavailable = async () => {
    throw new Error("not configured");
  };
  return {
    list: vi.fn(async () => [asset]),
    get: vi.fn(async () => asset),
    upload: vi.fn(unavailable),
    updateMetadata: vi.fn(unavailable),
    replace: vi.fn(unavailable),
    delete: vi.fn(unavailable),
    ...overrides,
  } satisfies MediaService;
}

const session = async () => ({
  user: { id: "staff-1", email: "staff@example.test" },
});

function multipartRequest(path: string) {
  const form = new FormData();
  form.set("file", new File([new Uint8Array([1, 2, 3])], "yard.png", { type: "image/png" }));
  form.set("altEn", "Truck at the warehouse");
  form.set("altZh", "仓库中的卡车");
  form.set("altRu", "Грузовик на складе");
  form.set("focalX", "0.4");
  form.set("focalY", "0.6");
  return new Request(`http://localhost${path}`, { method: "POST", body: form });
}

describe("administration media routes", () => {
  it("short-circuits unauthenticated multipart requests before service or body parsing", async () => {
    const mediaService = fakeService();
    const app = createApp({ mediaService });
    const request = new Request("http://localhost/api/admin/media", {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=never-read",
        "content-length": String(25 * 1024 * 1024),
      },
      body: "unparsed",
    });

    const response = await app.request(request);

    expect(response.status).toBe(401);
    expect(mediaService.upload).not.toHaveBeenCalled();
  });

  it("enforces media.read and returns the typed list envelope", async () => {
    const mediaService = fakeService();
    const forbidden = createApp({
      mediaService,
      getSession: session,
      getPermissions: () => [],
    });
    expect((await forbidden.request("/api/admin/media")).status).toBe(403);
    expect(mediaService.list).not.toHaveBeenCalled();

    const app = createApp({
      mediaService,
      getSession: session,
      getPermissions: () => ["media.read"],
    });
    const response = await app.request("/api/admin/media");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [asset],
      error: null,
      requestId: response.headers.get("x-request-id"),
    });
  });

  it("accepts canonical multipart upload metadata and passes decoded bytes to the service", async () => {
    const mediaService = fakeService({ upload: vi.fn(async () => asset) });
    const app = createApp({
      mediaService,
      getSession: session,
      getPermissions: () => ["media.write"],
    });

    const response = await app.request(multipartRequest("/api/admin/media"));

    expect(response.status).toBe(201);
    expect(mediaService.upload).toHaveBeenCalledWith(
      expect.objectContaining({ name: "yard.png", type: "image/png" }),
      {
        alt: {
          en: "Truck at the warehouse",
          zh: "仓库中的卡车",
          ru: "Грузовик на складе",
        },
        focalX: 0.4,
        focalY: 0.6,
      },
      "staff-1",
    );
    expect((mediaService.upload as ReturnType<typeof vi.fn>).mock.calls[0]![0].bytes).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it("rejects oversized multipart content before buffering", async () => {
    const mediaService = fakeService();
    const app = createApp({
      mediaService,
      getSession: session,
      getPermissions: () => ["media.write"],
    });
    const response = await app.request(
      new Request("http://localhost/api/admin/media", {
        method: "POST",
        headers: {
          "content-type": "multipart/form-data; boundary=never-read",
          "content-length": String(21 * 1024 * 1024),
        },
        body: "unparsed",
      }),
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: { code: "MEDIA_TOO_LARGE" },
    });
    expect(mediaService.upload).not.toHaveBeenCalled();
  });

  it("validates metadata and canonical UUID route parameters", async () => {
    const mediaService = fakeService();
    const app = createApp({
      mediaService,
      getSession: session,
      getPermissions: () => ["media.write"],
    });
    const invalidMetadata = new FormData();
    invalidMetadata.set("file", new File([new Uint8Array([1])], "photo.jpg"));

    const metadataResponse = await app.request(
      new Request("http://localhost/api/admin/media", {
        method: "POST",
        body: invalidMetadata,
      }),
    );
    const idResponse = await app.request("/api/admin/media/not-a-uuid", {
      method: "DELETE",
    });

    expect(metadataResponse.status).toBe(400);
    expect(idResponse.status).toBe(400);
    expect(mediaService.upload).not.toHaveBeenCalled();
    expect(mediaService.delete).not.toHaveBeenCalled();
  });

  it("maps referenced deletion to 409 with the exact reference list", async () => {
    const references = [
      { entityType: "hero-slide", entityId: "hero-1", field: "image" },
    ];
    const mediaService = fakeService({
      delete: vi.fn(async () => {
        throw new MediaRepositoryError(
          "MEDIA_IN_USE",
          "Media is referenced and cannot be deleted",
          references,
        );
      }),
    });
    const app = createApp({
      mediaService,
      getSession: session,
      getPermissions: () => ["media.write"],
    });

    const response = await app.request(`/api/admin/media/${MEDIA_ID}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "MEDIA_IN_USE", details: { references } },
    });
  });
});
