PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_preview_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`content_hash` text NOT NULL,
	`source_versions` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`expires_at` integer,
	`scheduled_at` integer,
	`schedule_claimed_at` integer,
	`schedule_claimed_by` text,
	`published_at` integer,
	CONSTRAINT "preview_snapshots_hash_format_check" CHECK(length("__new_preview_snapshots"."content_hash") = 64 and "__new_preview_snapshots"."content_hash" not glob '*[^0-9a-f]*'),
	CONSTRAINT "preview_snapshots_expiry_check" CHECK("__new_preview_snapshots"."expires_at" is null or "__new_preview_snapshots"."expires_at" > "__new_preview_snapshots"."created_at"),
	CONSTRAINT "preview_snapshots_schedule_claim_check" CHECK(("__new_preview_snapshots"."schedule_claimed_at" is null and "__new_preview_snapshots"."schedule_claimed_by" is null) or ("__new_preview_snapshots"."schedule_claimed_at" is not null and "__new_preview_snapshots"."schedule_claimed_by" is not null)),
	CONSTRAINT "preview_snapshots_schedule_before_expiry_check" CHECK("__new_preview_snapshots"."scheduled_at" is null or "__new_preview_snapshots"."expires_at" is null or "__new_preview_snapshots"."scheduled_at" < "__new_preview_snapshots"."expires_at")
);
--> statement-breakpoint
INSERT INTO `__new_preview_snapshots`("id", "payload", "content_hash", "source_versions", "created_by", "created_at", "expires_at", "scheduled_at", "schedule_claimed_at", "schedule_claimed_by", "published_at") SELECT "id", "payload", "content_hash", "source_versions", "created_by", "created_at", "expires_at", NULL, NULL, NULL, "published_at" FROM `preview_snapshots`;--> statement-breakpoint
DROP TABLE `preview_snapshots`;--> statement-breakpoint
ALTER TABLE `__new_preview_snapshots` RENAME TO `preview_snapshots`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `preview_snapshots_created_idx` ON `preview_snapshots` (`created_at`);
