import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  buildAssets,
  derivativePlan,
  processAsset,
  verifyAssets,
} from "./process-images";

async function createMaster(
  rootDir: string,
  id: string,
  width: number,
  height: number,
  color: { b: number; g: number; r: number },
) {
  const sourceDir = path.join(rootDir, "assets/source");
  await fs.mkdir(sourceDir, { recursive: true });
  await sharp({ create: { width, height, channels: 3, background: color } })
    .withMetadata({ orientation: 6 })
    .png()
    .toFile(path.join(sourceDir, `${id}.png`));
}

async function writePrompts(rootDir: string, ids: string[]) {
  const contentDir = path.join(rootDir, "content/assets");
  await fs.mkdir(contentDir, { recursive: true });
  await fs.writeFile(
    path.join(contentDir, "prompts.json"),
    `${JSON.stringify(
      ids.map((id) => ({ id, use: "test fixture", prompt: `Approved prompt for ${id}` })),
      null,
      2,
    )}\n`,
  );
}

describe("derivativePlan", () => {
  it("creates desktop and mobile hero variants", () => {
    expect(derivativePlan("hero-ocean", "hero")).toEqual([
      "480.avif",
      "768.avif",
      "1280.avif",
      "1920.avif",
      "480.webp",
      "768.webp",
      "1280.webp",
      "1920.webp",
      "mobile-768.avif",
      "mobile-768.webp",
      "thumb-320.avif",
    ]);
  });
});

describe("generation prompts", () => {
  it("defines the exact 23 approved production assets", async () => {
    const promptPath = path.join(process.cwd(), "content/assets/prompts.json");
    const prompts = JSON.parse(await fs.readFile(promptPath, "utf8")) as Array<{
      id: string;
      prompt: string;
      use: string;
    }>;

    expect(prompts.map(({ id }) => id)).toEqual([
      "hero-ocean",
      "hero-air",
      "hero-rail",
      "hero-road",
      "service-ocean",
      "service-air",
      "service-rail",
      "service-road",
      "service-multimodal",
      "service-customs",
      "service-warehouse",
      "lane-china-russia",
      "lane-china-europe",
      "lane-central-asia",
      "lane-global",
      "cargo-project",
      "cargo-oversized",
      "cargo-dangerous",
      "cargo-cold-chain",
      "trust-operations",
      "trust-warehouse",
      "trust-customs",
      "trust-coordination",
    ]);
    expect(new Set(prompts.map(({ id }) => id)).size).toBe(23);
    expect(prompts.every(({ prompt, use }) => prompt.length > 0 && use.length > 0)).toBe(true);
  });
});

describe("processAsset", () => {
  it("writes hashed content derivatives within their byte budgets", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "anshow-assets-"));

    try {
      await createMaster(rootDir, "service-ocean", 1400, 900, { r: 16, g: 54, b: 75 });

      const record = await processAsset("service-ocean", "content", { rootDir });

      expect(record).toMatchObject({
        id: "service-ocean",
        width: 1400,
        height: 900,
      });
      expect(record.dominantColor).toMatch(/^rgb\(\d{1,3} \d{1,3} \d{1,3}\)$/);
      expect(record.variants).toHaveLength(7);
      for (const variant of record.variants) {
        const relativePath = variant.url.replace(/^\//, "");
        const target = path.join(rootDir, "frontend/public", relativePath);
        const bytes = await fs.readFile(target);
        const metadata = await sharp(bytes).metadata();
        const budget = variant.role === "thumbnail" ? 35 * 1024 : 90 * 1024;

        expect(path.basename(target)).toMatch(
          /^(desktop|thumbnail)-\d+\.[a-f0-9]{12}\.(avif|webp)$/,
        );
        expect(bytes.byteLength).toBe(variant.byteSize);
        expect(bytes.byteLength).toBeLessThanOrEqual(budget);
        expect(metadata.exif).toBeUndefined();
        expect(metadata.width).toBe(variant.width);
        expect(metadata.height).toBe(variant.height);
      }
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("requires a separately composed mobile master for hero assets", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "anshow-assets-"));

    try {
      await createMaster(rootDir, "hero-ocean", 1920, 1080, { r: 12, g: 38, b: 52 });

      await expect(processAsset("hero-ocean", "hero", { rootDir })).rejects.toThrow(
        /hero-ocean-mobile\.png/,
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });
});

describe("asset build", () => {
  it("publishes a complete manifest before removing stale hashed derivatives", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "anshow-assets-"));
    const outputDir = path.join(rootDir, "frontend/public/media/service-ocean");
    const staleFile = path.join(outputDir, "desktop-480.aaaaaaaaaaaa.avif");
    const unrelatedFile = path.join(outputDir, "notes.txt");

    try {
      await writePrompts(rootDir, ["service-ocean"]);
      await createMaster(rootDir, "service-ocean", 1400, 900, { r: 16, g: 54, b: 75 });
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(staleFile, "stale");
      await fs.writeFile(unrelatedFile, "keep");

      const records = await buildAssets({ rootDir });
      const persisted = JSON.parse(
        await fs.readFile(path.join(rootDir, "content/assets/manifest.json"), "utf8"),
      );
      const summary = await verifyAssets({ rootDir });

      expect(persisted).toEqual(records);
      expect(summary).toEqual({
        completeSourceRecords: 1,
        expectedSourceRecords: 1,
        budgetViolations: {
          desktopHero: 0,
          mobileHero: 0,
          content: 0,
          thumbnail: 0,
        },
        violations: [],
      });
      await expect(fs.access(staleFile)).rejects.toThrow();
      await expect(fs.readFile(unrelatedFile, "utf8")).resolves.toBe("keep");
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("preserves the previous manifest and derivatives when preflight fails", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "anshow-assets-"));
    const manifestPath = path.join(rootDir, "content/assets/manifest.json");
    const staleFile = path.join(
      rootDir,
      "frontend/public/media/service-ocean/desktop-480.aaaaaaaaaaaa.avif",
    );
    const previousManifest = '[{"id":"preserved"}]\n';

    try {
      await writePrompts(rootDir, ["service-ocean", "service-air"]);
      await createMaster(rootDir, "service-ocean", 1400, 900, { r: 16, g: 54, b: 75 });
      await fs.writeFile(manifestPath, previousManifest);
      await fs.mkdir(path.dirname(staleFile), { recursive: true });
      await fs.writeFile(staleFile, "stale");

      await expect(buildAssets({ rootDir })).rejects.toThrow(/service-air\.png/);
      await expect(fs.readFile(manifestPath, "utf8")).resolves.toBe(previousManifest);
      await expect(fs.readFile(staleFile, "utf8")).resolves.toBe("stale");
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("reports hashed derivatives that are not referenced by the manifest", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "anshow-assets-"));
    const staleFile = path.join(
      rootDir,
      "frontend/public/media/service-ocean/desktop-480.aaaaaaaaaaaa.avif",
    );

    try {
      await writePrompts(rootDir, ["service-ocean"]);
      await createMaster(rootDir, "service-ocean", 1400, 900, { r: 16, g: 54, b: 75 });
      await buildAssets({ rootDir });
      await fs.writeFile(staleFile, "stale");

      const summary = await verifyAssets({ rootDir });

      expect(summary.violations).toContain(`Stale hashed derivative: ${staleFile}`);
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });
});
