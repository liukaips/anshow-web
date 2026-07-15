import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const inquiries = sqliteTable("inquiries", {
  id: text("id").primaryKey(), name: text("name").notNull(), company: text("company").notNull(),
  email: text("email").notNull(), phone: text("phone").notNull(), transportNeed: text("transport_need").notNull(),
  message: text("message").notNull(), locale: text("locale").notNull(), sourceUrl: text("source_url").notNull(),
  referrer: text("referrer"), utmSource: text("utm_source"), utmMedium: text("utm_medium"), utmCampaign: text("utm_campaign"),
  privacyVersion: text("privacy_version").notNull(), consentedAt: integer("consented_at").notNull(),
  assigneeId: text("assignee_id"), status: text("status").notNull(), createdAt: integer("created_at").notNull(),
}, (table) => [index("inquiries_status_idx").on(table.status), index("inquiries_assignee_idx").on(table.assigneeId), index("inquiries_created_idx").on(table.createdAt)]);

export const inquiryNotes = sqliteTable("inquiry_notes", {
  id: text("id").primaryKey(), inquiryId: text("inquiry_id").notNull(), authorId: text("author_id").notNull(), body: text("body").notNull(), createdAt: integer("created_at").notNull(),
});
export const inquiryHistory = sqliteTable("inquiry_history", {
  id: text("id").primaryKey(), inquiryId: text("inquiry_id").notNull(), actorId: text("actor_id"), assigneeId: text("assignee_id"), fromStatus: text("from_status"), toStatus: text("to_status").notNull(), createdAt: integer("created_at").notNull(),
});
export const notificationDeliveries = sqliteTable("notification_deliveries", {
  id: text("id").primaryKey(), inquiryId: text("inquiry_id").notNull(), status: text("status").notNull(), attempts: integer("attempts").notNull(), nextAttemptAt: integer("next_attempt_at").notNull(), workerId: text("worker_id"), claimedAt: integer("claimed_at"), sentAt: integer("sent_at"), lastError: text("last_error"), idempotencyKey: text("idempotency_key").notNull().unique(),
}, (table) => [index("notification_due_idx").on(table.status, table.nextAttemptAt)]);
export const rateLimits = sqliteTable("rate_limits", { key: text("key").primaryKey(), count: integer("count").notNull(), expiresAt: integer("expires_at").notNull() });
