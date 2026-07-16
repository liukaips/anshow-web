import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const workflowStates = [
  "draft",
  "translation_pending",
  "review_pending",
  "changes_requested",
  "approved",
  "scheduled",
  "published",
  "archived",
] as const;

export type WorkflowState = (typeof workflowStates)[number];

export const reviewDecisions = [
  "pending",
  "approved",
  "changes_requested",
] as const;
export const translationJobStatuses = [
  "queued",
  "running",
  "succeeded",
  "failed",
] as const;
export const translationTargetLocales = ["en", "ru"] as const;

const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });
const requiredTimestamp = (name: string) =>
  timestamp(name)
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull();

export const contentWorkflow = sqliteTable(
  "content_workflow",
  {
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    state: text("state", { enum: workflowStates }).notNull().default("draft"),
    ownerId: text("owner_id"),
    version: integer("version").notNull().default(1),
    submittedAt: timestamp("submitted_at"),
    updatedAt: requiredTimestamp("updated_at"),
  },
  (table) => [
    primaryKey({ columns: [table.entityType, table.entityId] }),
    check(
      "content_workflow_state_check",
      sql`${table.state} in ('draft', 'translation_pending', 'review_pending', 'changes_requested', 'approved', 'scheduled', 'published', 'archived')`,
    ),
    check("content_workflow_version_positive", sql`${table.version} > 0`),
    index("content_workflow_state_idx").on(table.state, table.updatedAt),
    index("content_workflow_owner_idx").on(table.ownerId, table.updatedAt),
  ],
);

export const contentReviews = sqliteTable(
  "content_reviews",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    sourceVersion: integer("source_version").notNull(),
    submittedBy: text("submitted_by").notNull(),
    reviewerId: text("reviewer_id"),
    decision: text("decision", { enum: reviewDecisions })
      .notNull()
      .default("pending"),
    reason: text("reason"),
    submittedAt: requiredTimestamp("submitted_at"),
    decidedAt: timestamp("decided_at"),
  },
  (table) => [
    check(
      "content_reviews_decision_check",
      sql`${table.decision} in ('pending', 'approved', 'changes_requested')`,
    ),
    check("content_reviews_version_positive", sql`${table.sourceVersion} > 0`),
    check(
      "content_reviews_decision_tuple_check",
      sql`(
        (${table.decision} = 'pending' and ${table.reviewerId} is null and ${table.decidedAt} is null)
        or (${table.decision} = 'approved' and ${table.reviewerId} is not null and ${table.decidedAt} is not null)
        or (${table.decision} = 'changes_requested' and ${table.reviewerId} is not null and ${table.decidedAt} is not null and ${table.reason} is not null and length(trim(${table.reason})) > 0)
      )`,
    ),
    index("content_reviews_queue_idx").on(
      table.decision,
      table.submittedAt,
    ),
    index("content_reviews_entity_idx").on(
      table.entityType,
      table.entityId,
      table.sourceVersion,
    ),
  ],
);

export const translationJobs = sqliteTable(
  "translation_jobs",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    sourceVersion: integer("source_version").notNull(),
    targetLocale: text("target_locale", {
      enum: translationTargetLocales,
    }).notNull(),
    status: text("status", { enum: translationJobStatuses })
      .notNull()
      .default("queued"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: requiredTimestamp("created_at"),
    updatedAt: requiredTimestamp("updated_at"),
  },
  (table) => [
    unique("translation_jobs_source_target_unique").on(
      table.entityType,
      table.entityId,
      table.sourceVersion,
      table.targetLocale,
    ),
    check(
      "translation_jobs_target_locale_check",
      sql`${table.targetLocale} in ('en', 'ru')`,
    ),
    check(
      "translation_jobs_status_check",
      sql`${table.status} in ('queued', 'running', 'succeeded', 'failed')`,
    ),
    check("translation_jobs_version_positive", sql`${table.sourceVersion} > 0`),
    check("translation_jobs_attempts_nonnegative", sql`${table.attempts} >= 0`),
    index("translation_jobs_queue_idx").on(table.status, table.updatedAt),
  ],
);

export type PreviewSourceVersion = {
  entityType: string;
  entityId: string;
  version: number;
};

export const previewSnapshots = sqliteTable(
  "preview_snapshots",
  {
    id: text("id").primaryKey(),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    contentHash: text("content_hash").notNull(),
    sourceVersions: text("source_versions", { mode: "json" })
      .$type<PreviewSourceVersion[]>()
      .notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: requiredTimestamp("created_at"),
    expiresAt: timestamp("expires_at"),
    scheduledAt: timestamp("scheduled_at"),
    scheduleClaimedAt: timestamp("schedule_claimed_at"),
    scheduleClaimedBy: text("schedule_claimed_by"),
    publishedAt: timestamp("published_at"),
  },
  (table) => [
    check(
      "preview_snapshots_hash_format_check",
      sql`length(${table.contentHash}) = 64 and ${table.contentHash} not glob '*[^0-9a-f]*'`,
    ),
    check(
      "preview_snapshots_expiry_check",
      sql`${table.expiresAt} is null or ${table.expiresAt} > ${table.createdAt}`,
    ),
    check(
      "preview_snapshots_schedule_claim_check",
      sql`(${table.scheduleClaimedAt} is null and ${table.scheduleClaimedBy} is null) or (${table.scheduleClaimedAt} is not null and ${table.scheduleClaimedBy} is not null)`,
    ),
    check(
      "preview_snapshots_schedule_before_expiry_check",
      sql`${table.scheduledAt} is null or ${table.expiresAt} is null or ${table.scheduledAt} < ${table.expiresAt}`,
    ),
    index("preview_snapshots_created_idx").on(table.createdAt),
  ],
);

export const previewTokens = sqliteTable(
  "preview_tokens",
  {
    id: text("id").primaryKey(),
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => previewSnapshots.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: requiredTimestamp("created_at"),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => [
    uniqueIndex("preview_tokens_token_hash_unique").on(table.tokenHash),
    check(
      "preview_tokens_hash_format_check",
      sql`length(${table.tokenHash}) = 64 and ${table.tokenHash} not glob '*[^0-9a-f]*'`,
    ),
    check(
      "preview_tokens_expiry_check",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    check(
      "preview_tokens_revocation_check",
      sql`${table.revokedAt} is null or ${table.revokedAt} >= ${table.createdAt}`,
    ),
    index("preview_tokens_snapshot_idx").on(table.snapshotId),
  ],
);
