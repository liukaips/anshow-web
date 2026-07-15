"use client";

import type { paths } from "../generated/api";

import { getEnvelope } from "./http";

type HomeOperation = paths["/api/public/content/home/{locale}"]["get"];
type SitemapOperation = paths["/api/public/content/sitemap"]["get"];
type Home = NonNullable<
  HomeOperation["responses"][200]["content"]["application/json"]["data"]
>;
type Locale = HomeOperation["parameters"]["path"]["locale"];
type PublishedUrls = NonNullable<
  SitemapOperation["responses"][200]["content"]["application/json"]["data"]
>;

export function refreshPublicHome(locale: Locale): Promise<Home> {
  return getEnvelope<Home>(
    `/api/public/content/home/${encodeURIComponent(locale)}`,
    { cache: "no-store" },
  );
}

export function refreshPublishedUrls(): Promise<PublishedUrls> {
  return getEnvelope<PublishedUrls>("/api/public/content/sitemap", {
    cache: "no-store",
  });
}
