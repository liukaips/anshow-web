import { AdminDataTable, type AdminDataTableColumn } from "../ui/admin-data-table";

export type AdminAuditEvent = Readonly<{
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  detail: Readonly<Record<string, unknown>>;
  createdAt: string;
}>;

const actionLabels: Record<string, string> = {
  "content.create": "创建内容",
  "content.translation.save-draft": "保存内容草稿",
  "content.publish": "发布内容",
  "content.archive": "归档内容",
  "media.upload": "上传图片",
  "media.update": "更新图片信息",
  "staff.disable": "停用员工账号",
  "staff.enable": "启用员工账号",
  "staff.roles.update": "调整员工角色",
  "settings.update": "更新系统设置",
};

const entityLabels: Record<string, string> = {
  services: "服务内容",
  pages: "页面内容",
  articles: "文章内容",
  media: "媒体文件",
  staff: "员工账号",
  settings: "系统设置",
};

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function AuditList({ items }: { items: readonly AdminAuditEvent[] }) {
  const columns: readonly AdminDataTableColumn<AdminAuditEvent>[] = [
    { key: "time", header: "操作时间", render: (item) => <time className="tabular-nums" dateTime={item.createdAt}>{formatTime(item.createdAt)}</time> },
    { key: "actor", header: "操作人员", render: (item) => item.actorId },
    { key: "action", header: "操作", render: (item) => actionLabels[item.action] ?? "系统操作" },
    { key: "entity", header: "操作对象", render: (item) => entityLabels[item.entityType] ?? "业务数据" },
    { key: "detail", header: "详情", render: (item) => (
      <details>
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-[var(--color-cyan-ink)]">查看详情</summary>
        <dl className="grid gap-1 pb-2 text-xs text-neutral-600">
          {Object.entries(item.detail).map(([key, value]) => <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2" key={key}><dt>{key}</dt><dd className="break-words">{String(value)}</dd></div>)}
        </dl>
      </details>
    ) },
  ];

  if (items.length === 0) {
    return <div className="border border-neutral-200 bg-white px-4 py-12 text-center"><h2 className="text-lg font-semibold">暂无审计记录</h2><p className="mt-2 text-sm text-neutral-600">系统操作记录将在这里显示。</p></div>;
  }
  return <AdminDataTable columns={columns} getRowKey={(item) => item.id} mobileLabel={(item) => actionLabels[item.action] ?? "系统操作"} mobileListLabel="审计记录列表" rows={items} tableLabel="审计记录" />;
}
