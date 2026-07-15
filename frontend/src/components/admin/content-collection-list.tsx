"use client";

import { ArrowRight, LoaderCircle, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  createAdminContent,
  type AdminContentCollection,
  type AdminContentItem,
  type AdminContentLocale,
} from "../../api/admin-content";
import { isTranslationComplete } from "./locale-tabs";

type ContentCollectionListProps = {
  collection: AdminContentCollection;
  initialItems: AdminContentItem[];
};

export const collectionLabels: Record<AdminContentCollection, string> = {
  pages: "Pages",
  "hero-slides": "Hero slides",
  services: "Services",
  "trade-lanes": "Trade lanes",
  "cargo-types": "Cargo types",
  "case-studies": "Case studies",
  articles: "Articles",
  partners: "Partners",
  certificates: "Certificates",
  "proof-metrics": "Proof metrics",
  "navigation-items": "Navigation items",
};

const localeLabels: Record<AdminContentLocale, string> = {
  en: "EN",
  zh: "ZH",
  ru: "RU",
};
const locales: readonly AdminContentLocale[] = ["en", "zh", "ru"];

export function ContentCollectionList({
  collection,
  initialItems,
}: ContentCollectionListProps) {
  const router = useRouter();
  const [items] = useState(initialItems);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!code.trim()) {
      setError("Enter a content code.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const created = await createAdminContent(collection, { code: code.trim() });
      router.push(`/admin/content/${collection}/${created.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Content creation failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-3 border-y border-neutral-200 bg-white px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <label className="block text-sm font-semibold text-[var(--color-text)]" htmlFor="content-code">
            Content code
          </label>
          <input
            className="mt-2 min-h-11 w-full max-w-md rounded-[var(--radius-control)] border border-neutral-300 px-3 text-base outline-none transition-[border-color,box-shadow] duration-[var(--motion-fast)] focus:border-[var(--color-cyan-ink)] focus:ring-2 focus:ring-sky-100"
            id="content-code"
            onChange={(event) => setCode(event.target.value)}
            pattern="[a-z0-9-]+"
            placeholder="lowercase-content-code"
            value={code}
          />
        </div>
        <button
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-action)] px-4 text-sm font-semibold text-white transition-[filter,transform] duration-[var(--motion-fast)] hover:-translate-y-px hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          disabled={pending}
          onClick={create}
          type="button"
        >
          {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Plus aria-hidden="true" className="size-4" />}
          Create content
        </button>
      </div>
      <div aria-live="polite" className="min-h-8 pt-2">
        {error ? <p className="text-sm font-medium text-[var(--color-danger)]" role="alert">{error}</p> : null}
      </div>

      {items.length === 0 ? (
        <div className="border-b border-neutral-200 py-12 text-center">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            No {collection} content yet.
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            Create a draft shell to begin the first translation.
          </p>
        </div>
      ) : (
        <div className="border-t border-neutral-200" role="list">
          {items.map((item) => (
            <Link
              className="grid min-w-0 grid-cols-1 gap-3 border-b border-neutral-200 px-3 py-4 transition-[background-color] duration-[var(--motion-fast)] hover:bg-white sm:grid-cols-[minmax(10rem,1fr)_minmax(0,2fr)_auto] sm:items-center"
              href={`/admin/content/${collection}/${item.id}`}
              key={item.id}
              role="listitem"
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-[var(--color-text)]">{item.code}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {item.archivedAt ? "Archived" : `Order ${item.sortOrder}`}
                </p>
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
                {locales.map((locale) => {
                  const translation = item.translations[locale];
                  const complete = isTranslationComplete(translation);
                  return (
                    <div className="min-w-0 border-l-2 border-neutral-200 pl-2" key={locale}>
                      <p className="text-xs font-semibold text-neutral-500">{localeLabels[locale]}</p>
                      <p className="break-words text-sm capitalize text-[var(--color-text)]">{translation?.status ?? "draft"}</p>
                      <p className={`text-xs ${complete ? "text-[var(--color-teal-ink)]" : "text-[var(--color-danger)]"}`}>
                        {complete ? "Complete" : "Incomplete"}
                      </p>
                    </div>
                  );
                })}
              </div>
              <ArrowRight aria-hidden="true" className="size-5 text-neutral-400" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
