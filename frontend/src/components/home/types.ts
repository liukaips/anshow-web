import type { components } from "@/generated/api";

export type HomeItem = components["schemas"]["PublicContentItem"];
export type HomeMedia = components["schemas"]["PublicMedia"];

export function largestSource(srcSet: string): string | undefined {
  const candidate = srcSet.split(",").at(-1)?.trim().split(/\s+/)[0];
  return candidate || undefined;
}

