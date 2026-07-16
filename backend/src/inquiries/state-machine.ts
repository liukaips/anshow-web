import { inquiryStatuses } from "../db/schema/inquiries.js";

export const INQUIRY_STATUSES = inquiryStatuses;

export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

const transitions: Record<InquiryStatus, readonly InquiryStatus[]> = {
  new: ["pending_follow_up", "in_progress", "closed", "spam"],
  pending_follow_up: ["in_progress", "waiting_customer", "closed", "spam"],
  in_progress: ["pending_follow_up", "waiting_customer", "completed", "closed", "spam"],
  waiting_customer: ["pending_follow_up", "in_progress", "completed", "spam"],
  completed: ["in_progress", "closed"],
  closed: ["in_progress"],
  spam: ["new"],
};

export function canTransition(from: InquiryStatus, to: InquiryStatus): boolean {
  return transitions[from].includes(to);
}

export function assertInquiryTransition(from: InquiryStatus, to: InquiryStatus): void {
  if (!canTransition(from, to)) {
    throw new Error("不允许从当前状态变更为目标状态");
  }
}
