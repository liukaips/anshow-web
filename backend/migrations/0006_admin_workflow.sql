CREATE TABLE `content_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`source_version` integer NOT NULL,
	`submitted_by` text NOT NULL,
	`reviewer_id` text,
	`decision` text DEFAULT 'pending' NOT NULL,
	`reason` text,
	`submitted_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`decided_at` integer,
	CONSTRAINT "content_reviews_decision_check" CHECK("content_reviews"."decision" in ('pending', 'approved', 'changes_requested')),
	CONSTRAINT "content_reviews_version_positive" CHECK("content_reviews"."source_version" > 0),
	CONSTRAINT "content_reviews_decision_tuple_check" CHECK((
        ("content_reviews"."decision" = 'pending' and "content_reviews"."reviewer_id" is null and "content_reviews"."decided_at" is null)
        or ("content_reviews"."decision" = 'approved' and "content_reviews"."reviewer_id" is not null and "content_reviews"."decided_at" is not null)
        or ("content_reviews"."decision" = 'changes_requested' and "content_reviews"."reviewer_id" is not null and "content_reviews"."decided_at" is not null and "content_reviews"."reason" is not null and length(trim("content_reviews"."reason")) > 0)
      ))
);
--> statement-breakpoint
CREATE INDEX `content_reviews_queue_idx` ON `content_reviews` (`decision`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `content_reviews_entity_idx` ON `content_reviews` (`entity_type`,`entity_id`,`source_version`);--> statement-breakpoint
CREATE TABLE `content_workflow` (
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`state` text DEFAULT 'draft' NOT NULL,
	`owner_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`submitted_at` integer,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`entity_type`, `entity_id`),
	CONSTRAINT "content_workflow_state_check" CHECK("content_workflow"."state" in ('draft', 'translation_pending', 'review_pending', 'changes_requested', 'approved', 'scheduled', 'published', 'archived')),
	CONSTRAINT "content_workflow_version_positive" CHECK("content_workflow"."version" > 0)
);
--> statement-breakpoint
CREATE INDEX `content_workflow_state_idx` ON `content_workflow` (`state`,`updated_at`);--> statement-breakpoint
CREATE INDEX `content_workflow_owner_idx` ON `content_workflow` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `preview_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`content_hash` text NOT NULL,
	`source_versions` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`expires_at` integer,
	`published_at` integer,
	CONSTRAINT "preview_snapshots_hash_format_check" CHECK(length("preview_snapshots"."content_hash") = 64 and "preview_snapshots"."content_hash" not glob '*[^0-9a-f]*'),
	CONSTRAINT "preview_snapshots_expiry_check" CHECK("preview_snapshots"."expires_at" is null or "preview_snapshots"."expires_at" > "preview_snapshots"."created_at")
);
--> statement-breakpoint
CREATE INDEX `preview_snapshots_created_idx` ON `preview_snapshots` (`created_at`);--> statement-breakpoint
CREATE TABLE `preview_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`snapshot_id`) REFERENCES `preview_snapshots`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "preview_tokens_hash_format_check" CHECK(length("preview_tokens"."token_hash") = 64 and "preview_tokens"."token_hash" not glob '*[^0-9a-f]*'),
	CONSTRAINT "preview_tokens_expiry_check" CHECK("preview_tokens"."expires_at" > "preview_tokens"."created_at"),
	CONSTRAINT "preview_tokens_revocation_check" CHECK("preview_tokens"."revoked_at" is null or "preview_tokens"."revoked_at" >= "preview_tokens"."created_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `preview_tokens_token_hash_unique` ON `preview_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `preview_tokens_snapshot_idx` ON `preview_tokens` (`snapshot_id`);--> statement-breakpoint
CREATE TABLE `translation_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`source_version` integer NOT NULL,
	`target_locale` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "translation_jobs_target_locale_check" CHECK("translation_jobs"."target_locale" in ('en', 'ru')),
	CONSTRAINT "translation_jobs_status_check" CHECK("translation_jobs"."status" in ('queued', 'running', 'succeeded', 'failed')),
	CONSTRAINT "translation_jobs_version_positive" CHECK("translation_jobs"."source_version" > 0),
	CONSTRAINT "translation_jobs_attempts_nonnegative" CHECK("translation_jobs"."attempts" >= 0)
);
--> statement-breakpoint
CREATE INDEX `translation_jobs_queue_idx` ON `translation_jobs` (`status`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `translation_jobs_source_target_unique` ON `translation_jobs` (`entity_type`,`entity_id`,`source_version`,`target_locale`);