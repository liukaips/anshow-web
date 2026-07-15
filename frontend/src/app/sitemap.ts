import type { MetadataRoute } from "next";

import { listPublishedUrls } from "../api/public-content.server";
import { getFrontendServerEnv } from "../env";

export const dynamic = "force-dynamic";

function publicUrl(siteUrl: string, path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Sitemap paths must be root-relative public paths.");
  }

  const origin = new URL(siteUrl);
  const url = new URL(path, origin);
  if (url.origin !== origin.origin) {
    throw new Error("Sitemap paths must stay on the configured public origin.");
  }

  return url.toString();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { SITE_URL } = getFrontendServerEnv();
  const records = await listPublishedUrls();

  return records.map((record) => ({
    url: publicUrl(SITE_URL, record.path),
    lastModified: record.updatedAt,
    alternates: {
      languages: Object.fromEntries(
        Object.entries(record.alternates).map(([locale, path]) => [
          locale,
          publicUrl(SITE_URL, path),
        ]),
      ),
    },
  }));
}
