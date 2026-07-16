import Link from "next/link";

import type {
  AdminContentCollection,
  AdminContentItem,
  AdminContentLocale,
} from "../../../api/admin-content";
import { isTranslationComplete } from "../locale-tabs";
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from "../ui/admin-data-table";
import { AdminEmptyState } from "../ui/admin-feedback";
import {
  AdminStatus,
  type AdminDisplayStatus,
} from "../ui/admin-status";
import { collectionLabels } from "./content-labels";

const locales: readonly AdminContentLocale[] = ["zh", "en", "ru"];
const updatedAtFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Shanghai",
});

export function translationProgress(item: AdminContentItem): string {
  const complete = locales.filter((locale) =>
    isTranslationComplete(item.translations[locale]),
  ).length;
  return complete === 3 ? "三语已完成" : `${complete}/3 已完成`;
}

function contentName(item: AdminContentItem): string {
  return (
    item.translations.zh?.title.trim() ||
    item.translations.en?.title.trim() ||
    item.translations.ru?.title.trim() ||
    "未命名内容"
  );
}

function publicationStatus(item: AdminContentItem): AdminDisplayStatus {
  if (item.archivedAt) return "archived";
  const translations = Object.values(item.translations);
  if (
    locales.every(
      (locale) => item.translations[locale]?.status === "published",
    )
  ) {
    return "published";
  }
  if (translations.some((translation) => translation.status === "scheduled")) {
    return "scheduled";
  }
  return "draft";
}

function formattedUpdateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "时间未知" : updatedAtFormatter.format(date);
}

type ContentListProps = Readonly<{
  canWrite: boolean;
  collection: AdminContentCollection;
  items: readonly AdminContentItem[];
}>;

export function ContentList({ canWrite, collection, items }: ContentListProps) {
  if (items.length === 0) {
    return (
      <AdminEmptyState
        description="创建草稿后即可开始填写中文内容。"
        title={`暂无${collectionLabels[collection]}内容`}
      />
    );
  }

  const columns: readonly AdminDataTableColumn<AdminContentItem>[] = [
    {
      header: "内容名称",
      hideOnMobile: true,
      key: "name",
      render: (item) => (
        <span className="font-medium text-neutral-950">{contentName(item)}</span>
      ),
    },
    {
      header: "负责人",
      key: "owner",
      render: () => <span className="text-neutral-600">未分配</span>,
    },
    {
      header: "多语言进度",
      key: "translation",
      render: (item) => translationProgress(item),
    },
    {
      header: "发布状态",
      key: "status",
      render: (item) => <AdminStatus status={publicationStatus(item)} />,
    },
    {
      className: "whitespace-nowrap",
      header: "最近更新",
      key: "updatedAt",
      render: (item) => formattedUpdateTime(item.updatedAt),
    },
    {
      className: "whitespace-nowrap text-right",
      header: "操作",
      key: "action",
      render: (item) => (
        <Link
          className="inline-flex min-h-11 items-center rounded px-3 font-medium text-[var(--color-cyan-ink)] hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cyan-ink)]"
          href={`/admin/content/${collection}/${item.id}`}
        >
          {canWrite ? "编辑" : "查看"}
        </Link>
      ),
    },
  ];

  const label = collectionLabels[collection];
  return (
    <AdminDataTable
      columns={columns}
      getRowKey={(item) => item.id}
      mobileLabel={contentName}
      mobileListLabel={`${label}内容列表`}
      rows={items}
      tableLabel={`${label}内容表格`}
    />
  );
}
