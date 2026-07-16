import { redirect } from "next/navigation";
import { listAdminReviews } from "@/api/admin-reviews.server";
import { getAdminSession } from "@/api/server";
import { ReviewCenter } from "@/components/admin/review/review-center";
import { AdminPage } from "@/components/admin/ui/admin-page";

export default async function ReviewsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!session.permissions.includes("content.review")) redirect("/admin");
  return <AdminPage description="检查三种语言、页面预览和内容事实，确认无误后批准，或填写原因退回修改。" eyebrow="内容" title="审核中心"><ReviewCenter initialItems={await listAdminReviews()} /></AdminPage>;
}
