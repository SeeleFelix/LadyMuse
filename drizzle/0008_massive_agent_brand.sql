PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	`created_at` text DEFAULT '(datetime(''now''))',
	FOREIGN KEY (`prompt_id`) REFERENCES `prompts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_generations`("id", "prompt_id", "comfyui_job_id", "image_path", "thumbnail_path", "parameters_json", "width", "height", "seed", "sampler", "steps", "cfg_scale", "model_name", "duration_ms", "created_at") SELECT "id", "prompt_id", "comfyui_job_id", "image_path", "thumbnail_path", "parameters_json", "width", "height", "seed", "sampler", "steps", "cfg_scale", "model_name", "duration_ms", "created_at" FROM `generations`;--> statement-breakpoint
DROP TABLE `generations`;--> statement-breakpoint
ALTER TABLE `__new_generations` RENAME TO `generations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;