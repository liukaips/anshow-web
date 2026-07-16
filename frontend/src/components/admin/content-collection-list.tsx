"use client";

import { LoaderCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  createAdminContent,
  type AdminContentCollection,
  type AdminContentItem,
} from "../../api/admin-content";
import { ContentList } from "./content/content-list";
import { collectionLabels } from "./content/content-labels";

export { collectionLabels };

type ContentCollectionListProps = {
  canWrite: boolean;
  collection: AdminContentCollection;
  initialItems: AdminContentItem[];
};

export function ContentCollectionList({
  canWrite,
  collection,
  initialItems,
}: ContentCollectionListProps) {
  const router = useRouter();
  const [items] = useState(initialItems);
  const [titleZh, setTitleZh] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!titleZh.trim()) {
      setError(`请输入${collectionLabels[collection]}名称。`);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const created = await createAdminContent(collection, {
        titleZh: titleZh.trim(),
      });
      router.push(`/admin/content/${collection}/${created.id}`);
    } catch {
      setError("创建内容失败，请重试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-w-0">
      {canWrite ? (
        <>
          <div className="flex flex-col gap-3 border-y border-neutral-200 bg-white px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1">
              <label className="block text-sm font-semibold text-[var(--color-text)]" htmlFor="content-title-zh">
                {collectionLabels[collection]}名称
              </label>
              <input
                aria-describedby="content-title-zh-help"
                className="mt-2 min-h-11 w-full max-w-md rounded-[var(--radius-control)] border border-neutral-300 px-3 text-base outline-none transition-[border-color,box-shadow] duration-[var(--motion-fast)] focus:border-[var(--color-cyan-ink)] focus:ring-2 focus:ring-sky-100"
                id="content-title-zh"
                maxLength={200}
                onChange={(event) => setTitleZh(event.target.value)}
                placeholder={`例如：${collectionLabels[collection]}名称`}
                value={titleZh}
              />
              <p className="mt-1.5 text-xs text-neutral-500" id="content-title-zh-help">
                先填写中文名称，系统会自动创建内部编码和三语草稿。
              </p>
            </div>
            <button
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-action)] px-4 text-sm font-semibold text-white transition-[filter,transform] duration-[var(--motion-fast)] hover:-translate-y-px hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              disabled={pending}
              onClick={create}
              type="button"
            >
              {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Plus aria-hidden="true" className="size-4" />}
              创建内容
            </button>
          </div>
          <div aria-live="polite" className="min-h-8 pt-2">
            {error ? <p className="text-sm font-medium text-[var(--color-danger)]" role="alert">{error}</p> : null}
          </div>
        </>
      ) : null}

      {items.length === 0 ? (
        <div className="border-b border-neutral-200 py-12 text-center">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            暂无{collectionLabels[collection]}内容。
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            创建草稿后即可开始填写翻译内容。
          </p>
        </div>
      ) : (
        <ContentList canWrite={canWrite} collection={collection} items={items} />
      )}
    </div>
  );
}
