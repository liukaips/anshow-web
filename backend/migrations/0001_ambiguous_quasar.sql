CREATE TABLE `article_translations` (
	`article_id` text NOT NULL,
	`locale` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_at` integer,
	`published_at` integer,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`seo_title` text NOT NULL,
	`seo_description` text NOT NULL,
	`alt_text` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`article_id`, `locale`),
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `article_translations_locale_slug_unique` ON `article_translations` (`locale`,`slug`);--> statement-breakpoint
CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`media_id` text,
	`process_stage_id` text,
	`archived_at` integer,
	`verified_at` integer,
	`verification_source` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_code_unique` ON `articles` (`code`);--> statement-breakpoint
CREATE TABLE `cargo_type_translations` (
	`cargo_type_id` text NOT NULL,
	`locale` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_at` integer,
	`published_at` integer,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`seo_title` text NOT NULL,
	`seo_description` text NOT NULL,
	`alt_text` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`cargo_type_id`, `locale`),
	FOREIGN KEY (`cargo_type_id`) REFERENCES `cargo_types`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cargo_type_translations_locale_slug_unique` ON `cargo_type_translations` (`locale`,`slug`);--> statement-breakpoint
CREATE TABLE `cargo_types` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`media_id` text,
	`process_stage_id` text,
	`archived_at` integer,
	`verified_at` integer,
	`verification_source` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cargo_types_code_unique` ON `cargo_types` (`code`);--> statement-breakpoint
CREATE TABLE `case_studies` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`media_id` text,
	`process_stage_id` text,
	`archived_at` integer,
	`verified_at` integer,
	`verification_source` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `case_studies_code_unique` ON `case_studies` (`code`);--> statement-breakpoint
CREATE TABLE `case_study_translations` (
	`case_study_id` text NOT NULL,
	`locale` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_at` integer,
	`published_at` integer,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`seo_title` text NOT NULL,
	`seo_description` text NOT NULL,
	`alt_text` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`case_study_id`, `locale`),
	FOREIGN KEY (`case_study_id`) REFERENCES `case_studies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `case_study_translations_locale_slug_unique` ON `case_study_translations` (`locale`,`slug`);--> statement-breakpoint
CREATE TABLE `certificate_translations` (
	`certificate_id` text NOT NULL,
	`locale` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_at` integer,
	`published_at` integer,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`seo_title` text NOT NULL,
	`seo_description` text NOT NULL,
	`alt_text` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`certificate_id`, `locale`),
	FOREIGN KEY (`certificate_id`) REFERENCES `certificates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `certificate_translations_locale_slug_unique` ON `certificate_translations` (`locale`,`slug`);--> statement-breakpoint
CREATE TABLE `certificates` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`media_id` text,
	`process_stage_id` text,
	`archived_at` integer,
	`verified_at` integer,
	`verification_source` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `certificates_code_unique` ON `certificates` (`code`);--> statement-breakpoint
CREATE TABLE `hero_slide_translations` (
	`hero_slide_id` text NOT NULL,
	`locale` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_at` integer,
	`published_at` integer,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`seo_title` text NOT NULL,
	`seo_description` text NOT NULL,
	`alt_text` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`hero_slide_id`, `locale`),
	FOREIGN KEY (`hero_slide_id`) REFERENCES `hero_slides`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hero_slide_translations_locale_slug_unique` ON `hero_slide_translations` (`locale`,`slug`);--> statement-breakpoint
CREATE TABLE `hero_slides` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`media_id` text,
	`process_stage_id` text,
	`archived_at` integer,
	`verified_at` integer,
	`verification_source` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hero_slides_code_unique` ON `hero_slides` (`code`);--> statement-breakpoint
CREATE TABLE `media_asset_translations` (
	`media_id` text NOT NULL,
	`locale` text NOT NULL,
	`alt_text` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`media_id`, `locale`),
	FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`dominant_color` text NOT NULL,
	`focal_x` real DEFAULT 0.5 NOT NULL,
	`focal_y` real DEFAULT 0.5 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`replaced_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_assets_storage_key_unique` ON `media_assets` (`storage_key`);--> statement-breakpoint
