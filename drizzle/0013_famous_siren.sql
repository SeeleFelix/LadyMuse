CREATE TABLE `art_concepts` (
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
	`created_at` text DEFAULT '(datetime(''now''))',
	`updated_at` text DEFAULT '(datetime(''now''))'
);
--> statement-breakpoint
CREATE TABLE `art_patterns` (
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
	`created_at` text DEFAULT '(datetime(''now''))',
	`updated_at` text DEFAULT '(datetime(''now''))'
);
--> statement-breakpoint
CREATE TABLE `art_references` (
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
	`created_at` text DEFAULT '(datetime(''now''))',
	`updated_at` text DEFAULT '(datetime(''now''))'
);
