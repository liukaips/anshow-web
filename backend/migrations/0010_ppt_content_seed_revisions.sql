CREATE TABLE `content_seed_revisions` (
	`collection` text NOT NULL,
	`owner_id` text NOT NULL,
	`locale` text NOT NULL,
	`seed_version` integer NOT NULL,
	`applied_fingerprint` text NOT NULL,
	`applied_at` integer NOT NULL,
	PRIMARY KEY(`collection`, `owner_id`, `locale`),
	CONSTRAINT "content_seed_revisions_locale_check" CHECK("content_seed_revisions"."locale" in ('en', 'zh', 'ru'))
);
