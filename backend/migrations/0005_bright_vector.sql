CREATE TABLE `inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`company` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`transport_need` text NOT NULL,
	`message` text NOT NULL,
	`locale` text NOT NULL,
	`source_url` text NOT NULL,
	`referrer` text,
	`utm_source` text,
	`utm_medium` text,
	`utm_campaign` text,
	`privacy_version` text NOT NULL,
	`consented_at` integer NOT NULL,
	`assignee_id` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inquiries_status_idx` ON `inquiries` (`status`);--> statement-breakpoint
CREATE INDEX `inquiries_assignee_idx` ON `inquiries` (`assignee_id`);--> statement-breakpoint
CREATE INDEX `inquiries_created_idx` ON `inquiries` (`created_at`);--> statement-breakpoint
CREATE TABLE `inquiry_history` (
	`id` text PRIMARY KEY NOT NULL,
	`inquiry_id` text NOT NULL,
	`actor_id` text,
	`assignee_id` text,
	`from_status` text,
	`to_status` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inquiry_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`inquiry_id` text NOT NULL,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notification_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`inquiry_id` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`worker_id` text,
	`claimed_at` integer,
	`sent_at` integer,
	`last_error` text,
	`idempotency_key` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_deliveries_idempotency_key_unique` ON `notification_deliveries` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `notification_due_idx` ON `notification_deliveries` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
