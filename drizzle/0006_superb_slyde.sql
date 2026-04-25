ALTER TABLE `prompts` ADD `sampler` text;--> statement-breakpoint
ALTER TABLE `prompts` ADD `scheduler` text;--> statement-breakpoint
ALTER TABLE `prompts` ADD `steps` integer;--> statement-breakpoint
ALTER TABLE `prompts` ADD `cfg_scale` real;--> statement-breakpoint
ALTER TABLE `prompts` ADD `width` integer;--> statement-breakpoint
ALTER TABLE `prompts` ADD `height` integer;