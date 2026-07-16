import { redirect } from "next/navigation";

import { getAdminInquiryServer, listAdminInquiries } from "@/api/admin-inquiries.server";
import { getAdminSession } from "@/api/server";
import { InquiryList } from "@/components/admin/inquiries/inquiry-list";
import { AdminPage } from "@/components/admin/ui/admin-page";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function InquiriesPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!session.permissions.includes("inquiry.read")) redirect("/admin");
  const query = await searchParams;
  const selectedId = first(query.selected);
  const [items, initialDetail] = await Promise.all([
    listAdminInquiries(),
    selectedId ? getAdminInquiryServer(selectedId) : Promise.resolve(undefined),
  ]);
  return (
    <AdminPage
      description="集中处理客户运输需求，分配负责人并记录每次跟进。"
      eyebrow="业务"
      title="询盘管理"
    >
      <InquiryList
        assignees={[{ id: session.user.id, name: "我", email: session.user.email }]}
        canAddNote={session.permissions.includes("inquiry.note")}
        canAssign={session.permissions.includes("inquiry.assign")}
        canChangeStatus={session.permissions.includes("inquiry.status")}
        canExport={session.permissions.includes("inquiry.export")}
        canRetry={session.permissions.includes("inquiry.retry")}
        initialDetail={initialDetail}
        initialPriority={first(query.priority)}
        initialSearch={first(query.search)}
        initialStatus={first(query.status)}
        initialItems={items}
      />
    </AdminPage>
  );
}
