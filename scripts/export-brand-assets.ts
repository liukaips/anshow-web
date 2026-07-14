import { exportBrandAssets } from "./brand-assets";

async function main() {
  await exportBrandAssets();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
