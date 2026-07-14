import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const sources = [
  "route-apex-symbol",
  "anshow-horizontal-dark",
  "anshow-horizontal-light",
] as const;

async function main() {
  const root = process.cwd();
  const sourceDirectory = path.join(root, "assets", "brand");
  const outputDirectory = path.join(root, "frontend", "public", "brand");

  await fs.mkdir(outputDirectory, { recursive: true });

  for (const name of sources) {
    const source = path.join(sourceDirectory, `${name}.svg`);
    await fs.copyFile(source, path.join(outputDirectory, `${name}.svg`));
    await sharp(source)
      .png({ compressionLevel: 9 })
      .toFile(path.join(outputDirectory, `${name}.png`));
  }

  const symbol = path.join(sourceDirectory, "route-apex-symbol.svg");
  for (const size of [32, 48, 64]) {
    await sharp(symbol)
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(path.join(outputDirectory, `favicon-${size}.png`));
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
