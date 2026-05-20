CREATE TABLE `danbooru_tag_aliases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`antecedent_name` text NOT NULL,
	`consequent_name` text NOT NULL,
	`status` text DEFAULT 'active'
);
--> statement-breakpoint
CREATE TABLE `danbooru_tag_implications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`antecedent_name` text NOT NULL,
	`consequent_name` text NOT NULL,
	`status` text DEFAULT 'active'
);
--> statement-breakpoint
CREATE TABLE `danbooru_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`post_count` integer DEFAULT 0,
	`body` text,
	`other_names` text,
	`embedding` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `danbooru_tags_name_unique` ON `danbooru_tags` (`name`);