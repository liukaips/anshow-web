import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const contactChannelKinds = [
  "whatsapp",
  "wechat",
  "telegram",
  "phone",
  "email",
] as const;

const timestamp = (name: string) =>
  integer(name, { mode: "timestamp_ms" });
const requiredTimestamp = (name: string) =>
  timestamp(name)
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull();

export const siteSettings = sqliteTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: requiredTimestamp("updated_at"),
  updatedBy: text("updated_by").notNull(),
});

export const contactChannels = sqliteTable(
  "contact_channels",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: contactChannelKinds }).notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    check(
      "contact_channels_kind_check",
      sql`${table.kind} in ('whatsapp', 'wechat', 'telegram', 'phone', 'email')`,
    ),
  ],
);

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  detail: text("detail").notNull(),
  createdAt: requiredTimestamp("created_at"),
});
