CREATE TABLE `danbooru_sync_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topic` text NOT NULL,
	`synced_at` text NOT NULL,
	`tag_count` integer NOT NULL,
	`descriptions_fetched` integer NOT NULL,
	`descriptions_pending` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `danbooru_tag_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topic` text NOT NULL,
	`section` text NOT NULL,
	`tag_name` text NOT NULL,
	`post_count` integer,
	`description` text,
	`synced_at` text NOT NULL
);