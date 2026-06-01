PRAGMA foreign_keys=OFF;--> statement-breakpoint
-- Tables without any FK involvement
CREATE TABLE `__new_art_concepts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`name_zh` text,
	`category` text NOT NULL,
	`sub_category` text,
	`visual_description` text,
	`tags` text,
	`tag_usage` text,
	`natural_language` text,
	`nl_usage` text,
	`related_concepts` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_id` text,
	`quality_verified` integer DEFAULT 0,
	`embedding` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
INSERT INTO `__new_art_concepts`("id", "name", "name_zh", "category", "sub_category", "visual_description", "tags", "tag_usage", "natural_language", "nl_usage", "related_concepts", "source", "source_id", "quality_verified", "embedding", "created_at", "updated_at") SELECT "id", "name", "name_zh", "category", "sub_category", "visual_description", "tags", "tag_usage", "natural_language", "nl_usage", "related_concepts", "source", "source_id", "quality_verified", "embedding", "created_at", "updated_at" FROM `art_concepts`;--> statement-breakpoint
DROP TABLE `art_concepts`;--> statement-breakpoint
ALTER TABLE `__new_art_concepts` RENAME TO `art_concepts`;--> statement-breakpoint
CREATE TABLE `__new_art_patterns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`intent` text,
	`structure_order` text,
	`composition_rules` text,
	`conflicts` text,
	`involves_dimensions` text,
	`involves_concepts` text,
	`embedding` text,
	`quality_verified` integer DEFAULT 0,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
INSERT INTO `__new_art_patterns`("id", "name", "intent", "structure_order", "composition_rules", "conflicts", "involves_dimensions", "involves_concepts", "embedding", "quality_verified", "created_at", "updated_at") SELECT "id", "name", "intent", "structure_order", "composition_rules", "conflicts", "involves_dimensions", "involves_concepts", "embedding", "quality_verified", "created_at", "updated_at" FROM `art_patterns`;--> statement-breakpoint
DROP TABLE `art_patterns`;--> statement-breakpoint
ALTER TABLE `__new_art_patterns` RENAME TO `art_patterns`;--> statement-breakpoint
CREATE TABLE `__new_art_references` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`intent` text,
	`positive_prompt` text NOT NULL,
	`negative_prompt` text,
	`params_json` text,
	`applied_concepts` text,
	`applied_pattern` text,
	`deviations` text,
	`takeaway` text,
	`verified` integer DEFAULT 0,
	`source` text DEFAULT 'manual',
	`embedding` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
INSERT INTO `__new_art_references`("id", "name", "intent", "positive_prompt", "negative_prompt", "params_json", "applied_concepts", "applied_pattern", "deviations", "takeaway", "verified", "source", "embedding", "created_at", "updated_at") SELECT "id", "name", "intent", "positive_prompt", "negative_prompt", "params_json", "applied_concepts", "applied_pattern", "deviations", "takeaway", "verified", "source", "embedding", "created_at", "updated_at" FROM `art_references`;--> statement-breakpoint
DROP TABLE `art_references`;--> statement-breakpoint
ALTER TABLE `__new_art_references` RENAME TO `art_references`;--> statement-breakpoint
CREATE TABLE `__new_cached_models` (
	`id` text NOT NULL,
	`provider` text DEFAULT 'openrouter',
	`name` text,
	`description` text,
	`context_length` integer,
	`pricing` text,
	`civitai_id` integer,
	`type` text,
	`base_model` text,
	`tags` text,
	`download_count` integer,
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
INSERT INTO `__new_cached_models`("id", "provider", "name", "description", "context_length", "pricing", "civitai_id", "type", "base_model", "tags", "download_count", "updated_at") SELECT "id", "provider", "name", "description", "context_length", "pricing", "civitai_id", "type", "base_model", "tags", "download_count", "updated_at" FROM `cached_models`;--> statement-breakpoint
DROP TABLE `cached_models`;--> statement-breakpoint
ALTER TABLE `__new_cached_models` RENAME TO `cached_models`;--> statement-breakpoint
CREATE UNIQUE INDEX `cached_models_id_unique` ON `cached_models` (`id`);--> statement-breakpoint
CREATE TABLE `__new_inspiration_seeds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`mood_tags` text,
	`difficulty` text DEFAULT 'any',
	`is_used` integer DEFAULT false,
	`created_at` text DEFAULT (datetime('now'))
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
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
INSERT INTO `__new_prompt_templates`("id", "name", "content", "category", "tags", "is_builtin", "created_at", "updated_at") SELECT "id", "name", "content", "category", "tags", "is_builtin", "created_at", "updated_at" FROM `prompt_templates`;--> statement-breakpoint
DROP TABLE `prompt_templates`;--> statement-breakpoint
ALTER TABLE `__new_prompt_templates` RENAME TO `prompt_templates`;--> statement-breakpoint
CREATE TABLE `__new_user_config` (
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
INSERT INTO `__new_user_config`("key", "value", "updated_at") SELECT "key", "value", "updated_at" FROM `user_config`;--> statement-breakpoint
DROP TABLE `user_config`;--> statement-breakpoint
ALTER TABLE `__new_user_config` RENAME TO `user_config`;--> statement-breakpoint
CREATE UNIQUE INDEX `user_config_key_unique` ON `user_config` (`key`);--> statement-breakpoint
CREATE TABLE `__new_sync_state` (
	`key` text NOT NULL,
	`last_cursor` text,
	`synced_count` integer DEFAULT 0,
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
INSERT INTO `__new_sync_state`("key", "last_cursor", "synced_count", "updated_at") SELECT "key", "last_cursor", "synced_count", "updated_at" FROM `sync_state`;--> statement-breakpoint
DROP TABLE `sync_state`;--> statement-breakpoint
ALTER TABLE `__new_sync_state` RENAME TO `sync_state`;--> statement-breakpoint
CREATE UNIQUE INDEX `sync_state_key_unique` ON `sync_state` (`key`);--> statement-breakpoint
-- Phase 1: Recreate child tables WITHOUT FK first (leaves → roots)
-- This removes FK references so parent tables can be safely dropped later
-- prompt_tags references prompts but is not part of the default fix
CREATE TABLE `__new_prompt_tags` (
	`prompt_id` integer NOT NULL,
	`tag_id` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_prompt_tags`("prompt_id", "tag_id") SELECT "prompt_id", "tag_id" FROM `prompt_tags`;--> statement-breakpoint
DROP TABLE `prompt_tags`;--> statement-breakpoint
ALTER TABLE `__new_prompt_tags` RENAME TO `prompt_tags`;--> statement-breakpoint
CREATE TABLE `__new_collection_images` (
	`collection_id` integer NOT NULL,
	`relative_path` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`added_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
INSERT INTO `__new_collection_images`("collection_id", "relative_path", "sort_order", "added_at") SELECT "collection_id", "relative_path", "sort_order", "added_at" FROM `collection_images`;--> statement-breakpoint
DROP TABLE `collection_images`;--> statement-breakpoint
ALTER TABLE `__new_collection_images` RENAME TO `collection_images`;--> statement-breakpoint
CREATE TABLE `__new_generation_ratings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`generation_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`is_favorite` integer DEFAULT false,
	`notes` text,
	`effective_keywords` text,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
INSERT INTO `__new_generation_ratings`("id", "generation_id", "rating", "is_favorite", "notes", "effective_keywords", "created_at") SELECT "id", "generation_id", "rating", "is_favorite", "notes", "effective_keywords", "created_at" FROM `generation_ratings`;--> statement-breakpoint
DROP TABLE `generation_ratings`;--> statement-breakpoint
ALTER TABLE `__new_generation_ratings` RENAME TO `generation_ratings`;--> statement-breakpoint
CREATE TABLE `__new_image_attributes` (
	`relative_path` text PRIMARY KEY NOT NULL,
	`rating` integer DEFAULT 0,
	`color_label` text,
	`flag` text,
	`notes` text,
	`stack_id` integer,
	`metadata_json` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
INSERT INTO `__new_image_attributes`("relative_path", "rating", "color_label", "flag", "notes", "stack_id", "metadata_json", "created_at", "updated_at") SELECT "relative_path", "rating", "color_label", "flag", "notes", "stack_id", "metadata_json", "created_at", "updated_at" FROM `image_attributes`;--> statement-breakpoint
DROP TABLE `image_attributes`;--> statement-breakpoint
ALTER TABLE `__new_image_attributes` RENAME TO `image_attributes`;--> statement-breakpoint
CREATE TABLE `__new_prompt_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prompt_id` integer NOT NULL,
	`version` integer NOT NULL,
	`positive` text NOT NULL,
	`negative` text,
	`diff_summary` text,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
INSERT INTO `__new_prompt_versions`("id", "prompt_id", "version", "positive", "negative", "diff_summary", "created_at") SELECT "id", "prompt_id", "version", "positive", "negative", "diff_summary", "created_at" FROM `prompt_versions`;--> statement-breakpoint
DROP TABLE `prompt_versions`;--> statement-breakpoint
ALTER TABLE `__new_prompt_versions` RENAME TO `prompt_versions`;--> statement-breakpoint
CREATE TABLE `__new_session_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`tool_detail` text,
	`usage_json` text,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
INSERT INTO `__new_session_messages`("id", "session_id", "role", "content", "tool_detail", "usage_json", "created_at") SELECT "id", "session_id", "role", "content", "tool_detail", "usage_json", "created_at" FROM `session_messages`;--> statement-breakpoint
DROP TABLE `session_messages`;--> statement-breakpoint
ALTER TABLE `__new_session_messages` RENAME TO `session_messages`;--> statement-breakpoint
CREATE TABLE `__new_usage_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer,
	`provider` text NOT NULL,
	`model_id` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cache_hit_tokens` integer DEFAULT 0,
	`cost` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'CNY' NOT NULL,
	`duration_ms` integer,
	`metadata` text,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
INSERT INTO `__new_usage_logs`("id", "session_id", "provider", "model_id", "input_tokens", "output_tokens", "cache_hit_tokens", "cost", "currency", "duration_ms", "metadata", "created_at") SELECT "id", "session_id", "provider", "model_id", "input_tokens", "output_tokens", "cache_hit_tokens", "cost", "currency", "duration_ms", "metadata", "created_at" FROM `usage_logs`;--> statement-breakpoint
DROP TABLE `usage_logs`;--> statement-breakpoint
ALTER TABLE `__new_usage_logs` RENAME TO `usage_logs`;--> statement-breakpoint
-- Phase 1: Now recreate parent tables (children no longer have FK → safe to drop parents)
CREATE TABLE `__new_generations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prompt_id` integer,
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
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
INSERT INTO `__new_generations`("id", "prompt_id", "comfyui_job_id", "image_path", "thumbnail_path", "parameters_json", "width", "height", "seed", "sampler", "steps", "cfg_scale", "model_name", "duration_ms", "created_at") SELECT "id", "prompt_id", "comfyui_job_id", "image_path", "thumbnail_path", "parameters_json", "width", "height", "seed", "sampler", "steps", "cfg_scale", "model_name", "duration_ms", "created_at" FROM `generations`;--> statement-breakpoint
DROP TABLE `generations`;--> statement-breakpoint
ALTER TABLE `__new_generations` RENAME TO `generations`;--> statement-breakpoint
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
	`sampler` text,
	`scheduler` text,
	`steps` integer,
	`cfg_scale` real,
	`width` integer,
	`height` integer,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
INSERT INTO `__new_prompts`("id", "title", "positive_prompt", "negative_prompt", "style_id", "workflow_json", "notes", "rating", "tags", "source", "sampler", "scheduler", "steps", "cfg_scale", "width", "height", "created_at", "updated_at") SELECT "id", "title", "positive_prompt", "negative_prompt", "style_id", "workflow_json", "notes", "rating", "tags", "source", "sampler", "scheduler", "steps", "cfg_scale", "width", "height", "created_at", "updated_at" FROM `prompts`;--> statement-breakpoint
DROP TABLE `prompts`;--> statement-breakpoint
ALTER TABLE `__new_prompts` RENAME TO `prompts`;--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text DEFAULT '新对话',
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("id", "title", "created_at", "updated_at") SELECT "id", "title", "created_at", "updated_at" FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
CREATE TABLE `__new_stacks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text,
	`cover_image_path` text,
	`collapsed` integer DEFAULT true,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
INSERT INTO `__new_stacks`("id", "name", "cover_image_path", "collapsed", "created_at") SELECT "id", "name", "cover_image_path", "collapsed", "created_at" FROM `stacks`;--> statement-breakpoint
DROP TABLE `stacks`;--> statement-breakpoint
ALTER TABLE `__new_stacks` RENAME TO `stacks`;--> statement-breakpoint
CREATE TABLE `__new_collections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`cover_image_path` text,
	`is_smart` integer DEFAULT false,
	`smart_criteria` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
INSERT INTO `__new_collections`("id", "name", "description", "cover_image_path", "is_smart", "smart_criteria", "created_at", "updated_at") SELECT "id", "name", "description", "cover_image_path", "is_smart", "smart_criteria", "created_at", "updated_at" FROM `collections`;--> statement-breakpoint
DROP TABLE `collections`;--> statement-breakpoint
ALTER TABLE `__new_collections` RENAME TO `collections`;--> statement-breakpoint
-- Phase 2: Re-add FK constraints in dependency order (roots first, then leaves)
-- Each table is dropped before any __fk_ table that references it is created
-- prompts first (FK to styles which is not being recreated; no __fk_ tables exist yet)
CREATE TABLE `__fk_prompts` (
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
	`sampler` text,
	`scheduler` text,
	`steps` integer,
	`cfg_scale` real,
	`width` integer,
	`height` integer,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`style_id`) REFERENCES `styles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__fk_prompts`("id", "title", "positive_prompt", "negative_prompt", "style_id", "workflow_json", "notes", "rating", "tags", "source", "sampler", "scheduler", "steps", "cfg_scale", "width", "height", "created_at", "updated_at") SELECT "id", "title", "positive_prompt", "negative_prompt", "style_id", "workflow_json", "notes", "rating", "tags", "source", "sampler", "scheduler", "steps", "cfg_scale", "width", "height", "created_at", "updated_at" FROM `prompts`;--> statement-breakpoint
DROP TABLE `prompts`;--> statement-breakpoint
ALTER TABLE `__fk_prompts` RENAME TO `prompts`;--> statement-breakpoint
-- generations (FK to prompts; prompts recreated above, no __fk_ child tables exist yet)
CREATE TABLE `__fk_generations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prompt_id` integer,
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
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`prompt_id`) REFERENCES `prompts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__fk_generations`("id", "prompt_id", "comfyui_job_id", "image_path", "thumbnail_path", "parameters_json", "width", "height", "seed", "sampler", "steps", "cfg_scale", "model_name", "duration_ms", "created_at") SELECT "id", "prompt_id", "comfyui_job_id", "image_path", "thumbnail_path", "parameters_json", "width", "height", "seed", "sampler", "steps", "cfg_scale", "model_name", "duration_ms", "created_at" FROM `generations`;--> statement-breakpoint
DROP TABLE `generations`;--> statement-breakpoint
ALTER TABLE `__fk_generations` RENAME TO `generations`;--> statement-breakpoint
-- Leaves (FK to parents that are already recreated)
CREATE TABLE `__fk_collection_images` (
	`collection_id` integer NOT NULL,
	`relative_path` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`added_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__fk_collection_images`("collection_id", "relative_path", "sort_order", "added_at") SELECT "collection_id", "relative_path", "sort_order", "added_at" FROM `collection_images`;--> statement-breakpoint
DROP TABLE `collection_images`;--> statement-breakpoint
ALTER TABLE `__fk_collection_images` RENAME TO `collection_images`;--> statement-breakpoint
CREATE TABLE `__fk_generation_ratings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`generation_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`is_favorite` integer DEFAULT false,
	`notes` text,
	`effective_keywords` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`generation_id`) REFERENCES `generations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__fk_generation_ratings`("id", "generation_id", "rating", "is_favorite", "notes", "effective_keywords", "created_at") SELECT "id", "generation_id", "rating", "is_favorite", "notes", "effective_keywords", "created_at" FROM `generation_ratings`;--> statement-breakpoint
DROP TABLE `generation_ratings`;--> statement-breakpoint
ALTER TABLE `__fk_generation_ratings` RENAME TO `generation_ratings`;--> statement-breakpoint
CREATE TABLE `__fk_image_attributes` (
	`relative_path` text PRIMARY KEY NOT NULL,
	`rating` integer DEFAULT 0,
	`color_label` text,
	`flag` text,
	`notes` text,
	`stack_id` integer,
	`metadata_json` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`stack_id`) REFERENCES `stacks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__fk_image_attributes`("relative_path", "rating", "color_label", "flag", "notes", "stack_id", "metadata_json", "created_at", "updated_at") SELECT "relative_path", "rating", "color_label", "flag", "notes", "stack_id", "metadata_json", "created_at", "updated_at" FROM `image_attributes`;--> statement-breakpoint
DROP TABLE `image_attributes`;--> statement-breakpoint
ALTER TABLE `__fk_image_attributes` RENAME TO `image_attributes`;--> statement-breakpoint
CREATE TABLE `__fk_prompt_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prompt_id` integer NOT NULL,
	`version` integer NOT NULL,
	`positive` text NOT NULL,
	`negative` text,
	`diff_summary` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`prompt_id`) REFERENCES `prompts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__fk_prompt_versions`("id", "prompt_id", "version", "positive", "negative", "diff_summary", "created_at") SELECT "id", "prompt_id", "version", "positive", "negative", "diff_summary", "created_at" FROM `prompt_versions`;--> statement-breakpoint
DROP TABLE `prompt_versions`;--> statement-breakpoint
ALTER TABLE `__fk_prompt_versions` RENAME TO `prompt_versions`;--> statement-breakpoint
CREATE TABLE `__fk_session_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`tool_detail` text,
	`usage_json` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__fk_session_messages`("id", "session_id", "role", "content", "tool_detail", "usage_json", "created_at") SELECT "id", "session_id", "role", "content", "tool_detail", "usage_json", "created_at" FROM `session_messages`;--> statement-breakpoint
DROP TABLE `session_messages`;--> statement-breakpoint
ALTER TABLE `__fk_session_messages` RENAME TO `session_messages`;--> statement-breakpoint
CREATE TABLE `__fk_usage_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer,
	`provider` text NOT NULL,
	`model_id` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cache_hit_tokens` integer DEFAULT 0,
	`cost` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'CNY' NOT NULL,
	`duration_ms` integer,
	`metadata` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__fk_usage_logs`("id", "session_id", "provider", "model_id", "input_tokens", "output_tokens", "cache_hit_tokens", "cost", "currency", "duration_ms", "metadata", "created_at") SELECT "id", "session_id", "provider", "model_id", "input_tokens", "output_tokens", "cache_hit_tokens", "cost", "currency", "duration_ms", "metadata", "created_at" FROM `usage_logs`;--> statement-breakpoint
DROP TABLE `usage_logs`;--> statement-breakpoint
ALTER TABLE `__fk_usage_logs` RENAME TO `usage_logs`;--> statement-breakpoint
-- prompt_tags (FK to prompts and tags; both exist now)
CREATE TABLE `__fk_prompt_tags` (
	`prompt_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	FOREIGN KEY (`prompt_id`) REFERENCES `prompts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__fk_prompt_tags`("prompt_id", "tag_id") SELECT "prompt_id", "tag_id" FROM `prompt_tags`;--> statement-breakpoint
DROP TABLE `prompt_tags`;--> statement-breakpoint
ALTER TABLE `__fk_prompt_tags` RENAME TO `prompt_tags`;--> statement-breakpoint
PRAGMA foreign_keys=ON;