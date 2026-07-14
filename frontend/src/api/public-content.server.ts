import "server-only";

import { getFrontendServerEnv } from "../env";
import type { paths } from "../generated/api";

import { getEnvelope } from "./http";

type HomeOperation = paths["/api/public/content/home/{locale}"]["get"];
type ListOperation = paths["/api/public/content/{collection}/{locale}"]["get"];
type DetailOperation = paths["/api/public/content/{collection}/{locale}/{slug}"]["get"];
type SitemapOperation = paths["/api/public/content/sitemap"]["get"];

type Home = NonNullable<
  HomeOperation["responses"][200]["content"]["application/json"]["data"]
>;
type PublicItems = NonNullable<
  ListOperation["responses"][200]["content"]["application/json"]["data"]
>;
type PublicItem = NonNullable<
  DetailOperation["responses"][200]["content"]["application/json"]["data"]
>;
type PublishedUrls = NonNullable<
  SitemapOperation["responses"][200]["content"]["application/json"]["data"]
>;

type Locale = HomeOperation["parameters"]["path"]["locale"];
type Collection = ListOperation["parameters"]["path"]["collection"];
type ClientOptions = { baseUrl?: string };

function segment(value: string): string {
  return encodeURIComponent(value);
}

function serverUrl(path: string, baseUrl?: string): string {
  const backendUrl =
    baseUrl ?? getFrontendServerEnv().BACKEND_INTERNAL_URL;
  return new URL(path, backendUrl).toString();
}

const noStore = { cache: "no-store" as const };

export function getPublicHome(
  locale: Locale,
  options: ClientOptions = {},
): Promise<Home> {
  return getEnvelope<Home>(
    serverUrl(`/api/public/content/home/${segment(locale)}`, options.baseUrl),
    noStore,
  );
}

export function listPublicContent(
  collection: Collection,
  locale: Locale,
  options: ClientOptions = {},
): Promise<PublicItems> {
  return getEnvelope<PublicItems>(
    serverUrl(
      `/api/public/content/${segment(collection)}/${segment(locale)}`,
      options.baseUrl,
    ),
    noStore,
  );
}

export function getPublicContent(
  collection: Collection,
  locale: Locale,
  slug: string,
  options: ClientOptions = {},
): Promise<PublicItem> {
  return getEnvelope<PublicItem>(
    serverUrl(
      `/api/public/content/${segment(collection)}/${segment(locale)}/${segment(slug)}`,
      options.baseUrl,
    ),
    noStore,
  );
}

export function listPublishedUrls(
  options: ClientOptions = {},
): Promise<PublishedUrls> {
  return getEnvelope<PublishedUrls>(
    serverUrl("/api/public/content/sitemap", options.baseUrl),
    noStore,
  );
}
