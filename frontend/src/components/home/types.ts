import type { components } from "@/generated/api";

export type HomeItem = components["schemas"]["PublicContentItem"];
export type HomeMedia = components["schemas"]["PublicMedia"];
export type HomeContent = components["schemas"]["PublicHome"];

export function homeHref(
  pathPrefix: string,
  locale: string,
  ...segments: readonly string[]
): string {
  const prefix = pathPrefix.replace(/\/+$/, "");
  const path = [locale, ...segments].map(encodeURIComponent).join("/");
  return `${prefix}/${path}`;
}

export function largestSource(srcSet: string): string | undefined {
  const candidate = srcSet.split(",").at(-1)?.trim().split(/\s+/)[0];
  return candidate || undefined;
}
