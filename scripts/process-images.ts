import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Dirent } from "node:fs";

import sharp from "sharp";

export type AssetKind = "hero" | "content";
export type VariantRole = "desktop" | "mobile" | "thumbnail";

export type Variant = {
  width: number;
  height: number;
  format: "avif" | "webp";
  byteSize: number;
  url: string;
  role: VariantRole;
};

export type AssetRecord = {
  id: string;
  width: number;
  height: number;
  dominantColor: string;
  variants: Variant[];
};

export type PromptRecord = {
  id: string;
  use: string;
  prompt: string;
};

export type VerificationSummary = {
  completeSourceRecords: number;
  expectedSourceRecords: number;
  budgetViolations: {
    desktopHero: number;
    mobileHero: number;
    content: number;
    thumbnail: number;
  };
  violations: string[];
};

type ProcessAssetOptions = {
  rootDir?: string;
  outputRoot?: string;
};

type WorkspaceOptions = {
  rootDir?: string;
};

const DEFAULT_ROOT = path.resolve(__dirname, "..");
const ASSET_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HASHED_DERIVATIVE = /^(desktop|mobile|thumbnail)-(\d+)\.([a-f0-9]{12})\.(avif|webp)$/;

const BYTE_BUDGET = {
  content: 90 * 1024,
  hero: 280 * 1024,
  mobile: 140 * 1024,
  thumbnail: 35 * 1024,
} as const;

export function derivativePlan(_id: string, kind: AssetKind): string[] {
  const widths = kind === "hero" ? [480, 768, 1280, 1920] : [480, 768, 1280];
  const desktop = (["avif", "webp"] as const).flatMap((format) =>
    widths.map((width) => `${width}.${format}`),
  );

  return kind === "hero"
    ? [...desktop, "mobile-768.avif", "mobile-768.webp", "thumb-320.avif"]
    : [...desktop, "thumb-320.avif"];
}

async function assertReadable(filePath: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`Required source image is missing: ${filePath}`);
  }
}

async function encode(
  source: string,
  targetWidth: number,
  format: Variant["format"],
  maxBytes: number,
  outputDir: string,
  role: VariantRole,
): Promise<Variant> {
  const initialQuality = format === "avif" ? 60 : 78;

  for (let quality = initialQuality; quality >= 30; quality -= 5) {
    const pipeline = sharp(source)
      .rotate()
      .resize({
        width: targetWidth,
        withoutEnlargement: true,
        fit: "cover",
        position: sharp.strategy.attention,
      });
    const buffer = await (format === "avif"
      ? pipeline.avif({ quality })
      : pipeline.webp({ quality })
    ).toBuffer();

    if (buffer.byteLength > maxBytes) {
      continue;
    }

    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error(`Sharp did not report dimensions for ${source}`);
    }

    const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 12);
    const filename = `${role}-${targetWidth}.${hash}.${format}`;
    await fs.writeFile(path.join(outputDir, filename), buffer);

    return {
      width: metadata.width,
      height: metadata.height,
      format,
      byteSize: buffer.byteLength,
      url: `/media/${path.basename(outputDir)}/${filename}`,
      role,
    };
  }

  throw new Error(`${source} cannot meet ${maxBytes} byte budget at ${targetWidth}px`);
}

