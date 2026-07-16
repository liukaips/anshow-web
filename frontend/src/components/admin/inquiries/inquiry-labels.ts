import type { AdminInquiryPriority, AdminInquiryStatus } from "@/api/admin-inquiries";

export const INQUIRY_STATUS_LABELS: Record<AdminInquiryStatus, string> = {
  new: "新询盘",
  pending_follow_up: "待跟进",
  in_progress: "跟进中",
  waiting_customer: "等待客户",
  completed: "已完成",
  closed: "已关闭",
  spam: "垃圾询盘",
};

export const INQUIRY_PRIORITY_LABELS: Record<AdminInquiryPriority, string> = {
  low: "低",
  normal: "普通",
  high: "高",
  urgent: "紧急",
};

export const INQUIRY_PRIORITY_STYLES: Record<AdminInquiryPriority, string> = {
  low: "border-neutral-300 bg-neutral-50 text-neutral-700",
  normal: "border-sky-200 bg-sky-50 text-sky-800",
  high: "border-amber-200 bg-amber-50 text-amber-900",
  urgent: "border-red-300 bg-red-50 text-red-900",
};

export function formatInquiryTime(value: number): string {
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
