ALTER TABLE `image_attributes` ADD `extracted_models` text;--> statement-breakpoint
ALTER TABLE `image_attributes` ADD `extracted_loras` text;--> statement-breakpoint
ALTER TABLE `image_attributes` ADD `extracted_samplers` text;--> statement-breakpoint
ALTER TABLE `image_attributes` ADD `extracted_schedulers` text;--> statement-breakpoint
ALTER TABLE `image_attributes` ADD `positive_prompt` text;--> statement-breakpoint
ALTER TABLE `image_attributes` ADD `negative_prompt` text;--> statement-breakpoint
ALTER TABLE `image_attributes` ADD `steps` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `image_attributes` ADD `cfg_scale` real DEFAULT 0;--> statement-breakpoint
ALTER TABLE `image_attributes` ADD `seed` text;--> statement-breakpoint
ALTER TABLE `image_attributes` ADD `width` integer;--> statement-breakpoint
ALTER TABLE `image_attributes` ADD `height` integer;--> statement-breakpoint
ALTER TABLE `image_attributes` ADD `aspect_ratio` text;--> statement-breakpoint
ALTER TABLE `image_attributes` ADD `file_size` integer;--> statement-breakpoint
ALTER TABLE `image_attributes` ADD `file_format` text;--> statement-breakpoint
ALTER TABLE `image_attributes` ADD `color_space` text;--> statement-breakpoint
ALTER TABLE `image_attributes` ADD `has_alpha` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `image_attributes` ADD `file_modified_at` text;--> statement-breakpoint
ALTER TABLE `image_attributes` ADD `is_missing` integer DEFAULT false;