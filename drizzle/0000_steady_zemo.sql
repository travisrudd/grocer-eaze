CREATE TABLE `favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`recipe_id` text NOT NULL,
	`recipe_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`household_name` text NOT NULL,
	`people` integer DEFAULT 4 NOT NULL,
	`location` text DEFAULT 'Uptown, Chicago, IL' NOT NULL,
	`preferences_json` text DEFAULT '{}' NOT NULL,
	`updated_at` text NOT NULL
);
