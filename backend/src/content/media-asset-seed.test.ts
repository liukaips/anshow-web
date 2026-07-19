import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createTestDatabase } from "../db/test-db.js";
import { mediaAssets, mediaDerivatives, services } from "../db/schema/index.js";
import { seedManifestMediaAssets } from "./media-asset-seed.js";
import { seedPublicContent } from "./seed.js";

const NOW = new Date("2026-07-14T12:00:00.000Z");

describe("manifest media asset seed", () => {
  it("registers built-in manifest media before content seeding resolves media IDs", async () => {
    const testDatabase = createTestDatabase();
    const directory = await mkdtemp(join(tmpdir(), "anshow-media-manifest-"));
    const manifestPath = join(directory, "manifest.json");

    try {
      await writeFile(
        manifestPath,
        JSON.stringify([
          {
            id: "service-customs",
            width: 2048,
            height: 1152,
            dominantColor: "rgb(8 8 8)",
            variants: [
              {
                width: 1280,
                height: 720,
                format: "avif",
                byteSize: 41291,
                url: "/media/service-customs/desktop-1280.example.avif",
                role: "desktop",
              },
              {
                width: 1280,
                height: 720,
                format: "webp",
                byteSize: 50456,
                url: "/media/service-customs/desktop-1280.example.webp",
                role: "desktop",
              },
            ],
          },
        ]),
      );

      await seedManifestMediaAssets(testDatabase.db, { manifestPath, now: NOW });
      seedPublicContent(testDatabase.db, { now: NOW });

      expect(
        testDatabase.db
          .select({ id: mediaAssets.id, storageKey: mediaAssets.storageKey })
          .from(mediaAssets)
          .where(eq(mediaAssets.id, "service-customs"))
          .get(),
      ).toEqual({
        id: "service-customs",
        storageKey: "builtin/service-customs",
      });
      expect(
        testDatabase.db
          .select({ url: mediaDerivatives.url })
          .from(mediaDerivatives)
          .where(eq(mediaDerivatives.mediaId, "service-customs"))
          .all()
          .map((row) => row.url)
          .sort(),
      ).toEqual([
        "/media/service-customs/desktop-1280.example.avif",
        "/media/service-customs/desktop-1280.example.webp",
      ]);
      expect(
        testDatabase.db
          .select({ mediaId: services.mediaId })
          .from(services)
          .where(eq(services.code, "customs-origin"))
          .get(),
      ).toEqual({ mediaId: "service-customs" });
    } finally {
      testDatabase.close();
    }
  });
});
