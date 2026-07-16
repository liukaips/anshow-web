ALTER TABLE `inquiries` ADD `priority` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `inquiries` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `inquiries` SET `updated_at` = `created_at` WHERE `updated_at` = 0;--> statement-breakpoint
ALTER TABLE `inquiries` ADD `closed_at` integer;--> statement-breakpoint
CREATE INDEX `inquiries_priority_status_idx` ON `inquiries` (`priority`,`status`);--> statement-breakpoint
CREATE INDEX `inquiries_updated_idx` ON `inquiries` (`updated_at`);
