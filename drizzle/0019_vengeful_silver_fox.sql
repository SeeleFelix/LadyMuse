CREATE INDEX IF NOT EXISTS `idx_collectionimages_path` ON `collection_images` (`relative_path`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_collectionimages_collection` ON `collection_images` (`collection_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ia_missing_mtime` ON `image_attributes` (`is_missing`,`file_modified_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ia_rating` ON `image_attributes` (`rating`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ia_file_size` ON `image_attributes` (`file_size`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ia_created_at` ON `image_attributes` (`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ia_width` ON `image_attributes` (`width`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ia_height` ON `image_attributes` (`height`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ia_file_format` ON `image_attributes` (`file_format`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ia_aspect_ratio` ON `image_attributes` (`aspect_ratio`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_imagetags_path` ON `image_tags` (`relative_path`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_imagetags_tag` ON `image_tags` (`tag_id`);