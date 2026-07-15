import nodemailer from "nodemailer";
import type { DeliveryJob } from "./outbox.js";

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
};

export function createMailer(config: SmtpConfig) {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.password },
    tls: { rejectUnauthorized: true },
  });

  return {
    send(job: DeliveryJob & { subject?: string; html?: string }) {
      return transport.sendMail({
        from: config.from,
        to: job.to,
        subject: job.subject ?? "AnShow notification",
        html: job.html ?? "",
        messageId: `<${job.idempotencyKey}@anshow>`,
      });
    },
  };
}
