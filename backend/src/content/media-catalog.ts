import { readFile } from "node:fs/promises";
import path from "node:path";

import type { PublicMedia } from "./public-contract.js";

type ManifestVariant = {
  width: number;
  height: number;
  format: "avif" | "webp";
  url: string;
  role: "desktop" | "mobile" | "thumbnail";
};
type ManifestRecord = { id: string; width: number; height: number; dominantColor: string; variants: ManifestVariant[] };

const manifestPaths = process.env.MEDIA_MANIFEST_PATH
  ? [process.env.MEDIA_MANIFEST_PATH]
  : [path.resolve(process.cwd(), "content/assets/manifest.json"), path.resolve(process.cwd(), "../content/assets/manifest.json")];
let catalogPromise: Promise<Map<string, ManifestRecord>> | undefined;
const catalogAliases: Record<string, string> = {
  ocean: "hero-ocean", air: "hero-air", rail: "hero-rail", road: "hero-road",
  "ocean-freight": "service-ocean", "air-freight": "service-air", "rail-freight": "service-rail", "road-freight": "service-road", multimodal: "service-multimodal", customs: "service-customs", warehousing: "service-warehouse",
  "china-russia": "lane-china-russia", "china-europe": "lane-china-europe", "central-asia": "lane-central-asia", "global-network": "lane-global",
  "project-cargo": "cargo-project", "oversized-cargo": "cargo-oversized", "dangerous-goods": "cargo-dangerous", "temperature-controlled": "cargo-cold-chain",
  about: "hero-ocean", network: "trust-coordination", contact: "hero-ocean", "multimodal-planning": "trust-coordination", "customs-readiness": "trust-customs", "warehouse-handoff": "trust-warehouse", "enquiry-preparation": "trust-operations", "mode-selection": "service-multimodal", "document-readiness": "trust-customs",
  "un1263-hamburg": "case-un1263-hamburg", "un3265-india": "case-un3265-india", "un3480-los-angeles": "case-un3480-los-angeles", "injection-machine-turkey": "case-injection-machine-turkey", "excavators-tir-moscow": "case-excavators-tir-moscow", "auto-parts-rail-russia": "case-auto-parts-rail-russia", "electronics-air-munich": "case-electronics-air-munich", "semiconductor-import-clearance": "case-semiconductor-clearance",
};

async function loadCatalog(): Promise<Map<string, ManifestRecord>> {
  for (const manifestPath of manifestPaths) {
    try {
      const parsed = JSON.parse(await readFile(manifestPath, "utf8")) as ManifestRecord[];
      return new Map(parsed.map((record) => [record.id, record]));
    } catch {
      continue;
    }
  }
  return new Map();
}

export async function mediaForCatalogId(id: string, alt: string): Promise<PublicMedia | null> {
  catalogPromise ??= loadCatalog();
  const record = (await catalogPromise).get(catalogAliases[id] ?? id);
  if (!record) return null;
  const desktop = record.variants.filter((variant) => variant.role === "desktop");
  const mobileAvif = record.variants.find((variant) => variant.role === "mobile" && variant.format === "avif")?.url ?? null;
  const mobileWebp = record.variants.find((variant) => variant.role === "mobile" && variant.format === "webp")?.url ?? null;
  const avifSrcSet = desktop.filter((variant) => variant.format === "avif").map((variant) => `${variant.url} ${variant.width}w`).join(", ");
  const webpSrcSet = desktop.filter((variant) => variant.format === "webp").map((variant) => `${variant.url} ${variant.width}w`).join(", ");
  if (!avifSrcSet || !webpSrcSet) return null;
  return { alt, width: record.width, height: record.height, dominantColor: record.dominantColor, mobileAvif, mobileWebp, avifSrcSet, webpSrcSet };
}
