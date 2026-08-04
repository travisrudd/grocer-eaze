CREATE TABLE `active_plans` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`plan_json` text NOT NULL,
	`updated_at` text NOT NULL
);
