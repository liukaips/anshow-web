import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

export const BRAND_SOURCES = [
  "route-apex-symbol",
  "anshow-horizontal-dark",
  "anshow-horizontal-light",
] as const;

export type BrandAssetOptions = {
  root?: string;
  outputDirectory?: string;
  iconPath?: string;
};

export async function exportBrandAssets(options: BrandAssetOptions = {}) {
  const root = options.root ?? process.cwd();
  const sourceDirectory = path.join(root, "assets", "brand");
  const outputDirectory =
    options.outputDirectory ?? path.join(root, "frontend", "public", "brand");
  const iconPath =
    options.iconPath ?? path.join(root, "frontend", "src", "app", "icon.svg");

  await fs.mkdir(outputDirectory, { recursive: true });

  for (const name of BRAND_SOURCES) {
    const source = path.join(sourceDirectory, `${name}.svg`);
    await fs.copyFile(source, path.join(outputDirectory, `${name}.svg`));
    await sharp(source)
      .png({ compressionLevel: 9 })
      .toFile(path.join(outputDirectory, `${name}.png`));
  }

  const symbol = path.join(sourceDirectory, "route-apex-symbol.svg");
  await fs.copyFile(symbol, iconPath);

  for (const size of [32, 48, 64]) {
    await sharp(symbol)
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(path.join(outputDirectory, `favicon-${size}.png`));
  }
}