CREATE TABLE `media_derivatives` (
	`id` text PRIMARY KEY NOT NULL,
	`media_id` text NOT NULL,
	`format` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`byte_size` integer NOT NULL,
	`url` text NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_derivatives_url_unique` ON `media_derivatives` (`url`);--> statement-breakpoint
CREATE UNIQUE INDEX `media_derivatives_variant_unique` ON `media_derivatives` (`media_id`,`format`,`width`,`height`);--> statement-breakpoint
CREATE TABLE `media_usage` (
	`media_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`field` text NOT NULL,
	PRIMARY KEY(`media_id`, `entity_type`, `entity_id`, `field`),
	FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `navigation_item_translations` (
	`navigation_item_id` text NOT NULL,
	`locale` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_at` integer,
	`published_at` integer,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`seo_title` text NOT NULL,
	`seo_description` text NOT NULL,
	`alt_text` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`navigation_item_id`, `locale`),
	FOREIGN KEY (`navigation_item_id`) REFERENCES `navigation_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `navigation_item_translations_locale_slug_unique` ON `navigation_item_translations` (`locale`,`slug`);--> statement-breakpoint
CREATE TABLE `navigation_items` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`media_id` text,
	`process_stage_id` text,
	`archived_at` integer,
	`verified_at` integer,
	`verification_source` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `navigation_items_code_unique` ON `navigation_items` (`code`);--> statement-breakpoint
CREATE TABLE `page_translations` (
	`page_id` text NOT NULL,
	`locale` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_at` integer,
	`published_at` integer,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`seo_title` text NOT NULL,
	`seo_description` text NOT NULL,
	`alt_text` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`page_id`, `locale`),
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `page_translations_locale_slug_unique` ON `page_translations` (`locale`,`slug`);--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`media_id` text,
	`process_stage_id` text,
	`archived_at` integer,
	`verified_at` integer,
	`verification_source` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pages_code_unique` ON `pages` (`code`);--> statement-breakpoint
CREATE TABLE `partner_translations` (
	`partner_id` text NOT NULL,
	`locale` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_at` integer,
	`published_at` integer,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`seo_title` text NOT NULL,
	`seo_description` text NOT NULL,
	`alt_text` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`partner_id`, `locale`),
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partner_translations_locale_slug_unique` ON `partner_translations` (`locale`,`slug`);--> statement-breakpoint
CREATE TABLE `partners` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`media_id` text,
	`process_stage_id` text,
	`archived_at` integer,
	`verified_at` integer,
	`verification_source` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partners_code_unique` ON `partners` (`code`);--> statement-breakpoint
CREATE TABLE `proof_metric_translations` (
	`proof_metric_id` text NOT NULL,
	`locale` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_at` integer,
	`published_at` integer,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`seo_title` text NOT NULL,
	`seo_description` text NOT NULL,
	`alt_text` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`proof_metric_id`, `locale`),
	FOREIGN KEY (`proof_metric_id`) REFERENCES `proof_metrics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proof_metric_translations_locale_slug_unique` ON `proof_metric_translations` (`locale`,`slug`);--> statement-breakpoint
CREATE TABLE `proof_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`media_id` text,
	`process_stage_id` text,
	`archived_at` integer,
	`verified_at` integer,
	`verification_source` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proof_metrics_code_unique` ON `proof_metrics` (`code`);--> statement-breakpoint
CREATE TABLE `service_translations` (
	`service_id` text NOT NULL,
	`locale` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_at` integer,
	`published_at` integer,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`seo_title` text NOT NULL,
	`seo_description` text NOT NULL,
	`alt_text` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`service_id`, `locale`),
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_translations_locale_slug_unique` ON `service_translations` (`locale`,`slug`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`media_id` text,
	`process_stage_id` text,
	`archived_at` integer,
	`verified_at` integer,
	`verification_source` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `services_code_unique` ON `services` (`code`);--> statement-breakpoint
CREATE TABLE `trade_lane_translations` (
	`trade_lane_id` text NOT NULL,
	`locale` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_at` integer,
	`published_at` integer,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`body` text NOT NULL,
	`seo_title` text NOT NULL,
	`seo_description` text NOT NULL,
	`alt_text` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`trade_lane_id`, `locale`),
	FOREIGN KEY (`trade_lane_id`) REFERENCES `trade_lanes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trade_lane_translations_locale_slug_unique` ON `trade_lane_translations` (`locale`,`slug`);--> statement-breakpoint
CREATE TABLE `trade_lanes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`media_id` text,
	`process_stage_id` text,
	`archived_at` integer,
	`verified_at` integer,
	`verification_source` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trade_lanes_code_unique` ON `trade_lanes` (`code`);