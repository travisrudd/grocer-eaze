CREATE TABLE `recipe_readers` (
	`share_token` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`recipe_key` text NOT NULL,
	`source_url` text NOT NULL,
	`content_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_readers_owner_recipe_idx` ON `recipe_readers` (`owner_id`,`recipe_key`);