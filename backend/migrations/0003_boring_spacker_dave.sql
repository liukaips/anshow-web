DROP INDEX `article_translations_locale_slug_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `article_translations_locale_slug_unique` ON `article_translations` (`locale`,`slug`) WHERE "article_translations"."slug" <> '';--> statement-breakpoint
DROP INDEX `cargo_type_translations_locale_slug_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `cargo_type_translations_locale_slug_unique` ON `cargo_type_translations` (`locale`,`slug`) WHERE "cargo_type_translations"."slug" <> '';--> statement-breakpoint
DROP INDEX `case_study_translations_locale_slug_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `case_study_translations_locale_slug_unique` ON `case_study_translations` (`locale`,`slug`) WHERE "case_study_translations"."slug" <> '';--> statement-breakpoint
DROP INDEX `certificate_translations_locale_slug_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `certificate_translations_locale_slug_unique` ON `certificate_translations` (`locale`,`slug`) WHERE "certificate_translations"."slug" <> '';--> statement-breakpoint
DROP INDEX `hero_slide_translations_locale_slug_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `hero_slide_translations_locale_slug_unique` ON `hero_slide_translations` (`locale`,`slug`) WHERE "hero_slide_translations"."slug" <> '';--> statement-breakpoint
DROP INDEX `navigation_item_translations_locale_slug_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `navigation_item_translations_locale_slug_unique` ON `navigation_item_translations` (`locale`,`slug`) WHERE "navigation_item_translations"."slug" <> '';--> statement-breakpoint
DROP INDEX `page_translations_locale_slug_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `page_translations_locale_slug_unique` ON `page_translations` (`locale`,`slug`) WHERE "page_translations"."slug" <> '';--> statement-breakpoint
DROP INDEX `partner_translations_locale_slug_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `partner_translations_locale_slug_unique` ON `partner_translations` (`locale`,`slug`) WHERE "partner_translations"."slug" <> '';--> statement-breakpoint
DROP INDEX `proof_metric_translations_locale_slug_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `proof_metric_translations_locale_slug_unique` ON `proof_metric_translations` (`locale`,`slug`) WHERE "proof_metric_translations"."slug" <> '';--> statement-breakpoint
DROP INDEX `service_translations_locale_slug_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `service_translations_locale_slug_unique` ON `service_translations` (`locale`,`slug`) WHERE "service_translations"."slug" <> '';--> statement-breakpoint
DROP INDEX `trade_lane_translations_locale_slug_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `trade_lane_translations_locale_slug_unique` ON `trade_lane_translations` (`locale`,`slug`) WHERE "trade_lane_translations"."slug" <> '';