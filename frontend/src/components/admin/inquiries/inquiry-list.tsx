"use client";

import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { getAdminInquiry, inquiryExportUrl, type AdminInquiry, type AdminInquiryDetail } from "@/api/admin-inquiries";

import { AdminDataTable, type AdminDataTableColumn } from "../ui/admin-data-table";
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from "../ui/admin-feedback";
import { AdminToolbar } from "../ui/admin-toolbar";
import { InquiryDetail } from "./inquiry-detail";
import { formatInquiryTime, INQUIRY_PRIORITY_LABELS, INQUIRY_PRIORITY_STYLES, INQUIRY_STATUS_LABELS } from "./inquiry-labels";

type InquiryListProps = Readonly<{
  assignees?: readonly { id: string; name: string; email: string }[];
  canAddNote?: boolean;
  canAssign?: boolean;
  canChangeStatus?: boolean;
  canExport: boolean;
  canRetry?: boolean;
  initialPriority?: string;
  initialDetail?: AdminInquiryDetail;
  initialSearch?: string;
  initialStatus?: string;
  initialItems: readonly AdminInquiry[];
}>;

export function InquiryList({
  assignees = [],
  canAddNote = false,
  canAssign = false,
  canChangeStatus = false,
  canExport,
  canRetry = false,
  initialDetail,
  initialPriority = "",
  initialSearch = "",
  initialStatus = "",
  initialItems,
}: InquiryListProps) {
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);
  const [priority, setPriority] = useState(initialPriority);
  const [detail, setDetail] = useState<AdminInquiryDetail | null>(initialDetail ?? null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const visibleItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("zh-CN");
    return items.filter((item) => {
      const matchesText = !term || [item.name, item.company, item.email, item.phone, item.transportNeed].some((value) => value.toLocaleLowerCase("zh-CN").includes(term));
      return matchesText && (!status || item.status === status) && (!priority || item.priority === priority);
    });
  }, [items, priority, search, status]);

  async function openDetail(id: string) {
    setLoadingId(id);
    setLoadError(null);
    try {
      setDetail(await getAdminInquiry(id));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "询盘详情加载失败");
    } finally {
      setLoadingId(null);
    }
  }

  const columns: readonly AdminDataTableColumn<AdminInquiry>[] = [
    { key: "customer", header: "客户与公司", hideOnMobile: true, render: (item) => <div><p className="font-medium text-neutral-950">{item.name}</p><p className="mt-0.5 text-xs text-neutral-500">{item.company || "未填写公司"}</p></div> },
    { key: "need", header: "运输需求", render: (item) => <span className="max-w-64 break-words text-neutral-800">{item.transportNeed}</span> },
    { key: "priority", header: "优先级", render: (item) => <span className={`inline-flex min-h-7 items-center rounded border px-2 text-xs font-medium ${INQUIRY_PRIORITY_STYLES[item.priority]}`}>{INQUIRY_PRIORITY_LABELS[item.priority]}</span> },
    { key: "status", header: "状态", render: (item) => INQUIRY_STATUS_LABELS[item.status] },
    { key: "owner", header: "负责人", render: (item) => item.assigneeId ? assignees.find((person) => person.id === item.assigneeId)?.name ?? "已分配" : <span className="text-neutral-500">未分配</span> },
    { key: "updated", header: "最近更新", className: "whitespace-nowrap tabular-nums", render: (item) => formatInquiryTime(item.updatedAt) },
    { key: "action", header: "操作", className: "text-right", render: (item) => <button className="min-h-11 rounded px-3 text-sm font-medium text-[var(--color-cyan-ink)] hover:bg-sky-50 disabled:opacity-50" disabled={loadingId === item.id} onClick={() => openDetail(item.id)} type="button">{loadingId === item.id ? "正在加载..." : "查看详情"}</button> },
  ];

  return (
    <div className="grid min-w-0 gap-4">
      <AdminToolbar aria-label="询盘筛选">
        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(12rem,1fr)_10rem_9rem]">
          <label className="relative min-w-0"><span className="sr-only">搜索询盘</span><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-neutral-500" /><input aria-label="搜索询盘" className="min-h-11 w-full rounded border border-neutral-300 bg-white pl-9 pr-3 text-base sm:text-sm" onChange={(event) => setSearch(event.target.value)} placeholder="客户、公司、联系方式" type="search" value={search} /></label>
          <label><span className="sr-only">按状态筛选</span><select aria-label="按状态筛选" className="min-h-11 w-full rounded border border-neutral-300 bg-white px-3 text-base sm:text-sm" onChange={(event) => setStatus(event.target.value)} value={status}><option value="">全部状态</option>{Object.entries(INQUIRY_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span className="sr-only">按优先级筛选</span><select aria-label="按优先级筛选" className="min-h-11 w-full rounded border border-neutral-300 bg-white px-3 text-base sm:text-sm" onChange={(event) => setPriority(event.target.value)} value={priority}><option value="">全部优先级</option>{Object.entries(INQUIRY_PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        {canExport ? <a className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 hover:bg-neutral-50" href={inquiryExportUrl({ search, status, priority })}><Download aria-hidden="true" className="size-4" />导出当前结果</a> : null}
      </AdminToolbar>

      {loadError ? <AdminErrorState description={loadError} title="询盘详情加载失败" /> : null}
      {loadingId && !detail ? <AdminLoadingState label="正在加载询盘详情" /> : null}
      {visibleItems.length > 0 ? <AdminDataTable columns={columns} getRowKey={(item) => item.id} mobileLabel={(item) => item.name} mobileListLabel="询盘列表" rows={visibleItems} tableLabel="询盘表格" /> : <AdminEmptyState description="请调整搜索词或筛选条件。" title="没有符合条件的询盘" />}

      {detail ? <InquiryDetail assignees={assignees} canAddNote={canAddNote} canAssign={canAssign} canChangeStatus={canChangeStatus} canRetry={canRetry} inquiry={detail} onClose={() => setDetail(null)} onUpdated={(updated) => { setDetail(updated); setItems((current) => current.map((item) => item.id === updated.id ? updated : item)); }} /> : null}
    </div>
  );
}
