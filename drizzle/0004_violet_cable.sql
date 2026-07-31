CREATE TABLE `recipe_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`source_type` text NOT NULL,
	`source_name` text NOT NULL,
	`source_url` text NOT NULL,
	`title` text NOT NULL,
	`search_text` text NOT NULL,
	`recipe_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recipe_catalog_updated_idx` ON `recipe_catalog` (`updated_at`);