export async function processAsset(
  id: string,
  kind: AssetKind,
  options: ProcessAssetOptions = {},
): Promise<AssetRecord> {
  if (!ASSET_ID.test(id)) {
    throw new Error(`Invalid asset id: ${id}`);
  }

  const rootDir = options.rootDir ?? DEFAULT_ROOT;
  const source = path.join(rootDir, "assets/source", `${id}.png`);
  const mobileSource = path.join(rootDir, "assets/source", `${id}-mobile.png`);
  const outputRoot = options.outputRoot ?? path.join(rootDir, "frontend/public/media");
  const outputDir = path.join(outputRoot, id);

  await assertReadable(source);
  if (kind === "hero") {
    await assertReadable(mobileSource);
  }
  await fs.mkdir(outputDir, { recursive: true });

  const widths = kind === "hero" ? [480, 768, 1280, 1920] : [480, 768, 1280];
  const variants: Variant[] = [];
  for (const format of ["avif", "webp"] as const) {
    for (const width of widths) {
      variants.push(
        await encode(
          source,
          width,
          format,
          kind === "hero" ? BYTE_BUDGET.hero : BYTE_BUDGET.content,
          outputDir,
          "desktop",
        ),
      );
    }
  }

  if (kind === "hero") {
    for (const format of ["avif", "webp"] as const) {
      variants.push(
        await encode(
          mobileSource,
          768,
          format,
          BYTE_BUDGET.mobile,
          outputDir,
          "mobile",
        ),
      );
    }
  }

  variants.push(
    await encode(
      source,
      320,
      "avif",
      BYTE_BUDGET.thumbnail,
      outputDir,
      "thumbnail",
    ),
  );

  const metadata = await sharp(source).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Sharp did not report source dimensions for ${source}`);
  }
  const { dominant } = await sharp(source).stats();

  return {
    id,
    width: metadata.width,
    height: metadata.height,
    dominantColor: `rgb(${dominant.r} ${dominant.g} ${dominant.b})`,
    variants,
  };
}

async function readJson(filePath: string): Promise<unknown> {
  let source: string;
  try {
    source = await fs.readFile(filePath, "utf8");
  } catch (error) {
    throw new Error(`Cannot read ${filePath}: ${error instanceof Error ? error.message : error}`);
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : error}`);
  }
}

function parsePrompts(value: unknown, filePath: string): PromptRecord[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${filePath} must contain a non-empty array`);
  }

  const prompts: PromptRecord[] = [];
  const ids = new Set<string>();
  for (const [index, candidate] of value.entries()) {
    if (!candidate || typeof candidate !== "object") {
      throw new Error(`${filePath}[${index}] must be an object`);
    }
    const { id, prompt, use } = candidate as Record<string, unknown>;
    if (typeof id !== "string" || !ASSET_ID.test(id)) {
      throw new Error(`${filePath}[${index}].id is invalid`);
    }
    if (ids.has(id)) {
      throw new Error(`${filePath} contains duplicate asset id: ${id}`);
    }
    if (typeof use !== "string" || use.trim() === "") {
      throw new Error(`${filePath}[${index}].use must be a non-empty string`);
    }
    if (typeof prompt !== "string" || prompt.trim() === "") {
      throw new Error(`${filePath}[${index}].prompt must be a non-empty string`);
    }
    ids.add(id);
    prompts.push({ id, use, prompt });
  }
  return prompts;
}

function parseManifest(value: unknown, filePath: string): AssetRecord[] {
  if (!Array.isArray(value)) {
    throw new Error(`${filePath} must contain an array`);
  }

  return value.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object") {
      throw new Error(`${filePath}[${index}] must be an object`);
    }
    const record = candidate as Partial<AssetRecord>;
    if (
      typeof record.id !== "string" ||
      !ASSET_ID.test(record.id) ||
      typeof record.width !== "number" ||
      !Number.isInteger(record.width) ||
      record.width <= 0 ||
      typeof record.height !== "number" ||
      !Number.isInteger(record.height) ||
      record.height <= 0 ||
      typeof record.dominantColor !== "string" ||
      !Array.isArray(record.variants)
    ) {
      throw new Error(`${filePath}[${index}] is not a valid asset record`);
    }

    const variants = record.variants.map((candidateVariant, variantIndex) => {
      if (!candidateVariant || typeof candidateVariant !== "object") {
        throw new Error(`${filePath}[${index}].variants[${variantIndex}] must be an object`);
      }
      const variant = candidateVariant as Partial<Variant>;
      if (
        typeof variant.width !== "number" ||
        !Number.isInteger(variant.width) ||
        variant.width <= 0 ||
        typeof variant.height !== "number" ||
        !Number.isInteger(variant.height) ||
        variant.height <= 0 ||
        (variant.format !== "avif" && variant.format !== "webp") ||
        typeof variant.byteSize !== "number" ||
        !Number.isInteger(variant.byteSize) ||
        variant.byteSize <= 0 ||
        typeof variant.url !== "string" ||
        (variant.role !== "desktop" &&
          variant.role !== "mobile" &&
          variant.role !== "thumbnail")
      ) {
        throw new Error(`${filePath}[${index}].variants[${variantIndex}] is invalid`);
      }
      return variant as Variant;
    });

    return { ...record, variants } as AssetRecord;
  });
}

async function loadPrompts(rootDir: string): Promise<PromptRecord[]> {
  const promptPath = path.join(rootDir, "content/assets/prompts.json");
  return parsePrompts(await readJson(promptPath), promptPath);
}

async function preflightSources(rootDir: string, prompts: PromptRecord[]): Promise<void> {
  const required = prompts.flatMap(({ id }) => {
    const sources = [path.join(rootDir, "assets/source", `${id}.png`)];
    if (id.startsWith("hero-")) {
      sources.push(path.join(rootDir, "assets/source", `${id}-mobile.png`));
    }
    return sources;
  });
  const missing: string[] = [];
  for (const source of required) {
    try {
      await fs.access(source);
    } catch {
      missing.push(source);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Required source images are missing:\n${missing.map((file) => `- ${file}`).join("\n")}`);
  }
}

