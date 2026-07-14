import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

import { exportBrandAssets } from "./brand-assets";

const EXPECTED_DIMENSIONS = new Map<string, [number, number]>([
  ["route-apex-symbol.png", [64, 64]],
  ["anshow-horizontal-dark.png", [286, 64]],
  ["anshow-horizontal-light.png", [286, 64]],
  ["favicon-32.png", [32, 32]],
  ["favicon-48.png", [48, 48]],
  ["favicon-64.png", [64, 64]],
]);

async function assertSameFile(expected: string, actual: string) {
  const [expectedBytes, actualBytes] = await Promise.all([
    fs.readFile(expected),
    fs.readFile(actual),
  ]);
  assert.deepEqual(actualBytes, expectedBytes, `${actual} is stale`);
}

async function main() {
  const root = process.cwd();
  const committedDirectory = path.join(root, "frontend", "public", "brand");
  const committedIcon = path.join(root, "frontend", "src", "app", "icon.svg");
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "anshow-brand-"));
  const generatedDirectory = path.join(temporaryRoot, "brand");
  const generatedIcon = path.join(temporaryRoot, "icon.svg");

  try {
    await exportBrandAssets({
      root,
      outputDirectory: generatedDirectory,
      iconPath: generatedIcon,
    });

    const [committedFiles, generatedFiles] = await Promise.all([
      fs.readdir(committedDirectory),
      fs.readdir(generatedDirectory),
    ]);
    assert.deepEqual(committedFiles.sort(), generatedFiles.sort());

    await Promise.all(
      generatedFiles.map(async (file) => {
        const generated = path.join(generatedDirectory, file);
        await assertSameFile(path.join(committedDirectory, file), generated);

        const expectedSize = EXPECTED_DIMENSIONS.get(file);
        if (expectedSize) {
          const metadata = await sharp(generated).metadata();
          assert.deepEqual([metadata.width, metadata.height], expectedSize);
        }
      }),
    );
    await assertSameFile(committedIcon, generatedIcon);
    console.info("Brand assets are current.");
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
