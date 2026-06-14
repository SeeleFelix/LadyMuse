CREATE TABLE `trashed_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`original_relative_path` text NOT NULL,
	`trash_path` text NOT NULL,
	`rating` integer DEFAULT 0,
	`flag` text,
	`color_label` text,
	`metadata_json` text,
	`width` integer,
	`height` integer,
	`file_format` text,
	`aspect_ratio` text,
	`deleted_at` text DEFAULT (datetime('now')) NOT NULL
);