async function publishStagedAssets(
  records: AssetRecord[],
  stagingRoot: string,
  mediaRoot: string,
  token: string,
): Promise<void> {
  for (const record of records) {
    const targetDir = path.join(mediaRoot, record.id);
    await fs.mkdir(targetDir, { recursive: true });
    for (const variant of record.variants) {
      const filename = path.basename(variant.url);
      const staged = path.join(stagingRoot, record.id, filename);
      const temporary = path.join(targetDir, `.${filename}.${token}.tmp`);
      const target = path.join(targetDir, filename);
      await fs.copyFile(staged, temporary);
      await fs.rename(temporary, target);
    }
  }
}

async function writeManifestAtomically(
  manifestPath: string,
  records: AssetRecord[],
  token: string,
): Promise<void> {
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  const temporary = `${manifestPath}.${token}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(records, null, 2)}\n`, { flag: "wx" });
  await fs.rename(temporary, manifestPath);
}

async function findStaleDerivatives(
  mediaRoot: string,
  records: AssetRecord[],
): Promise<string[]> {
  const keepById = new Map(
    records.map((record) => [record.id, new Set(record.variants.map(({ url }) => path.basename(url)))]),
  );
  let directories: Dirent[];
  try {
    directories = await fs.readdir(mediaRoot, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const stale: string[] = [];
  for (const directory of directories) {
    if (!directory.isDirectory() || directory.name.startsWith(".asset-build-")) continue;
    const assetDir = path.join(mediaRoot, directory.name);
    const keep = keepById.get(directory.name) ?? new Set<string>();
    for (const entry of await fs.readdir(assetDir, { withFileTypes: true })) {
      if (entry.isFile() && HASHED_DERIVATIVE.test(entry.name) && !keep.has(entry.name)) {
        stale.push(path.join(assetDir, entry.name));
      }
    }
  }
  return stale;
}

async function removeStaleDerivatives(mediaRoot: string, records: AssetRecord[]): Promise<void> {
  for (const stale of await findStaleDerivatives(mediaRoot, records)) {
    await fs.rm(stale);
  }
}

export async function buildAssets(options: WorkspaceOptions = {}): Promise<AssetRecord[]> {
  const rootDir = options.rootDir ?? DEFAULT_ROOT;
  const prompts = await loadPrompts(rootDir);
  await preflightSources(rootDir, prompts);

  const mediaRoot = path.join(rootDir, "frontend/public/media");
  const token = `${process.pid}-${Date.now()}-${createHash("sha256")
    .update(`${Math.random()}`)
    .digest("hex")
    .slice(0, 8)}`;
  const stagingRoot = path.join(mediaRoot, `.asset-build-${token}`);
  const manifestPath = path.join(rootDir, "content/assets/manifest.json");
  await fs.mkdir(stagingRoot, { recursive: true });

  try {
    const records: AssetRecord[] = [];
    for (const { id } of prompts) {
      records.push(
        await processAsset(id, id.startsWith("hero-") ? "hero" : "content", {
          rootDir,
          outputRoot: stagingRoot,
        }),
      );
    }

    await publishStagedAssets(records, stagingRoot, mediaRoot, token);
    await writeManifestAtomically(manifestPath, records, token);
    await removeStaleDerivatives(mediaRoot, records);
    return records;
  } finally {
    await fs.rm(stagingRoot, { recursive: true, force: true });
  }
}

function expectedVariantKeys(kind: AssetKind): Set<string> {
  const widths = kind === "hero" ? [480, 768, 1280, 1920] : [480, 768, 1280];
  const keys = new Set<string>();
  for (const format of ["avif", "webp"] as const) {
    for (const width of widths) keys.add(`desktop-${width}-${format}`);
  }
  if (kind === "hero") {
    keys.add("mobile-768-avif");
    keys.add("mobile-768-webp");
  }
  keys.add("thumbnail-320-avif");
  return keys;
}

function budgetFor(kind: AssetKind, role: VariantRole): number {
  if (role === "thumbnail") return BYTE_BUDGET.thumbnail;
  if (role === "mobile") return BYTE_BUDGET.mobile;
  return kind === "hero" ? BYTE_BUDGET.hero : BYTE_BUDGET.content;
}

function budgetCategory(
  kind: AssetKind,
  role: VariantRole,
): keyof VerificationSummary["budgetViolations"] {
  if (role === "thumbnail") return "thumbnail";
  if (role === "mobile") return "mobileHero";
  return kind === "hero" ? "desktopHero" : "content";
}

export async function verifyAssets(options: WorkspaceOptions = {}): Promise<VerificationSummary> {
  const rootDir = options.rootDir ?? DEFAULT_ROOT;
  const prompts = await loadPrompts(rootDir);
  const manifestPath = path.join(rootDir, "content/assets/manifest.json");
  const records = parseManifest(await readJson(manifestPath), manifestPath);
  const violations: string[] = [];
  const budgetViolations: VerificationSummary["budgetViolations"] = {
    desktopHero: 0,
    mobileHero: 0,
    content: 0,
    thumbnail: 0,
  };
  const recordById = new Map<string, AssetRecord>();
  for (const record of records) {
    if (recordById.has(record.id)) violations.push(`Duplicate manifest record: ${record.id}`);
    recordById.set(record.id, record);
  }

  const promptIds = new Set(prompts.map(({ id }) => id));
  for (const record of records) {
    if (!promptIds.has(record.id)) violations.push(`Unexpected manifest record: ${record.id}`);
  }

  let completeSourceRecords = 0;
  for (const { id } of prompts) {
    const recordStart = violations.length;
    const kind: AssetKind = id.startsWith("hero-") ? "hero" : "content";
    const source = path.join(rootDir, "assets/source", `${id}.png`);
    const requiredSources = kind === "hero" ? [source, path.join(rootDir, "assets/source", `${id}-mobile.png`)] : [source];
    for (const requiredSource of requiredSources) {
      try {
        await fs.access(requiredSource);
      } catch {
        violations.push(`Missing source image: ${requiredSource}`);
      }
    }

    const record = recordById.get(id);
    if (!record) {
      violations.push(`Missing manifest record: ${id}`);
      continue;
    }

    try {
      const sourceMetadata = await sharp(source).metadata();
      if (sourceMetadata.width !== record.width || sourceMetadata.height !== record.height) {
        violations.push(`Source dimensions do not match manifest: ${id}`);
      }
    } catch {
      // The missing source violation above is more actionable.
    }

    const expectedKeys = expectedVariantKeys(kind);
    const actualKeys = new Set<string>();
    for (const variant of record.variants) {
      const expectedPrefix = `/media/${id}/`;
      if (!variant.url.startsWith(expectedPrefix) || path.basename(variant.url) !== variant.url.slice(expectedPrefix.length)) {
        violations.push(`Unsafe or mismatched derivative URL for ${id}: ${variant.url}`);
        continue;
      }
      const filename = path.basename(variant.url);
      const match = HASHED_DERIVATIVE.exec(filename);
      if (!match) {
        violations.push(`Invalid derivative filename for ${id}: ${filename}`);
        continue;
      }
      const [, role, targetWidth, declaredHash, filenameFormat] = match;
      const key = `${role}-${targetWidth}-${filenameFormat}`;
      if (actualKeys.has(key)) violations.push(`Duplicate derivative variant for ${id}: ${key}`);
      actualKeys.add(key);
      if (role !== variant.role || filenameFormat !== variant.format) {
        violations.push(`Derivative metadata does not match filename for ${id}: ${filename}`);
      }

      const filePath = path.join(rootDir, "frontend/public/media", id, filename);
      let bytes: Buffer;
      try {
        bytes = await fs.readFile(filePath);
      } catch {
        violations.push(`Missing derivative file: ${filePath}`);
        continue;
      }
      if (bytes.byteLength !== variant.byteSize) {
        violations.push(`Derivative byte size does not match manifest: ${variant.url}`);
      }
      const actualHash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
      if (actualHash !== declaredHash) {
        violations.push(`Derivative hash does not match filename: ${variant.url}`);
      }
      const budget = budgetFor(kind, variant.role);
      if (bytes.byteLength > budget) {
        budgetViolations[budgetCategory(kind, variant.role)] += 1;
        violations.push(`Derivative exceeds ${budget} byte budget: ${variant.url}`);
      }
      try {
        const metadata = await sharp(bytes).metadata();
        const formatMatches =
          variant.format === "avif"
            ? metadata.format === "heif"
            : metadata.format === "webp";
        if (!formatMatches || metadata.width !== variant.width || metadata.height !== variant.height) {
          violations.push(`Derivative image metadata does not match manifest: ${variant.url}`);
        }
      } catch {
        violations.push(`Derivative is not a readable image: ${variant.url}`);
      }
    }

    for (const key of expectedKeys) {
      if (!actualKeys.has(key)) violations.push(`Missing derivative variant for ${id}: ${key}`);
    }
    for (const key of actualKeys) {
      if (!expectedKeys.has(key)) violations.push(`Unexpected derivative variant for ${id}: ${key}`);
    }
    if (violations.length === recordStart) completeSourceRecords += 1;
  }

  const mediaRoot = path.join(rootDir, "frontend/public/media");
  for (const stale of await findStaleDerivatives(mediaRoot, records)) {
    violations.push(`Stale hashed derivative: ${stale}`);
  }

  return {
    completeSourceRecords,
    expectedSourceRecords: prompts.length,
    budgetViolations,
    violations,
  };
}

function formatVerification(summary: VerificationSummary): string {
  const { budgetViolations } = summary;
  return [
    `Asset verification: ${summary.completeSourceRecords}/${summary.expectedSourceRecords} complete source records.`,
    `Budget violations: desktop hero ${budgetViolations.desktopHero}, mobile hero ${budgetViolations.mobileHero}, content ${budgetViolations.content}, thumbnail ${budgetViolations.thumbnail}.`,
  ].join(" ");
}

async function runCli(): Promise<void> {
  if (process.argv.slice(2).some((argument) => argument !== "--verify")) {
    throw new Error("Usage: tsx scripts/process-images.ts [--verify]");
  }
  if (process.argv.includes("--verify")) {
    const summary = await verifyAssets();
    console.log(formatVerification(summary));
    if (summary.violations.length > 0) {
      throw new Error(`Asset verification failed:\n${summary.violations.map((item) => `- ${item}`).join("\n")}`);
    }
    return;
  }

  const records = await buildAssets();
  console.log(`Built ${records.length} source records into content/assets/manifest.json.`);
}

const isMain = process.argv[1] ? path.resolve(process.argv[1]) === path.resolve(__filename) : false;
if (isMain) {
  void runCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
