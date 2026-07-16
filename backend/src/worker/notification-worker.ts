import { renderSalesEmail, renderVisitorEmail, type InquiryEmailInput } from "../inquiries/email-template.js";

type ClaimedDelivery = {
  id: string;
  inquiryId: string;
  attempts: number;
  idempotencyKey: string;
};

type NotificationRepository = {
  claimDue(workerId: string): ClaimedDelivery | null;
  get(id: string): InquiryEmailInput | null;
  markFailed(id: string, error: string): void;
  markSent(id: string): void;
};

type Mailer = {
  send(input: ClaimedDelivery & { to: string; subject: string; html: string }): Promise<unknown>;
};

export async function processInquiryNotification(
  repository: NotificationRepository,
  mailer: Mailer,
  salesEmail: string,
  workerId: string,
) {
  const job = repository.claimDue(workerId);
  if (!job) return { processed: false as const };

  try {
    const inquiry = repository.get(job.inquiryId);
    if (!inquiry) throw new Error("询盘不存在");
    await mailer.send({ ...job, ...renderSalesEmail(inquiry), to: salesEmail });
    if (inquiry.email) {
      await mailer.send({
        ...job,
        ...renderVisitorEmail(inquiry.locale),
        idempotencyKey: `${job.idempotencyKey}:visitor`,
        to: inquiry.email,
      });
    }
    repository.markSent(job.id);
    return { processed: true as const, status: "sent" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    repository.markFailed(job.id, message);
    return { processed: true as const, status: "retry" as const };
  }
}
