PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_cached_models` (
	`id` text NOT NULL,
	`provider` text DEFAULT 'openrouter',
	`name` text,
	`description` text,
	`context_length` integer,
	`pricing` text,
	`updated_at` text DEFAULT '(datetime(''now''))'
);
--> statement-breakpoint
INSERT INTO `__new_cached_models`("id", "provider", "name", "description", "context_length", "pricing", "updated_at") SELECT "id", "provider", "name", "description", "context_length", "pricing", "updated_at" FROM `cached_models`;--> statement-breakpoint
DROP TABLE `cached_models`;--> statement-breakpoint
ALTER TABLE `__new_cached_models` RENAME TO `cached_models`;--> statement-breakpoint
CREATE UNIQUE INDEX `cached_models_id_unique` ON `cached_models` (`id`);--> statement-breakpoint
CREATE TABLE `__new_generation_ratings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`generation_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`is_favorite` integer DEFAULT false,
	`notes` text,
	`effective_keywords` text,
	`created_at` text DEFAULT '(datetime(''now''))',
	FOREIGN KEY (`generation_id`) REFERENCES `generations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_generation_ratings`("id", "generation_id", "rating", "is_favorite", "notes", "effective_keywords", "created_at") SELECT "id", "generation_id", "rating", "is_favorite", "notes", "effective_keywords", "created_at" FROM `generation_ratings`;--> statement-breakpoint
DROP TABLE `generation_ratings`;--> statement-breakpoint
ALTER TABLE `__new_generation_ratings` RENAME TO `generation_ratings`;--> statement-breakpoint
CREATE TABLE `__new_generations` (
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
	`created_at` text DEFAULT '(datetime(''now''))',
	FOREIGN KEY (`prompt_id`) REFERENCES `prompts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_generations`("id", "prompt_id", "comfyui_job_id", "image_path", "thumbnail_path", "parameters_json", "width", "height", "seed", "sampler", "steps", "cfg_scale", "model_name", "duration_ms", "created_at") SELECT "id", "prompt_id", "comfyui_job_id", "image_path", "thumbnail_path", "parameters_json", "width", "height", "seed", "sampler", "steps", "cfg_scale", "model_name", "duration_ms", "created_at" FROM `generations`;--> statement-breakpoint
DROP TABLE `generations`;--> statement-breakpoint
ALTER TABLE `__new_generations` RENAME TO `generations`;--> statement-breakpoint
CREATE TABLE `__new_inspiration_seeds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`mood_tags` text,
	`difficulty` text DEFAULT 'any',
	`is_used` integer DEFAULT false,
	`created_at` text DEFAULT '(datetime(''now''))'
);
--> statement-breakpoint
INSERT INTO `__new_inspiration_seeds`("id", "type", "content", "mood_tags", "difficulty", "is_used", "created_at") SELECT "id", "type", "content", "mood_tags", "difficulty", "is_used", "created_at" FROM `inspiration_seeds`;--> statement-breakpoint
DROP TABLE `inspiration_seeds`;--> statement-breakpoint
ALTER TABLE `__new_inspiration_seeds` RENAME TO `inspiration_seeds`;--> statement-breakpoint
CREATE TABLE `__new_prompt_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`category` text,
	`tags` text,
	`is_builtin` integer DEFAULT false,
	`created_at` text DEFAULT '(datetime(''now''))',
	`updated_at` text DEFAULT '(datetime(''now''))'
);
--> statement-breakpoint
INSERT INTO `__new_prompt_templates`("id", "name", "content", "category", "tags", "is_builtin", "created_at", "updated_at") SELECT "id", "name", "content", "category", "tags", "is_builtin", "created_at", "updated_at" FROM `prompt_templates`;--> statement-breakpoint
DROP TABLE `prompt_templates`;--> statement-breakpoint
ALTER TABLE `__new_prompt_templates` RENAME TO `prompt_templates`;--> statement-breakpoint
CREATE TABLE `__new_prompt_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prompt_id` integer NOT NULL,
	`version` integer NOT NULL,
	`positive` text NOT NULL,
	`negative` text,
	`diff_summary` text,
	`created_at` text DEFAULT '(datetime(''now''))',
	FOREIGN KEY (`prompt_id`) REFERENCES `prompts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_prompt_versions`("id", "prompt_id", "version", "positive", "negative", "diff_summary", "created_at") SELECT "id", "prompt_id", "version", "positive", "negative", "diff_summary", "created_at" FROM `prompt_versions`;--> statement-breakpoint
DROP TABLE `prompt_versions`;--> statement-breakpoint
ALTER TABLE `__new_prompt_versions` RENAME TO `prompt_versions`;--> statement-breakpoint
CREATE TABLE `__new_prompts` (
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
	`created_at` text DEFAULT '(datetime(''now''))',
	`updated_at` text DEFAULT '(datetime(''now''))',
	FOREIGN KEY (`style_id`) REFERENCES `styles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_prompts`("id", "title", "positive_prompt", "negative_prompt", "style_id", "workflow_json", "notes", "rating", "tags", "source", "created_at", "updated_at") SELECT "id", "title", "positive_prompt", "negative_prompt", "style_id", "workflow_json", "notes", "rating", "tags", "source", "created_at", "updated_at" FROM `prompts`;--> statement-breakpoint
DROP TABLE `prompts`;--> statement-breakpoint
ALTER TABLE `__new_prompts` RENAME TO `prompts`;--> statement-breakpoint
CREATE TABLE `__new_session_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`tool_detail` text,
	`created_at` text DEFAULT '(datetime(''now''))',
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_session_messages`("id", "session_id", "role", "content", "tool_detail", "created_at") SELECT "id", "session_id", "role", "content", "tool_detail", "created_at" FROM `session_messages`;--> statement-breakpoint
DROP TABLE `session_messages`;--> statement-breakpoint
ALTER TABLE `__new_session_messages` RENAME TO `session_messages`;--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text DEFAULT '新对话',
	`created_at` text DEFAULT '(datetime(''now''))',
	`updated_at` text DEFAULT '(datetime(''now''))'
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("id", "title", "created_at", "updated_at") SELECT "id", "title", "created_at", "updated_at" FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
CREATE TABLE `__new_user_config` (
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))'
);
--> statement-breakpoint
INSERT INTO `__new_user_config`("key", "value", "updated_at") SELECT "key", "value", "updated_at" FROM `user_config`;--> statement-breakpoint
DROP TABLE `user_config`;--> statement-breakpoint
ALTER TABLE `__new_user_config` RENAME TO `user_config`;--> statement-breakpoint
CREATE UNIQUE INDEX `user_config_key_unique` ON `user_config` (`key`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
