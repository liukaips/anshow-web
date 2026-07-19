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

const CASE_ASSET_IDS = [
  "case-un1263-hamburg",
  "case-un3265-india",
  "case-un3480-los-angeles",
  "case-injection-machine-turkey",
  "case-excavators-tir-moscow",
  "case-auto-parts-rail-russia",
  "case-electronics-air-munich",
  "case-semiconductor-clearance",
] as const;

const FEATURE_CASE_ASSET_IDS = CASE_ASSET_IDS.slice(0, 4);

const DANGEROUS_GOODS_MARKS = {
  "case-un1263-hamburg": "standardized Class 3 flammable-liquid hazard diamond",
  "case-un3265-india": "standardized Class 8 corrosive hazard diamond",
  "case-un3480-los-angeles": "standardized Class 9 lithium-battery hazard diamond",
} as const;

const ALL_ASSET_IDS = [
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
  "anshow-office",
  "anshow-contact",
  ...CASE_ASSET_IDS,
] as const;

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

async function writePrompts(rootDir: string, ids: string[], mobileIds: string[] = []) {
  const contentDir = path.join(rootDir, "content/assets");
  await fs.mkdir(contentDir, { recursive: true });
  await fs.writeFile(
    path.join(contentDir, "prompts.json"),
    `${JSON.stringify(
      ids.map((id) => ({
        id,
        use: "test fixture",
        prompt: `Approved prompt for ${id}`,
        ...(mobileIds.includes(id)
          ? { mobilePrompt: `Approved mobile prompt for ${id}` }
          : {}),
      })),
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
  it("defines the exact 33 approved production assets", async () => {
    const promptPath = path.join(process.cwd(), "content/assets/prompts.json");
    const prompts = JSON.parse(await fs.readFile(promptPath, "utf8")) as Array<{
      id: string;
      prompt: string;
      use: string;
    }>;

    expect(prompts.map(({ id }) => id)).toEqual(ALL_ASSET_IDS);
    expect(new Set(prompts.map(({ id }) => id)).size).toBe(33);
    expect(prompts.every(({ prompt, use }) => prompt.length > 0 && use.length > 0)).toBe(true);
  });

  it("plans responsive case media and truthful catalog aliases", async () => {
    const [manifestSource, promptSource, catalogSource] = await Promise.all([
      fs.readFile(path.join(process.cwd(), "content/assets/manifest.json"), "utf8"),
      fs.readFile(path.join(process.cwd(), "content/assets/prompts.json"), "utf8"),
      fs.readFile(path.join(process.cwd(), "backend/src/content/media-catalog.ts"), "utf8"),
    ]);
    const manifest = JSON.parse(manifestSource) as Array<{
      id: string;
      variants: Array<{ format: string; role: string; width: number }>;
    }>;
    const promptIds = new Set(
      (JSON.parse(promptSource) as Array<{ id: string }>).map(({ id }) => id),
    );
    const manifestById = new Map(manifest.map((record) => [record.id, record]));

    for (const id of CASE_ASSET_IDS) {
      expect(promptIds.has(id), `${id} prompt`).toBe(true);
      const record = manifestById.get(id);
      expect(record, `${id} manifest record`).toBeDefined();
      if (!record) continue;

      const variantKeys = record.variants.map(
        ({ format, role, width }) => `${role}-${width}-${format}`,
      );
      expect(variantKeys).toEqual(
        expect.arrayContaining([
          "desktop-480-avif",
          "desktop-768-avif",
          "desktop-1280-avif",
          "desktop-480-webp",
          "desktop-768-webp",
          "desktop-1280-webp",
          "thumbnail-320-avif",
        ]),
      );
      if (FEATURE_CASE_ASSET_IDS.includes(id)) {
        expect(variantKeys).toEqual(
          expect.arrayContaining(["mobile-768-avif", "mobile-768-webp"]),
        );
      }
    }

    expect(catalogSource).toMatch(/\bair:\s*"hero-air"/);
    expect(catalogSource).toMatch(/\brail:\s*"hero-rail"/);
    for (const [alias, id] of [
      ["un1263-hamburg", "case-un1263-hamburg"],
      ["un3265-india", "case-un3265-india"],
      ["un3480-los-angeles", "case-un3480-los-angeles"],
      ["injection-machine-turkey", "case-injection-machine-turkey"],
      ["excavators-tir-moscow", "case-excavators-tir-moscow"],
      ["auto-parts-rail-russia", "case-auto-parts-rail-russia"],
      ["electronics-air-munich", "case-electronics-air-munich"],
      ["semiconductor-import-clearance", "case-semiconductor-clearance"],
    ] as const) {
      expect(catalogSource).toMatch(new RegExp(`"${alias}":\\s*"${id}"`));
    }
  });

  it("audits mobile art direction for exactly the mobile-enabled case sources", async () => {
    const prompts = JSON.parse(
      await fs.readFile(path.join(process.cwd(), "content/assets/prompts.json"), "utf8"),
    ) as Array<{ id: string; mobilePrompt?: string }>;
    const withMobilePrompt = prompts
      .filter(({ mobilePrompt }) => typeof mobilePrompt === "string" && mobilePrompt.length > 0)
      .map(({ id }) => id);

    expect(withMobilePrompt).toEqual(FEATURE_CASE_ASSET_IDS);
    for (const id of FEATURE_CASE_ASSET_IDS) {
      const mobilePrompt = prompts.find((prompt) => prompt.id === id)?.mobilePrompt ?? "";
      expect(mobilePrompt, id).toMatch(/portrait 3:4/i);
      expect(mobilePrompt, id).toMatch(/lower third/i);
      expect(mobilePrompt, id).toMatch(/upper safe negative space/i);
      expect(mobilePrompt, id).toMatch(/realistic safe (?:handling|securement)/i);
      expect(mobilePrompt, id).toMatch(/no (?:commercial )?brands/i);
    }
    for (const [id, regulatedMark] of Object.entries(DANGEROUS_GOODS_MARKS)) {
      const mobilePrompt = prompts.find((prompt) => prompt.id === id)?.mobilePrompt ?? "";
      expect(mobilePrompt, id).toContain(regulatedMark);
    }
  });

  it("requires exact standardized dangerous-goods marks without commercial labels", async () => {
    const prompts = JSON.parse(
      await fs.readFile(path.join(process.cwd(), "content/assets/prompts.json"), "utf8"),
    ) as Array<{ id: string; prompt: string }>;

    for (const [id, regulatedMark] of Object.entries(DANGEROUS_GOODS_MARKS)) {
      const prompt = prompts.find((candidate) => candidate.id === id)?.prompt ?? "";
      expect(prompt, id).toContain(regulatedMark);
      expect(prompt, id).toMatch(/no commercial text/i);
      expect(prompt, id).toMatch(/no fake customer labels/i);
    }
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

  it("creates mobile derivatives for content with an art-directed mobile master", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "anshow-assets-"));

    try {
      await createMaster(rootDir, "case-un1263-hamburg", 1600, 900, {
        r: 25,
        g: 55,
        b: 75,
      });
      await createMaster(rootDir, "case-un1263-hamburg-mobile", 900, 1200, {
        r: 30,
        g: 60,
        b: 80,
      });

      const record = await processAsset("case-un1263-hamburg", "content", { rootDir });

      expect(record.variants).toHaveLength(9);
      expect(record.variants).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ format: "avif", role: "mobile", width: 768 }),
          expect.objectContaining({ format: "webp", role: "mobile", width: 768 }),
        ]),
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });
});

describe("asset build", () => {
  it("rejects a declared mobile prompt when its source master is missing", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "anshow-assets-"));

    try {
      await writePrompts(
        rootDir,
        ["case-un1263-hamburg"],
        ["case-un1263-hamburg"],
      );
      await createMaster(rootDir, "case-un1263-hamburg", 1600, 900, {
        r: 25,
        g: 55,
        b: 75,
      });

      await expect(buildAssets({ rootDir })).rejects.toThrow(
        /Required mobile source declared by prompt: .*case-un1263-hamburg-mobile\.png/,
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it("reports a declared mobile source removed after a successful build", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "anshow-assets-"));
    const id = "case-un1263-hamburg";
    const mobileSource = path.join(rootDir, "assets/source", `${id}-mobile.png`);

    try {
      await writePrompts(rootDir, [id], [id]);
      await createMaster(rootDir, id, 1600, 900, { r: 25, g: 55, b: 75 });
      await createMaster(rootDir, `${id}-mobile`, 900, 1200, { r: 30, g: 60, b: 80 });
      await buildAssets({ rootDir });
      await fs.rm(mobileSource);

      const summary = await verifyAssets({ rootDir });

      expect(summary.violations).toContain(
        `Missing mobile source declared by prompt: ${mobileSource}`,
      );
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

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
