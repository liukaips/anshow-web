import type { MetadataRoute } from "next";

import { getFrontendServerEnv } from "../env";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const { SITE_URL } = getFrontendServerEnv();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/preview/", "/api/"],
    },
    sitemap: new URL("/sitemap.xml", SITE_URL).toString(),
  };
}
