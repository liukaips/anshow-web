CREATE TABLE `backup_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`target` text NOT NULL,
	`storage_key` text,
	`size_bytes` integer,
	`sha256` text,
	`actor_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`verified_at` integer,
	`restore_staged_at` integer,
	`error` text,
	CONSTRAINT "backup_runs_status_check" CHECK("backup_runs"."status" in ('running', 'succeeded', 'failed', 'verified')),
	CONSTRAINT "backup_runs_target_check" CHECK("backup_runs"."target" in ('local', 'cos'))
);
--> statement-breakpoint
CREATE INDEX `backup_runs_status_started_idx` ON `backup_runs` (`status`,`started_at`);--> statement-breakpoint
CREATE INDEX `backup_runs_started_idx` ON `backup_runs` (`started_at`);
