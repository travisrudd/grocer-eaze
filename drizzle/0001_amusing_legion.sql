CREATE TABLE `family_members` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`preferences_json` text DEFAULT '{}' NOT NULL,
	`allergies` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recipe_ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`recipe_id` text NOT NULL,
	`quality` integer NOT NULL,
	`ease` integer NOT NULL,
	`updated_at` text NOT NULL
);
