CREATE TABLE `collection_images` (
	`collection_id` integer NOT NULL,
	`relative_path` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`added_at` text DEFAULT '(datetime(''now''))',
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`cover_image_path` text,
	`is_smart` integer DEFAULT false,
	`smart_criteria` text,
	`created_at` text DEFAULT '(datetime(''now''))',
	`updated_at` text DEFAULT '(datetime(''now''))'
);
--> statement-breakpoint
CREATE TABLE `image_attributes` (
	`relative_path` text PRIMARY KEY NOT NULL,
	`rating` integer DEFAULT 0,
	`color_label` text,
	`flag` text,
	`notes` text,
	`stack_id` integer,
	`metadata_json` text,
	`created_at` text DEFAULT '(datetime(''now''))',
	`updated_at` text DEFAULT '(datetime(''now''))',
	FOREIGN KEY (`stack_id`) REFERENCES `stacks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `image_tags` (
	`relative_path` text NOT NULL,
	`tag_id` integer NOT NULL,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stacks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text,
	`cover_image_path` text,
	`collapsed` integer DEFAULT true,
	`created_at` text DEFAULT '(datetime(''now''))'
);
