CREATE TABLE `sync_state` (
	`key` text NOT NULL,
	`last_cursor` text,
	`synced_count` integer DEFAULT 0,
	`updated_at` text DEFAULT '(datetime(''now''))'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_state_key_unique` ON `sync_state` (`key`);--> statement-breakpoint
ALTER TABLE `cached_models` ADD `civitai_id` integer;--> statement-breakpoint
ALTER TABLE `cached_models` ADD `type` text;--> statement-breakpoint
ALTER TABLE `cached_models` ADD `base_model` text;--> statement-breakpoint
ALTER TABLE `cached_models` ADD `tags` text;--> statement-breakpoint
ALTER TABLE `cached_models` ADD `download_count` integer;