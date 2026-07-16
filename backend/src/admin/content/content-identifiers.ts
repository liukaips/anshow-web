import { createHash } from "node:crypto";

import type { AdminContentLocale } from "./content-schema.js";

const MAX_IDENTIFIER_LENGTH = 200;

function hashPrefix(value: string): string {
  return createHash("sha256").update(value.trim()).digest("hex").slice(0, 8);
}

function readableAscii(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_IDENTIFIER_LENGTH)
    .replace(/-+$/g, "");
}

export function contentIdentifier(title: string): string {
  return readableAscii(title) || `content-${hashPrefix(title)}`;
}

export function slugFromTitle(
  title: string,
  locale: AdminContentLocale,
): string {
  const readable = readableAscii(title);
  if (readable) return readable;
  const fallback = contentIdentifier(title);
  return locale === "zh" ? fallback : `${locale}-${fallback}`;
}

export function uniqueIdentifier(
  title: string,
  existing: ReadonlySet<string>,
): string {
  const base = contentIdentifier(title);
  if (!existing.has(base)) return base;

  for (let suffix = 2; suffix < Number.MAX_SAFE_INTEGER; suffix += 1) {
    const suffixText = `-${suffix}`;
    const candidate = `${base.slice(0, MAX_IDENTIFIER_LENGTH - suffixText.length)}${suffixText}`;
    if (!existing.has(candidate)) return candidate;
  }

  throw new Error("Unable to generate a unique content identifier");
}
