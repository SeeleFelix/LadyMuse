CREATE TABLE `art_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`name_zh` text,
	`description` text,
	`icon` text,
	`sort_order` integer DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX `art_categories_slug_unique` ON `art_categories` (`slug`);--> statement-breakpoint
CREATE TABLE `art_subcategories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`name_zh` text,
	`description` text,
	`sort_order` integer DEFAULT 0,
	FOREIGN KEY (`category_id`) REFERENCES `art_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `art_subcategories_slug_unique` ON `art_subcategories` (`slug`);--> statement-breakpoint
CREATE TABLE `art_techniques` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subcategory_id` integer NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`name_zh` text,
	`description` text,
	`prompt_keywords` text NOT NULL,
	`weight_hint` real DEFAULT 1,
	`negative_keywords` text,
	`example_image` text,
	`tags` text,
	`mood_tags` text,
	`difficulty` text DEFAULT 'beginner',
	`sort_order` integer DEFAULT 0,
	FOREIGN KEY (`subcategory_id`) REFERENCES `art_subcategories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `art_techniques_slug_unique` ON `art_techniques` (`slug`);--> statement-breakpoint
CREATE TABLE `generation_ratings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`generation_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`is_favorite` integer DEFAULT false,
	`notes` text,
	`effective_keywords` text,
	`created_at` text DEFAULT '2026-04-19T09:50:05.660Z',
	FOREIGN KEY (`generation_id`) REFERENCES `generations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `generations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prompt_id` integer NOT NULL,
	`comfyui_job_id` text,
	`image_path` text NOT NULL,
	`thumbnail_path` text,
	`parameters_json` text,
	`width` integer,
	`height` integer,
	`seed` integer,
	`sampler` text,
	`steps` integer,
	`cfg_scale` real,
	`model_name` text,
	`duration_ms` integer,
	`created_at` text DEFAULT '2026-04-19T09:50:05.660Z',
	FOREIGN KEY (`prompt_id`) REFERENCES `prompts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `inspiration_seeds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`mood_tags` text,
	`difficulty` text DEFAULT 'any',
	`is_used` integer DEFAULT false,
	`created_at` text DEFAULT '2026-04-19T09:50:05.660Z'
);
--> statement-breakpoint
CREATE TABLE `keyword_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`keyword` text NOT NULL,
	`usage_count` integer DEFAULT 0,
	`avg_rating` real DEFAULT 0,
	`last_used_at` text,
	`best_rating` integer DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX `keyword_stats_keyword_unique` ON `keyword_stats` (`keyword`);--> statement-breakpoint
CREATE TABLE `prompt_tags` (
	`prompt_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	FOREIGN KEY (`prompt_id`) REFERENCES `prompts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `prompt_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`category` text,
	`tags` text,
	`is_builtin` integer DEFAULT false,
	`created_at` text DEFAULT '2026-04-19T09:50:05.660Z',
	`updated_at` text DEFAULT '2026-04-19T09:50:05.660Z'
);
--> statement-breakpoint
CREATE TABLE `prompt_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prompt_id` integer NOT NULL,
	`version` integer NOT NULL,
	`positive` text NOT NULL,
	`negative` text,
	`diff_summary` text,
	`created_at` text DEFAULT '2026-04-19T09:50:05.660Z',
	FOREIGN KEY (`prompt_id`) REFERENCES `prompts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `prompts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text,
	`positive_prompt` text NOT NULL,
	`negative_prompt` text,
	`style_id` integer,
	`workflow_json` text,
	`notes` text,
	`rating` integer,
	`tags` text,
	`source` text DEFAULT 'manual',
	`created_at` text DEFAULT '2026-04-19T09:50:05.660Z',
	`updated_at` text DEFAULT '2026-04-19T09:50:05.660Z',
	FOREIGN KEY (`style_id`) REFERENCES `styles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `style_families` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`name_zh` text,
	`description` text,
	`cover_image` text,
	`sort_order` integer DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX `style_families_slug_unique` ON `style_families` (`slug`);--> statement-breakpoint
CREATE TABLE `style_technique_recs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`style_id` integer NOT NULL,
	`technique_id` integer NOT NULL,
	`relevance` real DEFAULT 1,
	FOREIGN KEY (`style_id`) REFERENCES `styles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`technique_id`) REFERENCES `art_techniques`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `styles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` integer NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`name_zh` text,
	`description` text,
	`positive_template` text NOT NULL,
	`negative_prompt` text,
	`quality_tags` text,
	`recommended_params` text,
	`example_images` text,
	`tags` text,
	`sort_order` integer DEFAULT 0,
	FOREIGN KEY (`family_id`) REFERENCES `style_families`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `styles_slug_unique` ON `styles` (`slug`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_slug_unique` ON `tags` (`slug`);